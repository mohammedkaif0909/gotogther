import { Router } from 'express';
import type { Request, Response } from 'express';
import { Gender, ListingStatus, ListingType, PaceLevel, Role } from '../types/enums';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { verifyToken, authorizeRoles, JWT_SECRET, type AuthenticatedUserPayload } from '../middleware/auth.middleware';

export const listingsRouter = Router();

interface CreateListingBody {
  type: ListingType;
  hostId: string;
  title: string;
  description?: string;
  originLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLabel?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  departureTime: string;
  returnTime?: string;
  capacity: number;
  pricePerSeat?: number;
  currency?: string;
  paceLevel?: PaceLevel;
  genderRestriction?: Gender;
  tags?: string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Mirrors the client-side validation in listingValidation.ts but is treated as the
 * source of truth: the API must never trust that the frontend actually ran it.
 */
function validateBody(body: Partial<CreateListingBody>): string | null {
  if (!body.type || !Object.values(ListingType).includes(body.type)) {
    return `"type" must be one of ${Object.values(ListingType).join(', ')}`;
  }
  if (!body.hostId || typeof body.hostId !== 'string') return '"hostId" is required';
  if (!body.title || typeof body.title !== 'string') return '"title" is required';
  if (!body.originLabel || typeof body.originLabel !== 'string') return '"originLabel" is required';

  if (!isFiniteNumber(body.originLatitude) || body.originLatitude < -90 || body.originLatitude > 90) {
    return '"originLatitude" must be between -90 and 90';
  }
  if (
    !isFiniteNumber(body.originLongitude) ||
    body.originLongitude < -180 ||
    body.originLongitude > 180
  ) {
    return '"originLongitude" must be between -180 and 180';
  }

  if (!body.departureTime || Number.isNaN(new Date(body.departureTime).getTime())) {
    return '"departureTime" must be a valid ISO 8601 date';
  }
  if (new Date(body.departureTime).getTime() <= Date.now()) {
    return '"departureTime" must be in the future';
  }
  if (body.returnTime) {
    if (Number.isNaN(new Date(body.returnTime).getTime())) {
      return '"returnTime" must be a valid ISO 8601 date';
    }
    if (new Date(body.returnTime).getTime() <= new Date(body.departureTime).getTime()) {
      return '"returnTime" must be after "departureTime"';
    }
  }

  if (!isFiniteNumber(body.capacity) || body.capacity < 1 || !Number.isInteger(body.capacity)) {
    return '"capacity" must be a whole number of at least 1';
  }

  if (body.type === 'CAR' || body.type === 'BIKE') {
    if (!body.destinationLabel) return '"destinationLabel" is required for vehicle listings';
    if (
      !isFiniteNumber(body.destinationLatitude) ||
      body.destinationLatitude < -90 ||
      body.destinationLatitude > 90
    ) {
      return '"destinationLatitude" must be between -90 and 90';
    }
    if (
      !isFiniteNumber(body.destinationLongitude) ||
      body.destinationLongitude < -180 ||
      body.destinationLongitude > 180
    ) {
      return '"destinationLongitude" must be between -180 and 180';
    }
  }

  if (body.pricePerSeat !== undefined && (!isFiniteNumber(body.pricePerSeat) || body.pricePerSeat < 0)) {
    return '"pricePerSeat" must be a non-negative number';
  }
  if (body.paceLevel && !Object.values(PaceLevel).includes(body.paceLevel)) {
    return `"paceLevel" must be one of ${Object.values(PaceLevel).join(', ')}`;
  }
  if (body.genderRestriction && !Object.values(Gender).includes(body.genderRestriction)) {
    return `"genderRestriction" must be one of ${Object.values(Gender).join(', ')}`;
  }

  return null;
}

listingsRouter.post(
  '/listings',
  verifyToken,
  authorizeRoles(Role.HOST, Role.ORGANIZER, Role.ADMIN),
  async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<CreateListingBody>;
    const validationError = validateBody(body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const host = await prisma.user.findUnique({ where: { id: body.hostId } });
    if (!host) {
      return res.status(404).json({ error: 'Host user not found' });
    }

    const listing = await prisma.listing.create({
      data: {
        type: body.type as ListingType,
        hostId: body.hostId as string,
        title: body.title as string,
        description: body.description,
        originLabel: body.originLabel as string,
        originLatitude: body.originLatitude as number,
        originLongitude: body.originLongitude as number,
        destinationLabel: body.destinationLabel,
        destinationLatitude: body.destinationLatitude,
        destinationLongitude: body.destinationLongitude,
        departureTime: new Date(body.departureTime as string),
        returnTime: body.returnTime ? new Date(body.returnTime) : undefined,
        capacity: body.capacity as number,
        pricePerSeat: body.pricePerSeat,
        currency: body.currency ?? 'INR',
        paceLevel: body.paceLevel,
        genderRestriction: body.genderRestriction,
        tags: JSON.stringify(body.tags ?? []),
      },
    });

    // Real-Time Broadcast to all searchers
    const io = req.app.get('io');
    io?.emit('ride:created', listing);

    return res.status(201).json(listing);
  } catch (error) {
    console.error('Failed to create listing', error);
    return res.status(500).json({ error: 'Could not create listing' });
  }
});

