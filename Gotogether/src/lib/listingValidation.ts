import type { ListingFormState } from '../types/listingForm';
import type { CreateListingPayload } from './api';

export type ListingFormErrors = Partial<Record<keyof ListingFormState, string>>;

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function parseNumber(value: string): number | null {
  if (isBlank(value)) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Validates the form for vehicle rides (CAR or BIKE).
 * Origin, destination, departure time, and capacity are validated.
 */
export function validateListingForm(state: ListingFormState): ListingFormErrors {
  const errors: ListingFormErrors = {};

  if (isBlank(state.title)) errors.title = 'Title is required';
  if (isBlank(state.originLabel)) errors.originLabel = 'Origin location is required';

  const originLat = parseNumber(state.originLatitude);
  if (originLat === null || originLat < -90 || originLat > 90) {
    errors.originLatitude = 'Enter a latitude between -90 and 90';
  }

  const originLng = parseNumber(state.originLongitude);
  if (originLng === null || originLng < -180 || originLng > 180) {
    errors.originLongitude = 'Enter a longitude between -180 and 180';
  }

  if (isBlank(state.destinationLabel)) {
    errors.destinationLabel = 'Destination is required for vehicle rides';
  }
  const destLat = parseNumber(state.destinationLatitude);
  if (destLat === null || destLat < -90 || destLat > 90) {
    errors.destinationLatitude = 'Enter a latitude between -90 and 90';
  }
  const destLng = parseNumber(state.destinationLongitude);
  if (destLng === null || destLng < -180 || destLng > 180) {
    errors.destinationLongitude = 'Enter a longitude between -180 and 180';
  }

  if (isBlank(state.departureTime)) {
    errors.departureTime = 'Departure time is required';
  } else if (Number.isNaN(new Date(state.departureTime).getTime())) {
    errors.departureTime = 'Enter a valid date and time';
  } else if (new Date(state.departureTime).getTime() <= Date.now()) {
    errors.departureTime = 'Departure time must be in the future';
  }

  if (
    !isBlank(state.returnTime) &&
    !isBlank(state.departureTime) &&
    new Date(state.returnTime).getTime() <= new Date(state.departureTime).getTime()
  ) {
    errors.returnTime = 'Return time must be after departure';
  }

  const capacity = parseNumber(state.capacity);
  if (capacity === null || capacity < 1 || !Number.isInteger(capacity)) {
    errors.capacity = 'Capacity must be a whole number of at least 1';
  }

  if (!isBlank(state.pricePerSeat)) {
    const price = parseNumber(state.pricePerSeat);
    if (price === null || price < 0) {
      errors.pricePerSeat = 'Price must be a positive number';
    }
  }

  return errors;
}

export function buildCreateListingPayload(
  state: ListingFormState,
  hostId: string
): CreateListingPayload {
  const tags = state.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    type: state.type,
    hostId,
    title: state.title.trim(),
    description: isBlank(state.description) ? undefined : state.description.trim(),
    originLabel: state.originLabel.trim(),
    originLatitude: Number.parseFloat(state.originLatitude),
    originLongitude: Number.parseFloat(state.originLongitude),
    destinationLabel: isBlank(state.destinationLabel) ? undefined : state.destinationLabel.trim(),
    destinationLatitude: parseNumber(state.destinationLatitude) ?? undefined,
    destinationLongitude: parseNumber(state.destinationLongitude) ?? undefined,
    departureTime: new Date(state.departureTime).toISOString(),
    returnTime: isBlank(state.returnTime) ? undefined : new Date(state.returnTime).toISOString(),
    capacity: Number.parseInt(state.capacity, 10),
    pricePerSeat: isBlank(state.pricePerSeat) ? undefined : Number.parseFloat(state.pricePerSeat),
    currency: state.currency || 'INR',
    paceLevel: state.paceLevel || undefined,
    genderRestriction: state.genderRestriction || undefined,
    tags,
  };
}

export function createEmptyListingFormState(
  type: ListingFormState['type'] = 'CAR'
): ListingFormState {
  return {
    type,
    title: '',
    description: '',
    originLabel: '',
    originLatitude: '',
    originLongitude: '',
    destinationLabel: '',
    destinationLatitude: '',
    destinationLongitude: '',
    departureTime: '',
    returnTime: '',
    capacity: type === 'BIKE' ? '1' : '3',
    pricePerSeat: '',
    currency: 'INR',
    paceLevel: '',
    genderRestriction: '',
    tags: '',
  };
}
