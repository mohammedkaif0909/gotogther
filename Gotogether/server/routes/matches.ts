import { Router } from 'express';
import type { Request, Response } from 'express';
import { ListingType, type Gender, type PaceLevel } from '../types/enums';
import { prisma } from '../lib/prisma';
import { rankListings } from '../services/matchingEngine';
import type { SearcherContext } from '../types/matching';

import jwt from 'jsonwebtoken';
import { JWT_SECRET, type AuthenticatedUserPayload } from '../middleware/auth.middleware';
import { haversineDistanceKm } from '../utils/haversine';
import { getProfessionalAvatarUrl } from '../utils/avatar';

export const matchesRouter = Router();

function parseOptionalFloat(value: unknown): number | undefined {
  if (value === undefined || value === '' || value === null) return undefined;
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * GET /api/listings/search
 *
 * Ranks OPEN listings against search filters, keywords, and live location
 * using the 7-dimension heuristic matching engine.
 */
matchesRouter.get('/listings/search', async (req: Request, res: Response) => {
  try {
    const {
      type,
      lat,
      lng,
      q,
      origin,
      destination,
      maxDistanceKm,
      maxBudget,
      earliestDeparture,
      latestDeparture,
      pace,
      gender,
      sameGenderOnly,
      socialTags,
    } = req.query;

    const parsedType =
      typeof type === 'string' && Object.values(ListingType).includes(type.toUpperCase() as ListingType)
        ? (type.toUpperCase() as ListingType)
        : undefined;

    // Center coordinates (defaults to Bengaluru center: 12.9716, 77.5946)
    const userLat = parseOptionalFloat(lat) ?? 12.9716;
    const userLng = parseOptionalFloat(lng) ?? 77.5946;

    const searcher: SearcherContext = {
      latitude: userLat,
      longitude: userLng,
      maxDistanceKm: parseOptionalFloat(maxDistanceKm) ?? 50,
      maxBudget: parseOptionalFloat(maxBudget),
      earliestDeparture: parseOptionalDate(earliestDeparture),
      latestDeparture: parseOptionalDate(latestDeparture),
      preferredPaceLevel: typeof pace === 'string' ? (pace.toUpperCase() as PaceLevel) : undefined,
      sameGenderOnly: sameGenderOnly === 'true',
      gender: typeof gender === 'string' ? (gender.toUpperCase() as Gender) : undefined,
      socialTags: typeof socialTags === 'string' ? socialTags.split(',').filter(Boolean) : [],
    };

    const queryText = typeof q === 'string' ? q.trim().toLowerCase() : '';
    const originFilter = typeof origin === 'string' ? origin.trim().toLowerCase() : '';
    const destFilter = typeof destination === 'string' ? destination.trim().toLowerCase() : '';

    // Fetch OPEN future listings (or all open listings if future dates not set)
    const listings = await prisma.listing.findMany({
      where: {
        ...(parsedType ? { type: parsedType } : {}),
        status: 'OPEN',
      },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            ratingAvg: true,
            ratingCount: true,
            tripsCompleted: true,
            verificationStatus: true,
            gender: true,
          },
        },
      },
      orderBy: { departureTime: 'asc' },
      take: 100,
    });

    // Apply text filters
    const filtered = listings.filter((l) => {
      if (queryText) {
        const titleMatch = l.title.toLowerCase().includes(queryText);
        const originMatch = l.originLabel.toLowerCase().includes(queryText);
        const destMatch = l.destinationLabel?.toLowerCase().includes(queryText) ?? false;
        const descMatch = l.description?.toLowerCase().includes(queryText) ?? false;
        const tagsMatch = typeof l.tags === 'string' ? l.tags.toLowerCase().includes(queryText) : false;
        if (!titleMatch && !originMatch && !destMatch && !descMatch && !tagsMatch) return false;
      }
      if (originFilter && !l.originLabel.toLowerCase().includes(originFilter)) {
        return false;
      }
      if (destFilter && (!l.destinationLabel || !l.destinationLabel.toLowerCase().includes(destFilter))) {
        return false;
      }
      if (searcher.maxBudget && l.pricePerSeat && l.pricePerSeat > searcher.maxBudget) {
        return false;
      }
      if (searcher.earliestDeparture && new Date(l.departureTime) < searcher.earliestDeparture) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      return res.json({ count: 0, results: [] });
    }

    const rankedResults = rankListings(
      searcher,
      filtered.map((listing) => ({
        id: listing.id,
        originLatitude: listing.originLatitude,
        originLongitude: listing.originLongitude,
        departureTime: listing.departureTime,
        pricePerSeat: listing.pricePerSeat,
        paceLevel: listing.paceLevel as PaceLevel | null,
        genderRestriction: listing.genderRestriction as Gender | null,
        tags: typeof listing.tags === 'string' ? JSON.parse(listing.tags) : listing.tags,
        host: {
          ...listing.host,
          verificationStatus: listing.host.verificationStatus as any,
          gender: listing.host.gender as Gender | null,
        },
      }))
    );

    const listingsById = new Map(filtered.map((listing) => [listing.id, listing]));

    const results = rankedResults.map((result) => {
      const listing = listingsById.get(result.listingId)!;
      const distance = haversineDistanceKm(
        userLat,
        userLng,
        listing.originLatitude,
        listing.originLongitude
      );

      let parsedTags: string[] = [];
      try {
        parsedTags = typeof listing.tags === 'string' ? JSON.parse(listing.tags) : listing.tags;
      } catch (e) {
        parsedTags = [];
      }

      return {
        id: listing.id,
        type: listing.type,
        title: listing.title,
        originLabel: listing.originLabel,
        destinationLabel: listing.destinationLabel ?? undefined,
        departureTime: listing.departureTime.toISOString(),
        distanceKm: Math.round(distance * 10) / 10,
        pricePerSeat: listing.pricePerSeat ?? undefined,
        currency: listing.currency,
        capacity: listing.capacity,
        seatsBooked: listing.seatsBooked,
        status: listing.status,
        tags: parsedTags,
        overallScore: result.overallScore,
        subScores: result.subScores,
        host: {
          id: listing.host.id,
          name: listing.host.name,
          avatarUrl: listing.host.avatarUrl ?? getProfessionalAvatarUrl(listing.host.name),
          rating: listing.host.ratingAvg,
          tripsCompleted: listing.host.tripsCompleted,
          verified: listing.host.verificationStatus === 'ID_VERIFIED',
        },
        listing,
      };
    });

    return res.json({ count: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error while searching listings';
    console.error('Search error:', error);
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/match-requests
 * Finds or creates a MatchRequest between the traveler and host for a listing,
 * ensuring a valid ChatRoom exists for Socket.IO messaging.
 */
matchesRouter.post('/match-requests', async (req: Request, res: Response) => {
  try {
    const { listingId } = req.body ?? {};
    if (!listingId) {
      return res.status(400).json({ error: 'listingId is required' });
    }

    // Resolve traveler ID
    let requesterId: string | null = (req.user?.userId || req.body?.requesterId) ?? null;
    if (!requesterId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
        requesterId = decoded.userId;
      } catch (err) {}
    }

    if (!requesterId) {
      requesterId = 'demo-current-user';
    }

    // Ensure requester exists in User table
    await prisma.user.upsert({
      where: { id: requesterId },
      update: {},
      create: {
        id: requesterId,
        name: 'You (Traveler)',
        email: `${requesterId}@gotogether.local`,
        password: 'demo-password',
        role: 'TRAVELER',
        avatarUrl: getProfessionalAvatarUrl(requesterId),
      },
    });

    const listing = await prisma.listing.findUnique({
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
            gender: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check if MatchRequest already exists
    let matchRequest = await prisma.matchRequest.findUnique({
      where: {
        listingId_requesterId: {
          listingId,
          requesterId,
        },
      },
      include: {
        chatRoom: true,
      },
    });

    if (!matchRequest) {
      const initialSubScores = [
        { key: 'proximity', value: 92, weightPct: 25, detail: 'Pickup point nearby' },
        { key: 'schedule', value: 88, weightPct: 20, detail: 'Departure match' },
        { key: 'budget', value: 95, weightPct: 15, detail: 'Budget alignment' },
        { key: 'activity', value: 85, weightPct: 15, detail: 'Comfortable commute' },
        { key: 'reliability', value: 90, weightPct: 10, detail: '4.8★ host reliability' },
        { key: 'social', value: 80, weightPct: 10, detail: 'Shared preferences' },
        { key: 'verification', value: 100, weightPct: 5, detail: 'ID Verified' },
      ];

      matchRequest = await prisma.matchRequest.create({
        data: {
          listingId,
          requesterId,
          overallScore: 89,
          subScores: JSON.stringify(initialSubScores),
          status: 'PENDING',
          chatRoom: {
            create: {},
          },
        },
        include: {
          chatRoom: true,
        },
      });
    } else if (!matchRequest.chatRoom) {
      const chatRoom = await prisma.chatRoom.create({
        data: { matchRequestId: matchRequest.id },
      });
      matchRequest = { ...matchRequest, chatRoom };
    }

    return res.json({
      matchRequestId: matchRequest.id,
      chatRoomId: matchRequest.chatRoom?.id,
      matchRequest,
      listing,
      peer: {
        id: listing.host.id,
        name: listing.host.name,
        avatarUrl: listing.host.avatarUrl ?? getProfessionalAvatarUrl(listing.host.name),
      },
    });
  } catch (error) {
    console.error('Failed to get or create match request:', error);
    return res.status(500).json({ error: 'Failed to initialize chat room' });
  }
});