/**
 * GET /api/listings
 * Returns all listings with host information.
 */
listingsRouter.get('/listings', async (_req: Request, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      include: {
        host: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            ratingAvg: true,
            tripsCompleted: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { departureTime: 'asc' },
    });
    return res.json(listings);
  } catch (error) {
    console.error('Failed to fetch listings:', error);
    return res.status(500).json({ error: 'Could not fetch listings' });
  }
});

/**
 * GET /api/listings/:id
 * Returns a single listing by its ID.
 */
listingsRouter.get('/listings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            ratingAvg: true,
            tripsCompleted: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    return res.json(listing);
  } catch (error) {
    console.error('Failed to fetch listing:', error);
    return res.status(500).json({ error: 'Could not fetch listing' });
  }
});

/**
 * POST /api/listings/:id/book
 * Books one or more seats directly on a listing, validating capacity and atomically
 * incrementing seatsBooked. Sets status to FULL when capacity is reached.
 * Also creates a Booking relationship linking the authenticated passenger to the listing.
 */
async function handleBookSeat(req: Request, res: Response) {
  try {
    const listingId = (req.params.id || req.body?.listingId) as string;
    if (!listingId) {
      return res.status(400).json({ error: 'Listing ID is required' });
    }

    const seatsToBook =
      typeof req.body?.seats === 'number' &&
      Number.isInteger(req.body.seats) &&
      req.body.seats > 0
        ? req.body.seats
        : 1;

    // Resolve user ID if authenticated
    let bookingUserId: string | null = (req.user?.userId || req.body?.userId || req.body?.passengerId) ?? null;
    if (!bookingUserId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
        bookingUserId = decoded.userId;
      } catch (err) {
        // Silently continue if invalid token
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              ratingAvg: true,
              tripsCompleted: true,
              verificationStatus: true,
            },
          },
        },
      });

      if (!listing) {
        return { status: 404, body: { error: 'Listing not found' } };
      }

      if (listing.status === ListingStatus.FULL || listing.seatsBooked >= listing.capacity) {
        return {
          status: 400,
          body: {
            error: 'Listing is already full',
            capacity: listing.capacity,
            seatsBooked: listing.seatsBooked,
            status: ListingStatus.FULL,
          },
        };
      }

      if (listing.status !== ListingStatus.OPEN) {
        return {
          status: 400,
          body: {
            error: `Listing is ${listing.status.toLowerCase()} and cannot be booked`,
            status: listing.status,
          },
        };
      }

      const availableSeats = listing.capacity - listing.seatsBooked;
      if (seatsToBook > availableSeats) {
        return {
          status: 400,
          body: {
            error: `Only ${availableSeats} seat(s) available. Cannot book ${seatsToBook} seat(s).`,
            capacity: listing.capacity,
            seatsBooked: listing.seatsBooked,
            availableSeats,
          },
        };
      }

      const newSeatsBooked = listing.seatsBooked + seatsToBook;
      const newStatus = newSeatsBooked >= listing.capacity ? ListingStatus.FULL : listing.status;

      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          seatsBooked: newSeatsBooked,
          status: newStatus,
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              ratingAvg: true,
              tripsCompleted: true,
              verificationStatus: true,
            },
          },
        },
      });

      // If user is authenticated or specified, create a Booking relationship with a 4-digit Boarding PIN
      let bookingRecord = null;
      let checkInPin = Math.floor(1000 + Math.random() * 9000).toString();

      if (bookingUserId) {
        // Ensure user exists in database before creating relation
        const userExists = await tx.user.findUnique({ where: { id: bookingUserId } });
        if (userExists) {
          bookingRecord = await tx.booking.create({
            data: {
              listingId,
              userId: bookingUserId,
              seats: seatsToBook,
              status: 'CONFIRMED',
              checkInPin,
              isCheckedIn: false,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  phone: true,
                  email: true,
                },
              },
            },
          });

          // Stage 4: Auto-roster the confirmed passenger into the ride's Group Chat
          try {
            await tx.$executeRawUnsafe(
              `INSERT INTO public.conversation_participants (conversation_id, user_id)
               SELECT c.id, $1 FROM public.conversations c 
               WHERE c.ride_id = $2 AND c.type = 'ride_group'
               ON CONFLICT DO NOTHING`,
              bookingUserId,
              listingId
            );
          } catch (err) {
            // Non-fatal if Supabase conversation table isn't populated for this ride
          }
        }
      }

      return {
        status: 200,
        body: {
          message: 'Seat booked successfully',
          listing: updated,
          booking: bookingRecord,
          checkInPin: bookingRecord?.checkInPin ?? checkInPin,
          seatsBooked: updated.seatsBooked,
          capacity: updated.capacity,
          remainingSeats: Math.max(0, updated.capacity - updated.seatsBooked),
          status: updated.status,
        },
      };
    });

    // Immediate Socket Sync: Emit ride:seats_updated so all active users' feeds update without refresh
    if (result.status === 200) {
      const io = req.app.get('io');
      const payload = {
        listingId,
        seatsBooked: result.body.seatsBooked,
        capacity: result.body.capacity,
        remainingSeats: result.body.remainingSeats,
        status: result.body.status,
      };
      io?.emit('ride:seats_updated', payload);
      io?.to(`ride:${listingId}`).emit('ride:seats_updated', payload);
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Failed to book seat:', error);
    return res.status(500).json({ error: 'Could not complete seat booking' });
  }
}

