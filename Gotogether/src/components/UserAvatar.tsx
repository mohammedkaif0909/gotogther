import { useState, useEffect } from 'react';
import { BadgeCheck, User as UserIcon } from 'lucide-react';
import {
  getProfessionalAvatarUrl,
  getInitials,
  getAvatarGradient,
  isUnprofessionalAvatarUrl,
} from '../utils/avatar';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  verified?: boolean;
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'connecting';
  className?: string;
  ringClassName?: string;
  alt?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<
  AvatarSize,
  {
    box: string;
    text: string;
    badge: string;
    statusDot: string;
    icon: string;
  }
> = {
  xs: {
    box: 'h-6 w-6',
    text: 'text-[10px]',
    badge: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
    statusDot: 'h-2 w-2',
    icon: 'h-3.5 w-3.5',
  },
  sm: {
    box: 'h-7 w-7',
    text: 'text-xs',
    badge: 'h-3 w-3 -bottom-0.5 -right-0.5',
    statusDot: 'h-2 w-2',
    icon: 'h-4 w-4',
  },
  md: {
    box: 'h-9 w-9',
    text: 'text-xs font-bold',
    badge: 'h-3.5 w-3.5 -bottom-1 -right-1',
    statusDot: 'h-2.5 w-2.5',
    icon: 'h-4 w-4',
  },
  lg: {
    box: 'h-10 w-10',
    text: 'text-sm font-bold',
    badge: 'h-4 w-4 -bottom-1 -right-1',
    statusDot: 'h-3 w-3',
    icon: 'h-5 w-5',
  },
  xl: {
    box: 'h-12 w-12',
    text: 'text-base font-bold',
    badge: 'h-4 w-4 -bottom-1 -right-1',
    statusDot: 'h-3 w-3',
    icon: 'h-6 w-6',
  },
  '2xl': {
    box: 'h-16 w-16',
    text: 'text-lg font-bold',
    badge: 'h-5 w-5 -bottom-1 -right-1',
    statusDot: 'h-3.5 w-3.5',
    icon: 'h-7 w-7',
  },
};

export function UserAvatar({
  src,
  name,
  size = 'md',
  verified = false,
  showStatus = false,
  status = 'online',
  className = '',
  ringClassName = 'ring-2 ring-cyan-500/30',
  alt,
  onClick,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  // Resolve professional avatar URL
  const resolvedUrl = getProfessionalAvatarUrl(src, name ?? undefined);

  // If the provided src changed, reset the error fallback
  useEffect(() => {
    setImageError(false);
  }, [src, name]);

  const initials = getInitials(name);
  const gradientClass = getAvatarGradient(name || src || 'User');
  const accessibleLabel = alt || name || 'User profile photo';

  const shouldRenderImage = !imageError && Boolean(resolvedUrl) && !isUnprofessionalAvatarUrl(src && !isUnprofessionalAvatarUrl(src) ? src : null) || (!imageError && Boolean(resolvedUrl));

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-full transition-transform ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      } ${sizeConfig.box} ${className}`}
    >
      {shouldRenderImage ? (
        <img
          src={resolvedUrl}
          alt={accessibleLabel}
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
          className={`h-full w-full rounded-full object-cover ${ringClassName}`}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr ${gradientClass} text-white shadow-inner font-semibold tracking-wider ${sizeConfig.text} ${ringClassName}`}
        >
          {initials && initials !== 'GT' ? (
            <span>{initials}</span>
          ) : (
            <UserIcon className={`${sizeConfig.icon} text-white/90`} />
          )}
        </div>
      )}

      {/* Verified Professional Identity Checkmark */}
      {verified && (
        <BadgeCheck
          className={`absolute ${sizeConfig.badge} fill-cyan-500 text-slate-950 drop-shadow-md`}
          aria-label="Verified identity"
        />
      )}

      {/* Real-time Status Indicator */}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 ${sizeConfig.statusDot} rounded-full border-2 border-slate-950 ${
            status === 'online'
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
              : status === 'connecting'
              ? 'bg-amber-400 animate-pulse'
              : status === 'busy'
              ? 'bg-rose-500'
              : 'bg-slate-500'
          }`}
          title={`Status: ${status}`}
        />
      )}
    </div>
  );
}
