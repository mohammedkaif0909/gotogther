import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Compass,
  Plus,
  LogOut,
  BadgeCheck,
  ChevronDown,
  Car,
  Layers,
  Users,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { RoleSwitcher } from './RoleSwitcher';
import { useAuthRole } from '../context/RoleContext';
import { UserAvatar } from './UserAvatar';
import { ProfileIconPickerModal } from './ProfileIconPickerModal';
import type { Role } from '../types/auth';

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'register', role?: Role) => void;
  onOpenCreateListing: () => void;
  onNavigateMyRides?: () => void;
  onNavigateHome?: () => void;
}

const ROLE_BADGE_STYLES: Record<Role, { label: string; badgeClass: string }> = {
  TRAVELER: {
    label: 'Traveler',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  },
  HOST: {
    label: 'Host',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  },
  ORGANIZER: {
    label: 'Organizer',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  },
  ADMIN: {
    label: 'Admin',
    badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  },
};

export function Navbar({ onOpenAuth, onOpenCreateListing, onNavigateMyRides, onNavigateHome }: NavbarProps) {
  const { user, isAuthenticated, logout, switchRole, updateAvatar } = useAuth();
  const { activeRole, isVerifiedDriver } = useAuthRole();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleRole = async () => {
    if (!user) return;
    const nextRole: Role = user.role === 'HOST' ? 'TRAVELER' : 'HOST';
    await switchRole(nextRole);
    setDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 glass-nav transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        {/* Brand Logo with Ambient Cyan Glow */}
        <div
          onClick={onNavigateHome}
          className={`group flex items-center gap-3 ${onNavigateHome ? 'cursor-pointer' : ''}`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-white/25 transition duration-300 group-hover:scale-105 group-hover:shadow-cyan-400/50">
            <Compass className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-white drop-shadow-sm">
                GoTogether
              </span>
              <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300 backdrop-blur-md">
                v2.0 Glass
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Ride Matching & Commutes</p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* RBAC Role Context Switcher */}
          {isAuthenticated && <RoleSwitcher />}

          {/* My Rides Navigation Button */}
          {onNavigateMyRides && (
            <button
              type="button"
              onClick={onNavigateMyRides}
              className="glass-btn-secondary flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold"
            >
              <Users className="h-3.5 w-3.5 text-cyan-400" />
              <span>My Rides</span>
            </button>
          )}

          {/* Host a Trip Primary CTA */}
          <button
            type="button"
            onClick={onOpenCreateListing}
            className="glass-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
          >
            <Plus className="h-4 w-4" />
            <span>Host a Ride</span>
          </button>

          {!isAuthenticated || !user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <UserIcon className="h-3.5 w-3.5 text-cyan-400" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="glass-btn-secondary rounded-xl px-3.5 py-2 text-xs font-bold"
              >
                Get Started
              </button>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="glass-chip flex items-center gap-2.5 rounded-2xl p-1.5 pl-2.5 transition hover:border-cyan-500/40 hover:bg-white/10"
              >
                {/* Role Pill */}
                <span
                  className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    ROLE_BADGE_STYLES[user.role]?.badgeClass ?? ''
                  }`}
                >
                  {user.role}
                </span>

                {/* Professional Avatar with Status & Verification */}
                <UserAvatar
                  src={user.avatarUrl}
                  name={user.name}
                  size="sm"
                  verified={user.isVerified}
                />

                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {/* Frosted Dropdown Menu */}
              {dropdownOpen && (
                <div className="glass-modal absolute right-0 mt-2 w-64 rounded-2xl p-2.5 shadow-2xl z-50">
                  <div className="border-b border-white/10 p-3 flex items-center gap-3">
                    <UserAvatar
                      src={user.avatarUrl}
                      name={user.name}
                      size="md"
                      verified={user.isVerified}
                      ringClassName="ring-2 ring-cyan-400/50 shadow-md shadow-cyan-500/20"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white leading-tight">
                        {user.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400 mt-0.5">
                        {user.email}
                      </p>
                      {user.collegeName && (
                        <p className="mt-0.5 truncate text-[10px] text-cyan-300 font-medium">
                          {user.collegeName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="py-1.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        setIconPickerOpen(true);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="flex items-center gap-2.5">
                        <Sparkles className="h-4 w-4 text-cyan-400" />
                        Change Profile Icon
                      </span>
                      <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                        PRO
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleRole}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="flex items-center gap-2.5">
                        <Car className="h-4 w-4 text-cyan-400" />
                        Switch to {user.role === 'HOST' ? 'Traveler' : 'Host'}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">⌘R</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onNavigateMyRides?.();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <Layers className="h-4 w-4 text-cyan-400" />
                      My Rides & Bookings
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/15"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Professional Profile Icon Picker Modal */}
      <ProfileIconPickerModal
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        currentUser={user}
        onSelectAvatar={updateAvatar}
      />
    </header>
  );
}