listingsRouter.post('/listings/:id/book', handleBookSeat);
listingsRouter.post('/listings/book', handleBookSeat);

/**
 * Stage 5: Strict one-way state transition machine for ride lifecycle:
 * [SCHEDULED / OPEN / FULL] ──► [BOARDING] ──► [IN_TRANSIT] ──► [COMPLETED]
 *      │                               │                │
 *      └───────────────────────────────┴────────────────┴──► [CANCELLED]
 *
 * PUT /api/listings/:id/status
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['BOARDING', 'CANCELLED'],
  SCHEDULED: ['BOARDING', 'CANCELLED'],
  FULL: ['BOARDING', 'CANCELLED'],
  BOARDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

listingsRouter.put('/listings/:id/status', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status: targetStatus } = req.body ?? {};
    const userId = req.user!.userId;

    if (!targetStatus || typeof targetStatus !== 'string') {
      return res.status(400).json({ error: 'targetStatus is required' });
    }

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.hostId !== userId && req.user!.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Only the host or admin can update ride status' });
    }

    const currentStatus = listing.status.toUpperCase();
    const nextStatus = targetStatus.toUpperCase();

    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${nextStatus}. Allowed: [${allowed.join(', ')}]`,
      });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        host: { select: { id: true, name: true, phone: true } },
        bookings: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    // If trip reached COMPLETED:
    // 1. Increment host tripsCompleted count
    // 2. Mark chat conversation as is_closed = true
    if (nextStatus === 'COMPLETED') {
      await prisma.user.update({
        where: { id: listing.hostId },
        data: { tripsCompleted: { increment: 1 } },
      }).catch(() => {});

      try {
        await prisma.$executeRawUnsafe(
          `UPDATE public.conversations SET is_closed = true WHERE ride_id = $1`,
          id
        );
      } catch (err) {}
    }

    // Socket.IO Broadcast to all subscribers and riders
    const io = req.app.get('io');
    const statusPayload = { listingId: id, status: nextStatus, listing: updated };
    io?.emit('ride:status_updated', statusPayload);
    io?.to(`ride:${id}`).emit('ride:status_updated', statusPayload);

    return res.json({
      message: `Ride status transitioned to ${nextStatus}`,
      listing: updated,
    });
  } catch (error) {
    console.error('Failed to update ride status:', error);
    return res.status(500).json({ error: 'Could not transition ride status' });
  }
});

/**
 * Stage 5 Boarding & Check-in:
 * Driver verifies passenger using a one-time 4-digit PIN.
 * POST /api/listings/:id/check-in
 */
