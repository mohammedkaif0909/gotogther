/**
 * GoTogether Role-Based Access Control (RBAC) System
 * Defines roles: RIDER, DRIVER, MODERATOR, ADMIN
 */

export type UserRole = 'rider' | 'driver' | 'moderator' | 'admin';

export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  roles: UserRole[];
  active_role: UserRole;
  is_verified_driver: boolean;
  vehicle_number: string | null;
  license_url: string | null;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface RideEntity {
  id: string;
  driver_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  capacity: number;
  seats_booked: number;
  price_per_seat?: number | null;
  status: 'scheduled' | 'full' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Checks if a user has at least one of the specified allowed roles.
 */
export function hasRole(
  user: { roles?: UserRole[] | null } | null | undefined,
  allowedRoles: UserRole | UserRole[]
): boolean {
  if (!user || !user.roles || !Array.isArray(user.roles)) return false;
  const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return rolesToCheck.some((role) => user.roles!.includes(role));
}

/**
 * Validates if the user is authorized to create and publish rides:
 * - Must hold the 'driver' role
 * - Must be a verified driver (is_verified_driver === true)
 */
export function canCreateRide(
  user: {
    roles?: UserRole[] | null;
    is_verified_driver?: boolean | null;
    active_role?: UserRole | null;
  } | null | undefined
): boolean {
  if (!user) return false;
  return Boolean(
    hasRole(user, 'driver') &&
    user.is_verified_driver === true
  );
}

/**
 * Validates whether a user can book a specific ride:
 * - Must be authenticated
 * - Must have 'rider' in roles
 * - Cannot book their own ride (rider_id !== driver_id)
 * - Ride must be active/scheduled and have remaining capacity
 */
export function canBookRide(
  user: { id: string; roles?: UserRole[] | null } | null | undefined,
  ride: {
    driver_id: string;
    status?: string | null;
    seats_booked?: number;
    capacity?: number;
  } | null | undefined
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'Authentication required to book a seat.' };
  }

  if (!hasRole(user, 'rider')) {
    return { allowed: false, reason: 'You must have the Rider role to book rides.' };
  }

  if (!ride) {
    return { allowed: false, reason: 'Ride not found.' };
  }

  if (user.id === ride.driver_id) {
    return { allowed: false, reason: 'Drivers cannot book seats on their own rides.' };
  }

  if (ride.status && ride.status !== 'scheduled' && ride.status !== 'OPEN') {
    return { allowed: false, reason: `Ride is currently ${ride.status.toLowerCase()}.` };
  }

  if (ride.capacity !== undefined && ride.seats_booked !== undefined) {
    if (ride.seats_booked >= ride.capacity) {
      return { allowed: false, reason: 'This ride has reached full capacity.' };
    }
  }

  return { allowed: true };
}

/**
 * Checks if the user has moderator privileges (moderator or admin).
 */
export function canModerate(user: { roles?: UserRole[] | null } | null | undefined): boolean {
  return hasRole(user, ['moderator', 'admin']);
}

/**
 * Checks if the user has administrator privileges.
 */
export function canAdmin(user: { roles?: UserRole[] | null } | null | undefined): boolean {
  return hasRole(user, 'admin');
}
