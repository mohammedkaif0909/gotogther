export type ListingFormType = 'CAR' | 'BIKE';
export type PaceLevelOption = '' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type GenderOption = '' | 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';

/**
 * Every field is kept as a string (even numbers and dates) because that's what
 * controlled <input> elements naturally produce; conversion to real types happens
 * once, in buildCreateListingPayload, right before the request is sent.
 */
export interface ListingFormState {
  type: ListingFormType;
  title: string;
  description: string;
  originLabel: string;
  originLatitude: string;
  originLongitude: string;
  destinationLabel: string;
  destinationLatitude: string;
  destinationLongitude: string;
  departureTime: string;
  returnTime: string;
  capacity: string;
  pricePerSeat: string;
  currency: string;
  paceLevel: PaceLevelOption;
  genderRestriction: GenderOption;
  tags: string;
}
