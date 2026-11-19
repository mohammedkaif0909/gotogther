import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../../src/lib/rbac';
import { prisma } from '../lib/prisma';

export interface AuthenticatedRbacUser {
  userId: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  isVerifiedDriver: boolean;
}

declare global {
  namespace Express {
    interface Request {
      rbacUser?: AuthenticatedRbacUser;
    }
  }
}

/**
 * Middleware that loads the user's RBAC profile from Supabase profiles table
 * using the verified auth token userId.
 */
export async function attachRbacProfile(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.userId;
  if (!userId) {
    return next();
  }

  try {
    // Query public.profiles
    const profile = await prisma.$queryRaw<Array<{
      id: string;
      roles: UserRole[];
      active_role: UserRole;
      is_verified_driver: boolean;
    }>>`SELECT id, roles, active_role, is_verified_driver FROM public.profiles WHERE id = ${userId}::uuid LIMIT 1`;

    if (profile && profile.length > 0) {
      req.rbacUser = {
        userId: profile[0].id,
        email: req.user!.email,
        roles: profile[0].roles,
        activeRole: profile[0].active_role,
        isVerifiedDriver: profile[0].is_verified_driver,
      };
    }
    next();
  } catch (error) {
    // If not found in profiles yet, proceed without blocking standard auth
    next();
  }
}

/**
 * Middleware enforcing that the requesting user possesses at least one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = req.rbacUser?.roles;

    // Fallback check against legacy role if profiles row not loaded
    const legacyRole = req.user?.role?.toLowerCase() as UserRole | undefined;

    const hasAllowedRole =
      (roles && allowedRoles.some((r) => roles.includes(r))) ||
      (legacyRole && allowedRoles.includes(legacyRole));

    if (!hasAllowedRole) {
      return res.status(403).json({
        error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Middleware ensuring the user is a verified driver before creating or editing rides.
 */
export function requireVerifiedDriver(req: Request, res: Response, next: NextFunction) {
  const isDriver = req.rbacUser?.roles.includes('driver') || req.user?.role?.toLowerCase() === 'driver';
  const isVerified = req.rbacUser?.isVerifiedDriver === true;

  if (!isDriver) {
    return res.status(403).json({ error: 'Access denied: Must be registered as a driver.' });
  }

  if (!isVerified) {
    return res.status(403).json({
      error: 'Driver verification required: Please complete your KYC/driver verification before hosting rides.',
    });
  }

  next();
}

/**
 * Middleware for moderator or admin only operations (e.g. reviewing flagged trips or approving drivers).
 */
export function requireAdminOrModerator(req: Request, res: Response, next: NextFunction) {
  return requireRole('moderator', 'admin')(req, res, next);
}
