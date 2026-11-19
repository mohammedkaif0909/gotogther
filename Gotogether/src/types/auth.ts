export type Role = 'TRAVELER' | 'HOST' | 'ORGANIZER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  verificationStatus: string;
  collegeName?: string | null;
  organization?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  tripsCompleted?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;

  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  collegeName?: string;
  organization?: string;
}
