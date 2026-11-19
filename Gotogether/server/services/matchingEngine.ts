import type { Gender, PaceLevel, VerificationStatus } from '../types/enums';
import { haversineDistanceKm } from '../utils/haversine';
import type { MatchResult, SearcherContext, SubScore } from '../types/matching';

/**
 * Canonical weight configuration for the matching formula:
 * Score = sum(weight_i * s_i) for i = 1..7. Must sum to 100.
 */
export const SCORE_WEIGHTS: Record<SubScore['key'], number> = {
  proximity: 25,    // 1. Spatial Proximity (25%)
  schedule: 20,     // 2. Temporal Overlap (20%)
  activity: 15,     // 3. Detour Overhead / Transit (15%)
  budget: 15,       // 4. Budget Split (15%)
  reliability: 10,  // 5. Historical Rating & Pace (10%)
  verification: 10, // 6. Driver KYC Verification (10%)
  social: 5,        // 7. Social & Trust (5%)
};

export interface ListingForScoring {
  id: string;
  originLatitude: number;
  originLongitude: number;
  departureTime: Date;
  pricePerSeat: number | null;
  paceLevel: PaceLevel | null;
  genderRestriction: Gender | null;
  tags: string[];
  host: {
    ratingAvg: number;
    ratingCount: number;
    verificationStatus: VerificationStatus;
    gender: Gender | null;
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Distance falls off linearly from 100 at 0km to 0 at the searcher's maxDistanceKm,
 * then floors at 0 beyond that radius so far-away listings rank low rather than
 * disappearing outright.
 */
function scoreProximity(searcher: SearcherContext, listing: ListingForScoring): SubScore {
  const distanceKm = haversineDistanceKm(
    searcher.latitude,
    searcher.longitude,
    listing.originLatitude,
    listing.originLongitude
  );
  const radius = Math.max(searcher.maxDistanceKm, 0.1);
  const value = clampScore(100 * (1 - distanceKm / radius));

  return {
    key: 'proximity',
    value,
    weightPct: SCORE_WEIGHTS.proximity,
    detail: `${distanceKm.toFixed(1)} km from your location`,
  };
}

/**
 * Full score when the departure falls inside the searcher's preferred window;
 * degrades by 15 points per hour outside the window.
 */
function scoreSchedule(searcher: SearcherContext, listing: ListingForScoring): SubScore {
  const { earliestDeparture, latestDeparture } = searcher;

  if (!earliestDeparture || !latestDeparture) {
    return {
      key: 'schedule',
      value: 60,
      weightPct: SCORE_WEIGHTS.schedule,
      detail: 'No schedule preference set, using a neutral default',
    };
  }

  const departure = listing.departureTime.getTime();
  const windowStart = earliestDeparture.getTime();
  const windowEnd = latestDeparture.getTime();

  if (departure >= windowStart && departure <= windowEnd) {
    return {
      key: 'schedule',
      value: 100,
      weightPct: SCORE_WEIGHTS.schedule,
      detail: 'Departs inside your preferred window',
    };
  }

  const hoursOutside =
    Math.min(Math.abs(departure - windowStart), Math.abs(departure - windowEnd)) /
    (1000 * 60 * 60);
  const value = clampScore(100 - hoursOutside * 15);

  return {
    key: 'schedule',
    value,
    weightPct: SCORE_WEIGHTS.schedule,
    detail: `${hoursOutside.toFixed(1)}h outside your preferred window`,
  };
}

/**
 * Free or unpriced listings score highest. Priced listings lose a little for
 * using up more of the budget, and lose sharply once they exceed it.
 */
function scoreBudget(searcher: SearcherContext, listing: ListingForScoring): SubScore {
  if (listing.pricePerSeat === null || listing.pricePerSeat === 0) {
    return {
      key: 'budget',
      value: 100,
      weightPct: SCORE_WEIGHTS.budget,
      detail: 'No cost for this listing',
    };
  }

  if (!searcher.maxBudget) {
    return {
      key: 'budget',
      value: 70,
      weightPct: SCORE_WEIGHTS.budget,
      detail: 'No budget preference set, using a neutral default',
    };
  }

  const ratio = listing.pricePerSeat / searcher.maxBudget;
  const value = ratio <= 1 ? clampScore(100 - ratio * 20) : clampScore(100 - (ratio - 1) * 150);

  return {
    key: 'budget',
    value,
    weightPct: SCORE_WEIGHTS.budget,
    detail:
      ratio <= 1
        ? `Uses ${(ratio * 100).toFixed(0)}% of your budget`
        : `${((ratio - 1) * 100).toFixed(0)}% over your budget`,
  };
}

const PACE_DISTANCE: Record<PaceLevel, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

/**
 * Exact pace match scores 100. Each step of difference (e.g. beginner vs.
 * intermediate) costs 40 points, so beginner vs. advanced bottoms out at 20.
 */
function scoreActivity(searcher: SearcherContext, listing: ListingForScoring): SubScore {
  if (!listing.paceLevel || !searcher.preferredPaceLevel) {
    return {
      key: 'activity',
      value: 70,
      weightPct: SCORE_WEIGHTS.activity,
      detail: 'Pace preference not specified on one side',
    };
  }

  const distance = Math.abs(
    PACE_DISTANCE[listing.paceLevel] - PACE_DISTANCE[searcher.preferredPaceLevel]
  );
  const value = clampScore(100 - distance * 40);

  return {
    key: 'activity',
    value,
    weightPct: SCORE_WEIGHTS.activity,
    detail:
      distance === 0
        ? 'Matches your pace preference exactly'
        : `${listing.paceLevel.toLowerCase()} vs. your ${searcher.preferredPaceLevel.toLowerCase()} preference`,
  };
}

/**
 * Blends the host's average rating with a confidence factor (ramping up to full
 * confidence at 20+ reviews), so a 5-star host with one review doesn't outrank
 * a 4.8-star host with sixty.
 */
function scoreReliability(listing: ListingForScoring): SubScore {
  const { ratingAvg, ratingCount } = listing.host;
  const confidence = clampScore((ratingCount / 20) * 100) / 100;
  const value = clampScore((ratingAvg / 5) * 100 * (0.5 + 0.5 * confidence));

  return {
    key: 'reliability',
    value,
    weightPct: SCORE_WEIGHTS.reliability,
    detail:
      ratingCount > 0
        ? `${ratingAvg.toFixed(1)}★ over ${ratingCount} completed trips`
        : 'No trip history yet',
  };
}

/**
 * Combines mutual gender preference (a hard 0 on conflict) with overlap between
 * the searcher's declared social tags and the listing's tags.
 */
function scoreSocial(searcher: SearcherContext, listing: ListingForScoring): SubScore {
  let genderScore = 100;
  let genderNote = 'No gender preference conflicts';

  if (searcher.sameGenderOnly && searcher.gender && listing.host.gender) {
    genderScore = searcher.gender === listing.host.gender ? 100 : 0;
    genderNote =
      genderScore === 100
        ? 'Host matches your gender preference'
        : "Host doesn't match your gender preference";
  }

  if (listing.genderRestriction && searcher.gender && listing.genderRestriction !== searcher.gender) {
    genderScore = 0;
    genderNote = 'This listing is restricted to a different gender';
  }

  const tagOverlap = listing.tags.filter((tag) => searcher.socialTags.includes(tag)).length;
  const tagScore =
    searcher.socialTags.length === 0
      ? 70
      : clampScore((tagOverlap / searcher.socialTags.length) * 100);

  const value = clampScore(genderScore * 0.5 + tagScore * 0.5);

  return {
    key: 'social',
    value,
    weightPct: SCORE_WEIGHTS.social,
    detail: genderScore < 100 ? genderNote : `${tagOverlap} shared social tag(s) with this listing`,
  };
}

const VERIFICATION_SCORES: Record<VerificationStatus, number> = {
  UNVERIFIED: 20,
  PHONE_VERIFIED: 65,
  ID_VERIFIED: 100,
};

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Host has not completed verification',
  PHONE_VERIFIED: "Host has verified their phone number",
  ID_VERIFIED: "Host has verified their government ID",
};

function scoreVerification(listing: ListingForScoring): SubScore {
  const status = listing.host.verificationStatus;
  return {
    key: 'verification',
    value: VERIFICATION_SCORES[status],
    weightPct: SCORE_WEIGHTS.verification,
    detail: VERIFICATION_LABELS[status],
  };
}

/**
 * Computes the full 7-dimension compatibility score for one listing against one
 * searcher. Score = sum(weight_i * s_i), i = 1..7, weights as percentages summing to 100.
 */
export function scoreListing(searcher: SearcherContext, listing: ListingForScoring): MatchResult {
  const subScores: SubScore[] = [
    scoreProximity(searcher, listing),
    scoreSchedule(searcher, listing),
    scoreBudget(searcher, listing),
    scoreActivity(searcher, listing),
    scoreReliability(listing),
    scoreSocial(searcher, listing),
    scoreVerification(listing),
  ];

  const overallScore =
    Math.round(subScores.reduce((sum, s) => sum + (s.value * s.weightPct) / 100, 0) * 10) / 10;

  return { listingId: listing.id, overallScore, subScores };
}

/**
 * Scores and ranks a batch of listings for one searcher, highest match first.
 */
export function rankListings(
  searcher: SearcherContext,
  listings: ListingForScoring[]
): MatchResult[] {
  return listings
    .map((listing) => scoreListing(searcher, listing))
    .sort((a, b) => b.overallScore - a.overallScore);
}
