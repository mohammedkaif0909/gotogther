import type { Gender, PaceLevel } from './enums';

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

/**
 * Everything the matching engine needs to know about the person searching,
 * assembled from their UserPreference row plus request-time overrides (e.g. a
 * one-off search location that differs from their saved home address).
 */
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