listingsRouter.post('/listings/:id/check-in', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin, bookingId } = req.body ?? {};
    const userId = req.user!.userId;

    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ error: '4-digit boarding PIN is required' });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { bookings: true },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.hostId !== userId && req.user!.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Only the host or admin can check in passengers' });
    }

    const trimmedPin = pin.trim();

    // Find booking matching the PIN
    const booking = listing.bookings.find(
      (b) => b.checkInPin === trimmedPin && (!bookingId || b.id === bookingId)
    );

    if (!booking) {
      return res.status(400).json({ error: 'Invalid boarding PIN. Verification failed.' });
    }

    if (booking.isCheckedIn) {
      return res.status(400).json({ error: 'Passenger has already been checked in.' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { isCheckedIn: true },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    const io = req.app.get('io');
    const checkInPayload = {
      listingId: id,
      bookingId: booking.id,
      passengerId: booking.userId,
      passengerName: updatedBooking.user.name,
    };
    io?.emit('passenger:checked_in', checkInPayload);
    io?.to(`ride:${id}`).emit('passenger:checked_in', checkInPayload);

    return res.json({
      message: `Passenger ${updatedBooking.user.name} checked in successfully!`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('Failed to check in passenger:', error);
    return res.status(500).json({ error: 'Could not process passenger check-in' });
  }
});

/**
 * Stage 5 Reciprocal Ratings & Reviews:
 * Submits rating (1-5 stars) and comment upon trip completion.
 * POST /api/listings/:id/review
 */
listingsRouter.post('/listings/:id/review', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subjectId, rating, comment } = req.body ?? {};
    const authorId = req.user!.userId;

    if (!subjectId || typeof subjectId !== 'string') {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { bookings: true },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Ratings can only be submitted for completed trips' });
    }

    const review = await prisma.review.create({
      data: {
        authorId,
        subjectId,
        listingId: id,
        rating: numRating,
        comment: typeof comment === 'string' ? comment.trim() : null,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Recalculate average rating for subject
    const allReviews = await prisma.review.findMany({
      where: { subjectId },
      select: { rating: true },
    });
    const ratingCount = allReviews.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount) * 10) / 10
        : numRating;

    await prisma.user.update({
      where: { id: subjectId },
      data: { ratingAvg, ratingCount },
    });

    return res.status(201).json({
      message: 'Review submitted successfully',
      review,
      newRatingAvg: ratingAvg,
    });
  } catch (error) {
    console.error('Failed to submit review:', error);
    return res.status(500).json({ error: 'Could not submit review' });
  }
});

/**
 * DELETE /api/listings/:id
 * Cancels a listing (host or admin only).
 */
listingsRouter.delete('/listings/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.hostId !== userId && req.user!.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Only the host or admin can cancel this listing' });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.CANCELLED },
    });

    return res.json({ message: 'Listing cancelled successfully', listing: updated });
  } catch (error) {
    console.error('Failed to cancel listing:', error);
    return res.status(500).json({ error: 'Failed to cancel listing' });
  }
});


