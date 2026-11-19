import type { AuthResponse, LoginCredentials, RegisterPayload, Role, User } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type ListingType = 'CAR' | 'BIKE';
export type PaceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';

export interface CreateListingPayload {
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
  currency: string;
  paceLevel?: PaceLevel;
  genderRestriction?: Gender;
  tags: string[];
}

export interface CreatedListing {
  id: string;
  type: ListingType;
  title: string;
  departureTime: string;
}

function getAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authToken = token ?? localStorage.getItem('gotogether_token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Registration failed (${response.status})`);
  }

  return response.json();
}

export async function loginUser(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Login failed (${response.status})`);
  }

  return response.json();
}

export async function fetchCurrentUser(token?: string | null): Promise<{ user: User }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to fetch profile (${response.status})`);
  }

  return response.json();
}

export async function switchUserRole(role: Role, token?: string | null): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/role`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to switch role (${response.status})`);
  }

  return response.json();
}

export async function updateUserAvatar(avatarUrl: string, token?: string | null): Promise<{ user: User }> {
  const response = await fetch(`${API_BASE_URL}/api/users/me/avatar`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ avatarUrl }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to update avatar (${response.status})`);
  }

  return response.json();
}

export async function createListing(
  payload: CreateListingPayload,
  token?: string | null
): Promise<CreatedListing> {
  const response = await fetch(`${API_BASE_URL}/api/listings`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to create listing (${response.status})`);
  }

  return response.json();
}

export interface BookSeatResponse {
  message: string;
  listing: any;
  seatsBooked: number;
  capacity: number;
  remainingSeats: number;
  status: string;
}

export async function bookSeat(
  listingId: string,
  seats: number = 1,
  token?: string | null
): Promise<BookSeatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/listings/${encodeURIComponent(listingId)}/book`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ seats }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to book seat (${response.status})`);
  }

  return response.json();
}

export async function fetchListings(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/api/listings`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to fetch listings (${response.status})`);
  }
  return response.json();
}

export interface SearchListingsParams {
  type?: 'ALL' | 'CAR' | 'BIKE' | string;
  lat?: number;
  lng?: number;
  q?: string;
  origin?: string;
  destination?: string;
  maxDistanceKm?: number;
  maxBudget?: number;
  earliestDeparture?: string;
  latestDeparture?: string;
  pace?: string;
  gender?: string;
}

export async function searchListings(params: SearchListingsParams = {}): Promise<any[]> {
  const query = new URLSearchParams();
  if (params.type && params.type !== 'ALL') query.append('type', params.type);
  if (params.lat !== undefined) query.append('lat', params.lat.toString());
  if (params.lng !== undefined) query.append('lng', params.lng.toString());
  if (params.q) query.append('q', params.q);
  if (params.origin) query.append('origin', params.origin);
  if (params.destination) query.append('destination', params.destination);
  if (params.maxDistanceKm !== undefined) query.append('maxDistanceKm', params.maxDistanceKm.toString());
  if (params.maxBudget !== undefined) query.append('maxBudget', params.maxBudget.toString());
  if (params.earliestDeparture) query.append('earliestDeparture', params.earliestDeparture);
  if (params.latestDeparture) query.append('latestDeparture', params.latestDeparture);
  if (params.pace) query.append('pace', params.pace);
  if (params.gender) query.append('gender', params.gender);

  const response = await fetch(`${API_BASE_URL}/api/listings/search?${query.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Search failed (${response.status})`);
  }

  const data = await response.json();
  return data.results ?? [];
}

export interface MatchRequestInitResponse {
  matchRequestId: string;
  chatRoomId?: string;
  matchRequest: any;
  listing: any;
  peer: {
    id: string;
    name: string;
    avatarUrl: string;
  };
}

export async function getOrCreateMatchRequest(
  listingId: string,
  requesterId?: string | null,
  token?: string | null
): Promise<MatchRequestInitResponse> {
  const response = await fetch(`${API_BASE_URL}/api/match-requests`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ listingId, requesterId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to open chat room (${response.status})`);
  }

  return response.json();
}

export interface HostedRide {
  id: string;
  type: 'CAR' | 'BIKE';
  title: string;
  description?: string;
  originLabel: string;
  originLatitude?: number;
  originLongitude?: number;
  destinationLabel?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  departureTime: string;
  capacity: number;
  seatsBooked: number;
  pricePerSeat?: number;
  currency: string;
  status: string;
  tags: string;
  bookings: Array<{
    id: string;
    seats: number;
    status: string;
    checkInPin?: string;
    isCheckedIn?: boolean;
    createdAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      avatarUrl?: string;
    };
  }>;
}

export interface JoinedRide {
  id: string;
  bookingId: string;
  seatsBooked: number;
  bookingStatus: string;
  checkInPin?: string;
  isCheckedIn?: boolean;
  bookedAt: string;
  matchRequestId?: string | null;
  listing: {
    id: string;
    type: string;
    title: string;
    originLabel: string;
    originLatitude?: number;
    originLongitude?: number;
    destinationLabel?: string;
    destinationLatitude?: number;
    destinationLongitude?: number;
    departureTime: string;
    pricePerSeat?: number;
    currency: string;
    status: string;
  };
  host: {
    id: string;
    name: string;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    ratingAvg: number;
  };
}

export async function fetchHostedRides(token?: string | null): Promise<HostedRide[]> {
  const response = await fetch(`${API_BASE_URL}/api/users/me/hosted-rides`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to fetch hosted rides (${response.status})`);
  }

  return response.json();
}

export async function fetchJoinedRides(token?: string | null): Promise<JoinedRide[]> {
  const response = await fetch(`${API_BASE_URL}/api/users/me/joined-rides`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to fetch joined rides (${response.status})`);
  }

  return response.json();
}

export async function cancelListing(listingId: string, token?: string | null): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/listings/${encodeURIComponent(listingId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to cancel listing (${response.status})`);
  }

  return response.json();
}

/**
 * Stage 5: Transition ride status (e.g., BOARDING, IN_TRANSIT, COMPLETED, CANCELLED)
 */
export async function updateRideStatus(
  listingId: string,
  status: 'BOARDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED',
  token?: string | null
): Promise<{ message: string; listing: any }> {
  const response = await fetch(`${API_BASE_URL}/api/listings/${encodeURIComponent(listingId)}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to update ride status (${response.status})`);
  }

  return response.json();
}

/**
 * Stage 5: Driver checks in passenger with 4-digit PIN
 */
export async function checkInPassenger(
  listingId: string,
  pin: string,
  token?: string | null
): Promise<{ message: string; booking: any }> {
  const response = await fetch(`${API_BASE_URL}/api/listings/${encodeURIComponent(listingId)}/check-in`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ pin }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Check-in failed (${response.status})`);
  }

  return response.json();
}

/**
 * Stage 5: Reciprocal review and rating submission on trip completion
 */
export async function submitReview(
  listingId: string,
  payload: { subjectId: string; rating: number; comment?: string },
  token?: string | null
): Promise<{ message: string; review: any; newRatingAvg: number }> {
  const response = await fetch(`${API_BASE_URL}/api/listings/${encodeURIComponent(listingId)}/review`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Review submission failed (${response.status})`);
  }

  return response.json();
}



