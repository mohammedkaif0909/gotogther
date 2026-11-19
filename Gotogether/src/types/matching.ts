export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
export type PaceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type SubScoreKey =
  | 'proximity'
  | 'schedule'
  | 'budget'
  | 'activity'
  | 'reliability'
  | 'social'
  | 'verification';

export interface SubScore {
  key: SubScoreKey;
  /** Raw compatibility for this dimension, 0-100 */
  value: number;
  /** Weight of this dimension as a percentage of the overall score */
  weightPct: number;
  /** Short, human-readable explanation of how this value was derived */
  detail: string;
}

export interface MatchResult {
  listingId: string;
  overallScore: number;
  subScores: SubScore[];
}

export interface SearcherContext {
  latitude: number;
  longitude: number;
  maxDistanceKm: number;
  maxBudget?: number;
  earliestDeparture?: Date;
  latestDeparture?: Date;
  preferredPaceLevel?: PaceLevel;
  sameGenderOnly?: boolean;
  gender?: Gender;
  socialTags: string[];
}

export interface MatchHost {
  id: string;
  name: string;
  avatarUrl: string;
  rating: number;
  tripsCompleted: number;
  verified: boolean;
}

export interface MatchListing {
  id: string;
  type: 'CAR' | 'BIKE' | 'car' | 'bike';
  title: string;
  host: MatchHost;
  originLabel: string;
  destinationLabel?: string;
  departureTime: string;
  distanceKm: number;
  pricePerSeat?: number;
  currency: string;
  tags: string[];
  subScores: SubScore[];
  capacity?: number;
  seatsBooked?: number;
  status?: string;
}
