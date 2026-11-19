export const Role = {
  TRAVELER: 'TRAVELER',
  HOST: 'HOST',
  ORGANIZER: 'ORGANIZER',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  NON_BINARY: 'NON_BINARY',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PHONE_VERIFIED: 'PHONE_VERIFIED',
  ID_VERIFIED: 'ID_VERIFIED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const PaceLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
} as const;
export type PaceLevel = (typeof PaceLevel)[keyof typeof PaceLevel];

export const ListingType = {
  CAR: 'CAR',
  BIKE: 'BIKE',
} as const;
export type ListingType = (typeof ListingType)[keyof typeof ListingType];

export const ListingStatus = {
  OPEN: 'OPEN',
  FULL: 'FULL',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const MatchRequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
} as const;
export type MatchRequestStatus = (typeof MatchRequestStatus)[keyof typeof MatchRequestStatus];
