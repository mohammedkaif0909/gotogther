import { useState } from 'react';
import { Plus, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
import { MatchCard } from './MatchCard';
import { ChatDrawer } from './ChatDrawer';
import { ListingCreationModal } from './ListingCreationModal';
import { AuthModal } from './AuthModal';
import { Navbar } from './Navbar';
import { useAuth } from '../context/AuthContext';
import { mockListings } from '../data/mockListings';
import type { MatchListing } from '../types/matching';
import type { CreatedListing } from '../lib/api';
import type { Role } from '../types/auth';

const DEMO_FALLBACK_USER_ID = 'demo-current-user';

export default function MatchCardDemo() {
  const { user, isAuthenticated, switchRole } = useAuth();
  const [activeChatListing, setActiveChatListing] = useState<MatchListing | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedListing | null>(null);

  // Auth modal states
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authDefaultRole, setAuthDefaultRole] = useState<Role>('TRAVELER');
  const [roleUpgradeNotice, setRoleUpgradeNotice] = useState(false);

  const handleOpenAuth = (mode: 'login' | 'register', role?: Role) => {
    setAuthMode(mode);
    if (role) setAuthDefaultRole(role);
    setAuthModalOpen(true);
  };

  const handleHostAction = () => {
    setRoleUpgradeNotice(false);

    if (!isAuthenticated || !user) {
      handleOpenAuth('register', 'HOST');
      return;
    }

    if (user.role === 'TRAVELER') {
      setRoleUpgradeNotice(true);
      return;
    }

    setCreateOpen(true);
  };

  const handleUpgradeToHost = async () => {
    if (user) {
      await switchRole('HOST');
      setRoleUpgradeNotice(false);
      setCreateOpen(true);
    }
  };

  const effectiveUserId = user?.id ?? DEMO_FALLBACK_USER_ID;

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation Bar */}
      <Navbar onOpenAuth={handleOpenAuth} onOpenCreateListing={handleHostAction} />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.16),transparent)]"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Your matches
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Ranked by compatibility across route, schedule, budget, and reliability.
            </p>
          </div>
          <button
            type="button"
            onClick={handleHostAction}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create listing
          </button>
        </header>

        {/* Role Upgrade Alert Prompt */}
        {roleUpgradeNotice && (
          <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Host Role Required
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  You are currently signed in as a <span className="font-semibold">Traveler</span>. Upgrade to <span className="font-semibold">Host</span> to publish carpools, sports matches, or treks.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUpgradeToHost}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade to Host
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Success Banner */}
        {justCreated && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            Published "{justCreated.title}". It'll now show up in searches for matching riders.
          </div>
        )}

        {/* Listings Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mockListings.map((listing) => (
            <MatchCard key={listing.id} listing={listing} onMessageHost={setActiveChatListing} />
          ))}
        </div>
      </div>

      {/* Chat Drawer */}
      {activeChatListing && (
        <ChatDrawer
          open={Boolean(activeChatListing)}
          onClose={() => setActiveChatListing(null)}
          matchRequestId={activeChatListing.id}
          currentUserId={effectiveUserId}
          peer={{
            id: activeChatListing.host.id,
            name: activeChatListing.host.name,
            avatarUrl: activeChatListing.host.avatarUrl,
          }}
        />
      )}

      {/* Listing Creation Modal */}
      <ListingCreationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        hostId={effectiveUserId}
        onCreated={setJustCreated}
      />

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
        defaultRole={authDefaultRole}
      />
    </div>
  );
}
