import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken, JWT_SECRET, type AuthenticatedUserPayload } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';

export const usersRouter = Router();

function resolveUserId(req: Request): string | null {
  if (req.user?.userId) return req.user.userId;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
      return decoded.userId;
    } catch (err) {}
  }
  return (req.query.userId as string) || null;
}

/**
 * PATCH /api/users/me/avatar
 * Updates the user's professional profile icon / avatar.
 */
usersRouter.patch('/me/avatar', async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { avatarUrl } = req.body;
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'A valid avatarUrl string is required' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        phone: true,
        isVerified: true,
        verificationStatus: true,
        organization: true,
        ratingAvg: true,
        ratingCount: true,
        tripsCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ user: updated });
  } catch (error) {
    console.error('Failed to update user avatar:', error);
    return res.status(500).json({ error: 'Failed to update avatar' });
  }
});

/**
 * GET /api/users/me/hosted-rides
 * Returns all listings published by the authenticated host, along with booked passenger details.
 */
usersRouter.get('/me/hosted-rides', async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hostedListings = await prisma.listing.findMany({
      where: { hostId: userId },
      include: {
        bookings: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        matchRequests: {
          include: {
            requester: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { departureTime: 'desc' },
    });

    return res.json(hostedListings);
  } catch (error) {
    console.error('Failed to fetch hosted rides:', error);
    return res.status(500).json({ error: 'Failed to retrieve hosted rides' });
  }
});

/**
 * GET /api/users/me/joined-rides
 * Returns all listings where the user has booked seats or participated in match requests.
 */
usersRouter.get('/me/joined-rides', async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 1. Fetch direct bookings
    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: {
        listing: {
          include: {
            host: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                ratingAvg: true,
                tripsCompleted: true,
                phone: true,
                email: true,
              },
            },
            matchRequests: {
              where: { requesterId: userId },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch match requests where requester is this user
    const matchRequests = await prisma.matchRequest.findMany({
      where: { requesterId: userId },
      include: {
        listing: {
          include: {
            host: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                ratingAvg: true,
                tripsCompleted: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Combine and format
    const results = bookings.map((b) => ({
      id: b.id,
      bookingId: b.id,
      seatsBooked: b.seats,
      bookingStatus: b.status,
      checkInPin: b.checkInPin,
      isCheckedIn: b.isCheckedIn,
      bookedAt: b.createdAt,
      matchRequestId: b.listing.matchRequests[0]?.id ?? null,
      listing: b.listing,
      host: b.listing.host,
    }));

    // If there are match requests not covered by direct booking, include them
    for (const mr of matchRequests) {
      const alreadyIncluded = results.some((r) => r.listing.id === mr.listing.id);
      if (!alreadyIncluded && mr.listing) {
        results.push({
          id: mr.id,
          bookingId: mr.id,
          seatsBooked: 1,
          bookingStatus: mr.status === 'ACCEPTED' ? 'CONFIRMED' : mr.status,
          checkInPin: null,
          isCheckedIn: false,
          bookedAt: mr.createdAt,
          matchRequestId: mr.id,
          listing: mr.listing as any,
          host: mr.listing.host as any,
        });
      }
    }

    return res.json(results);
  } catch (error) {
    console.error('Failed to fetch joined rides:', error);
    return res.status(500).json({ error: 'Failed to retrieve joined rides' });
  }
});
