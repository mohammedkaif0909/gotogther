import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  type UserRole,
  type UserProfile,
  type VerificationStatus,
  hasRole as checkHasRole,
  canCreateRide as checkCanCreateRide,
} from '../lib/rbac';
import { useAuth } from './AuthContext';

interface RoleContextValue {
  roles: UserRole[];
  activeRole: UserRole;
  isVerifiedDriver: boolean;
  verificationStatus: VerificationStatus;
  profile: UserProfile | null;
  loading: boolean;
  canCreateRide: boolean;
  hasRole: (allowedRoles: UserRole | UserRole[]) => boolean;
  switchActiveRole: (newRole: UserRole) => Promise<void>;
  refreshRoleProfile: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user: authUser, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('rider');
  const [roles, setRoles] = useState<UserRole[]>(['rider']);
  const [isVerifiedDriver, setIsVerifiedDriver] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('unverified');
  const [loading, setLoading] = useState(true);

  // Fetch RBAC profile from Supabase profiles table
  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated || !authUser?.id) {
      setProfile(null);
      setActiveRole('rider');
      setRoles(['rider']);
      setIsVerifiedDriver(false);
      setVerificationStatus('unverified');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // Fallback to authUser values if profiles table query fails
        const legacyRole = authUser.role.toLowerCase() as UserRole;
        const fallbackRoles: UserRole[] = [legacyRole || 'rider'];
        setRoles(fallbackRoles);
        setActiveRole(legacyRole || 'rider');
        setIsVerifiedDriver(Boolean(authUser.isVerified));
        return;
      }

      if (data) {
        setProfile(data as UserProfile);
        setRoles(data.roles || ['rider']);
        setActiveRole(data.active_role || 'rider');
        setIsVerifiedDriver(Boolean(data.is_verified_driver));
        setVerificationStatus((data.verification_status as VerificationStatus) || 'unverified');
      } else {
        // Default mapping if row does not exist yet
        const defaultRole = (authUser.role?.toLowerCase() as UserRole) || 'rider';
        setRoles([defaultRole]);
        setActiveRole(defaultRole);
        setIsVerifiedDriver(Boolean(authUser.isVerified));
      }
    } catch (err) {
      console.warn('Could not fetch Supabase RBAC profile, using auth fallback:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /**
   * Switches the active role for the current user session and syncs to Supabase.
   */
  const switchActiveRole = useCallback(
    async (newRole: UserRole) => {
      if (!roles.includes(newRole)) {
        throw new Error(`You do not possess the "${newRole}" role.`);
      }

      // Optimistic update
      setActiveRole(newRole);

      if (authUser?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ active_role: newRole, updated_at: new Date().toISOString() })
          .eq('id', authUser.id);

        if (error) {
          console.error('Failed to sync active role to Supabase:', error.message);
          // Rollback on failure
          await fetchProfile();
          throw error;
        }
      }
    },
    [roles, authUser, fetchProfile]
  );

  const hasRoleCallback = useCallback(
    (allowedRoles: UserRole | UserRole[]) => {
      return checkHasRole({ roles }, allowedRoles);
    },
    [roles]
  );

  const canCreateRideVal = useMemo(() => {
    return checkCanCreateRide({ roles, is_verified_driver: isVerifiedDriver });
  }, [roles, isVerifiedDriver]);

  const value = useMemo(
    () => ({
      roles,
      activeRole,
      isVerifiedDriver,
      verificationStatus,
      profile,
      loading,
      canCreateRide: canCreateRideVal,
      hasRole: hasRoleCallback,
      switchActiveRole,
      refreshRoleProfile: fetchProfile,
    }),
    [
      roles,
      activeRole,
      isVerifiedDriver,
      verificationStatus,
      profile,
      loading,
      canCreateRideVal,
      hasRoleCallback,
      switchActiveRole,
      fetchProfile,
    ]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useAuthRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useAuthRole must be used within a RoleProvider');
  }
  return context;
}

// Alias for convenience
export const useUserRole = useAuthRole;
