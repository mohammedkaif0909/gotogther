-- =============================================================================
-- GoTogether: Supabase RBAC Migration
-- Roles: RIDER, DRIVER, MODERATOR, ADMIN
-- =============================================================================

-- 1. Create user_role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('rider', 'driver', 'moderator', 'admin');
  END IF;
END $$;

-- 2. Create public.profiles referencing auth.users(id) ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  roles user_role[] NOT NULL DEFAULT ARRAY['rider']::user_role[],
  active_role user_role NOT NULL DEFAULT 'rider',
  is_verified_driver BOOLEAN NOT NULL DEFAULT false,
  vehicle_number TEXT,
  license_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create public.rides
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL DEFAULT 3,
  seats_booked INT NOT NULL DEFAULT 0,
  price_per_seat NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create public.bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seats INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_ride_rider UNIQUE (ride_id, rider_id)
);

-- 5. Create public.reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optimal indexes
CREATE INDEX IF NOT EXISTS idx_profiles_roles ON public.profiles USING GIN (roles);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON public.rides (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_departure ON public.rides (departure_time);
CREATE INDEX IF NOT EXISTS idx_bookings_rider ON public.bookings (rider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ride ON public.bookings (ride_id);

-- 6. Trigger: automatically provision profile row on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    phone,
    roles,
    active_role,
    is_verified_driver,
    verification_status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    NEW.phone,
    ARRAY['rider']::user_role[],
    'rider',
    false,
    'unverified'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Helper functions for RLS and Authorization (STABLE & SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(required_role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) 
      AND required_role = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) 
      AND ('admin' = ANY(roles) OR 'moderator' = ANY(roles))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_verified_driver(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id 
      AND 'driver' = ANY(roles)
      AND is_verified_driver = true
  );
$$;

-- 8. Protect profile privileges from non-admin/moderator updates
CREATE OR REPLACE FUNCTION public.check_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    OLD.is_verified_driver IS DISTINCT FROM NEW.is_verified_driver OR
    OLD.verification_status IS DISTINCT FROM NEW.verification_status OR
    OLD.roles IS DISTINCT FROM NEW.roles
  ) AND NOT public.is_admin_or_moderator() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators or moderators can modify role privileges or driver verification status.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_escalation ON public.profiles;
CREATE TRIGGER protect_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_privilege_escalation();

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies: Profiles
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
CREATE POLICY "profiles_read_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id OR public.is_admin_or_moderator());

-- 11. RLS Policies: Rides
DROP POLICY IF EXISTS "rides_read_active" ON public.rides;
CREATE POLICY "rides_read_active"
  ON public.rides FOR SELECT
  TO authenticated
  USING (status != 'cancelled' OR driver_id = (select auth.uid()) OR public.is_admin_or_moderator());

DROP POLICY IF EXISTS "rides_insert_verified_driver" ON public.rides;
CREATE POLICY "rides_insert_verified_driver"
  ON public.rides FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = (select auth.uid()) 
    AND public.is_verified_driver((select auth.uid()))
  );

DROP POLICY IF EXISTS "rides_update_own_or_admin" ON public.rides;
CREATE POLICY "rides_update_own_or_admin"
  ON public.rides FOR UPDATE
  TO authenticated
  USING (driver_id = (select auth.uid()) OR public.is_admin_or_moderator());

DROP POLICY IF EXISTS "rides_delete_own_or_admin" ON public.rides;
CREATE POLICY "rides_delete_own_or_admin"
  ON public.rides FOR DELETE
  TO authenticated
  USING (driver_id = (select auth.uid()) OR public.is_admin_or_moderator());

-- 12. RLS Policies: Bookings
DROP POLICY IF EXISTS "bookings_read_parties_or_admin" ON public.bookings;
CREATE POLICY "bookings_read_parties_or_admin"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    rider_id = (select auth.uid()) 
    OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.driver_id = (select auth.uid()))
    OR public.is_admin_or_moderator()
  );

DROP POLICY IF EXISTS "bookings_insert_rider" ON public.bookings;
CREATE POLICY "bookings_insert_rider"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    rider_id = (select auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.driver_id = (select auth.uid()))
    AND public.has_role('rider')
  );

DROP POLICY IF EXISTS "bookings_update_parties_or_admin" ON public.bookings;
CREATE POLICY "bookings_update_parties_or_admin"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    rider_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.driver_id = (select auth.uid()))
    OR public.is_admin_or_moderator()
  );

-- 13. RLS Policies: Reviews
DROP POLICY IF EXISTS "reviews_read_authenticated" ON public.reviews;
CREATE POLICY "reviews_read_authenticated"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reviews_insert_authenticated" ON public.reviews;
CREATE POLICY "reviews_insert_authenticated"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (select auth.uid()) AND author_id != target_id);

DROP POLICY IF EXISTS "reviews_modify_author_or_admin" ON public.reviews;
CREATE POLICY "reviews_modify_author_or_admin"
  ON public.reviews FOR ALL
  TO authenticated
  USING (author_id = (select auth.uid()) OR public.is_admin_or_moderator());
