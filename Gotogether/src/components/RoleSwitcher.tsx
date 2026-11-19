import { useState, useRef, useEffect } from 'react';
import { useAuthRole } from '../context/RoleContext';
import type { UserRole } from '../lib/rbac';
import {
  Compass,
  Car,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Check,
  AlertCircle,
  BadgeCheck,
} from 'lucide-react';

const ROLE_METADATA: Record<
  UserRole,
  { label: string; icon: typeof Compass; color: string; badgeBg: string }
> = {
  rider: {
    label: 'Rider',
    icon: Compass,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  driver: {
    label: 'Driver',
    icon: Car,
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  },
  moderator: {
    label: 'Moderator',
    icon: ShieldAlert,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
};

export function RoleSwitcher() {
  const {
    roles,
    activeRole,
    isVerifiedDriver,
    verificationStatus,
    switchActiveRole,
    loading,
  } = useAuthRole();

  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectRole = async (role: UserRole) => {
    if (role === activeRole) {
      setIsOpen(false);
      return;
    }

    try {
      setSwitching(true);
      await switchActiveRole(role);
      setIsOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to switch role');
    } finally {
      setSwitching(false);
    }
  };

  const currentMeta = ROLE_METADATA[activeRole] || ROLE_METADATA.rider;
  const IconComponent = currentMeta.icon;

  if (loading) {
    return (
      <div className="h-8 w-28 animate-pulse rounded-xl bg-white/5 border border-white/10" />
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Active Role Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className={`glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:border-cyan-500/40 hover:bg-white/10 ${currentMeta.badgeBg}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <IconComponent className={`h-3.5 w-3.5 ${currentMeta.color}`} />
        <span>{currentMeta.label}</span>

        {activeRole === 'driver' && (
          <span title={isVerifiedDriver ? 'Verified Driver' : 'Unverified Driver'}>
            {isVerifiedDriver ? (
              <BadgeCheck className="h-3.5 w-3.5 text-cyan-400" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            )}
          </span>
        )}

        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Role Selection Dropdown Menu */}
      {isOpen && (
        <div className="glass-modal absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-2xl p-2 shadow-2xl">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Switch Context
          </div>

          <div className="space-y-1">
            {roles.map((role) => {
              const meta = ROLE_METADATA[role] || ROLE_METADATA.rider;
              const RoleIcon = meta.icon;
              const isSelected = role === activeRole;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleSelectRole(role)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <RoleIcon className={`h-4 w-4 ${meta.color}`} />
                    <span>{meta.label}</span>
                  </div>

                  {isSelected && <Check className="h-4 w-4 text-cyan-400" />}
                </button>
              );
            })}
          </div>

          {/* Driver Verification Status Banner */}
          {roles.includes('driver') && (
            <div className="mt-2 border-t border-white/10 pt-2 px-3 pb-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Driver Status</span>
                <span
                  className={`font-semibold ${
                    isVerifiedDriver
                      ? 'text-cyan-400'
                      : verificationStatus === 'pending'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {isVerifiedDriver
                    ? 'Verified'
                    : verificationStatus === 'pending'
                    ? 'Review Pending'
                    : 'Unverified'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
