/**
 * Professional avatar catalog and utility helpers for GoTogether.
 * Provides curated, high-definition, corporate and smart-casual commuter headshots
 * and resilient monogram/gradient fallbacks.
 */

export interface ProfessionalAvatar {
  id: string;
  name: string;
  roleHint: string;
  url: string;
  gender: 'female' | 'male' | 'neutral';
}

export const PROFESSIONAL_AVATARS: ProfessionalAvatar[] = [
  {
    id: 'exec-woman-1',
    name: 'Executive Tech Lead',
    roleHint: 'Corporate & Tech Commuter',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'female',
  },
  {
    id: 'exec-man-1',
    name: 'Senior Mobility Lead',
    roleHint: 'Daily Tech Corridor Driver',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'male',
  },
  {
    id: 'exec-woman-2',
    name: 'Product Specialist',
    roleHint: 'EV & Eco-Commute Host',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'female',
  },
  {
    id: 'exec-man-2',
    name: 'Enterprise Architect',
    roleHint: 'Verified Highway Carpooler',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'male',
  },
  {
    id: 'exec-woman-3',
    name: 'Operations Director',
    roleHint: 'Verified Express Host',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'female',
  },
  {
    id: 'exec-man-3',
    name: 'Business Strategy Lead',
    roleHint: 'Daily Airport & SEZ Commuter',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'male',
  },
  {
    id: 'exec-woman-4',
    name: 'Software Consultant',
    roleHint: 'Koramangala ↔ Whitefield',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'female',
  },
  {
    id: 'exec-man-4',
    name: 'Technology Consultant',
    roleHint: 'Smart City Daily Rider',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'male',
  },
  {
    id: 'exec-woman-5',
    name: 'Design Director',
    roleHint: 'HSR Layout ↔ Bellandur',
    url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'female',
  },
  {
    id: 'exec-man-5',
    name: 'Engineering Director',
    roleHint: 'Indiranagar ↔ Manyata Tech',
    url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'male',
  },
  {
    id: 'exec-woman-6',
    name: 'Analytics Manager',
    roleHint: 'Express Highway Commuter',
    url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'female',
  },
  {
    id: 'exec-man-6',
    name: 'Cloud Infrastructure Lead',
    roleHint: 'Bengaluru ↔ Mysore Expressway',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&crop=faces&w=256&h=256&q=80',
    gender: 'male',
  },
];

/**
 * Deterministic hash of any string into a 32-bit positive integer.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Check if a URL looks like an outdated cartoon avatar (Dicebear avataaars)
 * or flaky pravatar link that should be replaced with a professional portrait.
 */
export function isUnprofessionalAvatarUrl(url?: string | null): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('dicebear.com') ||
    lower.includes('avataaars') ||
    lower.includes('pravatar.cc') ||
    lower.includes('placeholder')
  );
}

/**
 * Resolves a high-quality professional avatar URL for any user or host.
 * If the provided URL is already a custom professional photo (e.g. Unsplash), it is preserved.
 * If it's empty or points to cartoon dicebear / pravatar, it deterministically assigns
 * an executive portrait from our curated gallery.
 */
export function getProfessionalAvatarUrl(urlOrSeed?: string | null, seedFallback?: string): string {
  if (urlOrSeed && !isUnprofessionalAvatarUrl(urlOrSeed) && urlOrSeed.startsWith('http')) {
    return urlOrSeed;
  }

  const effectiveSeed = seedFallback || urlOrSeed || 'GoTogether User';
  const index = hashString(effectiveSeed) % PROFESSIONAL_AVATARS.length;
  return PROFESSIONAL_AVATARS[index].url;
}

/**
 * Extracts 1-2 uppercase monogram initials from a person's name.
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'GT';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Returns a sleek executive gradient for monogram fallbacks matching GoTogether's dark glass styling.
 */
export function getAvatarGradient(seed?: string | null): string {
  const gradients = [
    'from-sky-500 to-cyan-600',
    'from-indigo-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-teal-500 to-emerald-600',
  ];
  const idx = hashString(seed || 'User') % gradients.length;
  return gradients[idx];
}
