-- =============================================================================
-- GoTogether: Normalized Chat System Migration
-- Channels: ride_group, direct_inquiry, support_ticket
-- =============================================================================

-- 1. Conversation Types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type') THEN
    CREATE TYPE conversation_type AS ENUM ('ride_group', 'direct_inquiry', 'support_ticket');
  END IF;
END $$;

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
    type conversation_type NOT NULL DEFAULT 'direct_inquiry',
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_closed BOOLEAN DEFAULT FALSE,
    closed_at TIMESTAMPTZ
);

-- 3. Conversation Participants (Junction Table)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_ride ON public.conversations(ride_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- 6. Helper function: is_conversation_participant
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conv_id
      AND cp.user_id = (select auth.uid())
  );
$$;

-- 7. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies: Conversations
DROP POLICY IF EXISTS "conversations_select_participant_or_admin" ON public.conversations;
CREATE POLICY "conversations_select_participant_or_admin"
ON public.conversations FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(id)
  OR public.is_admin_or_moderator()
);

DROP POLICY IF EXISTS "conversations_insert_authenticated" ON public.conversations;
CREATE POLICY "conversations_insert_authenticated"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "conversations_update_participants_or_admin" ON public.conversations;
CREATE POLICY "conversations_update_participants_or_admin"
ON public.conversations FOR UPDATE
TO authenticated
USING (
  public.is_conversation_participant(id)
  OR public.is_admin_or_moderator()
);

-- 9. RLS Policies: Conversation Participants
DROP POLICY IF EXISTS "conv_participants_select" ON public.conversation_participants;
CREATE POLICY "conv_participants_select"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_participants WHERE user_id = (select auth.uid())
  )
  OR public.is_admin_or_moderator()
);

DROP POLICY IF EXISTS "conv_participants_insert" ON public.conversation_participants;
CREATE POLICY "conv_participants_insert"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  OR public.is_conversation_participant(conversation_id)
  OR public.is_admin_or_moderator()
);

-- 10. RLS Policies: Messages
DROP POLICY IF EXISTS "messages_select_participant_or_admin" ON public.messages;
CREATE POLICY "messages_select_participant_or_admin"
ON public.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = (select auth.uid())
  )
  OR public.is_admin_or_moderator()
);

DROP POLICY IF EXISTS "messages_insert_active_participant" ON public.messages;
CREATE POLICY "messages_insert_active_participant"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = (select auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = (select auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND c.is_closed = false
  )
);

-- 11. Trigger: Auto-create ride group conversation on new ride
CREATE OR REPLACE FUNCTION public.handle_new_ride_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conv_id UUID;
BEGIN
  INSERT INTO public.conversations (ride_id, type, title, is_closed)
  VALUES (NEW.id, 'ride_group', 'Ride Discussion', false)
  RETURNING id INTO new_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (new_conv_id, NEW.driver_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ride_created_chat ON public.rides;
CREATE TRIGGER on_ride_created_chat
  AFTER INSERT ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_ride_conversation();

-- 12. Trigger: Auto-add confirmed riders to group conversation
CREATE OR REPLACE FUNCTION public.handle_confirmed_booking_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  group_conv_id UUID;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    SELECT id INTO group_conv_id
    FROM public.conversations
    WHERE ride_id = NEW.ride_id AND type = 'ride_group'
    LIMIT 1;

    IF group_conv_id IS NOT NULL THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (group_conv_id, NEW.rider_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_confirmed_chat ON public.bookings;
CREATE TRIGGER on_booking_confirmed_chat
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_confirmed_booking_chat();

-- 13. Trigger: Auto-close chat when ride is completed or cancelled
CREATE OR REPLACE FUNCTION public.handle_ride_status_chat_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND (OLD IS NULL OR OLD.status NOT IN ('completed', 'cancelled')) THEN
    UPDATE public.conversations
    SET is_closed = true, closed_at = NOW()
    WHERE ride_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ride_status_closure ON public.rides;
CREATE TRIGGER on_ride_status_closure
  AFTER UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.handle_ride_status_chat_closure();
