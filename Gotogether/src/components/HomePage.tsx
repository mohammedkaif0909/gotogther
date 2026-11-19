import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Car,
  Plus,
  ShieldCheck,
  Zap,
  Users,
  Search,
  MapPin,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Filter,
  Star,
  ChevronRight,
  ChevronDown,
  Loader2,
  Calendar,
  AlertCircle,
  RefreshCw,
  X,
  Sliders,
  HelpCircle,
  Lock,
  KeyRound,
  Fuel,
  CreditCard,
  Leaf,
  Radio,
  MessageSquare,
  ShieldAlert,
  Smartphone,
  BadgeCheck,
} from 'lucide-react';
import { MatchCard } from './MatchCard';
import { ChatDrawer } from './ChatDrawer';
import { ListingCreationModal } from './ListingCreationModal';
import { AuthModal } from './AuthModal';
import { Navbar } from './Navbar';
import { MyRidesPage } from './MyRidesPage';
import { MatchScoreBadge } from './MatchScoreBadge';
import { useAuth } from '../context/AuthContext';
import { getProfessionalAvatarUrl } from '../utils/avatar';
import type { MatchListing } from '../types/matching';
import {
  searchListings,
  bookSeat,
  getOrCreateMatchRequest,
  type CreatedListing,
} from '../lib/api';
import type { Role } from '../types/auth';

const DEMO_FALLBACK_USER_ID = 'demo-current-user';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    category: 'Booking & Payment',
    question: 'How does seat booking and fuel cost splitting work?',
    answer:
      'Hosts list their routine commutes (Car or Bike) and set a transparent, nominal cost per seat to split direct fuel and toll expenses. Passengers can browse available routes and reserve a seat instantly with zero middleman markups. Fuel contributions are settled directly between co-travelers.',
  },
  {
    category: 'Safety & Verification',
    question: 'How does GoTogether verify drivers and passengers?',
    answer:
      'Community trust is our core foundation. Every host must submit their Government Driving License and identity documents before publishing a vehicle listing. Additionally, users can verify their corporate or university email addresses to unlock exclusive verified campus and tech park carpools.',
  },
  {
    category: 'Safety & Verification',
    question: 'What is the 4-Digit Boarding PIN and why is it needed?',
    answer:
      'Whenever a passenger confirms a seat booking, a unique, encrypted 4-digit PIN is generated on their "My Rides" dashboard. When the driver arrives at the designated pickup point, the passenger presents this PIN. The driver validates it inside the app before departure to ensure the right passenger boards the right vehicle.',
  },
  {
    category: 'Preferences & Comfort',
    question: 'Can female travelers filter for women-only rides?',
    answer:
      'Yes! Female hosts can designate their ride as "Women Only", and travelers can apply gender preference filters in the search bar. This ensures comfortable, respectful, and safe commuting environments for everyone.',
  },
  {
    category: 'Technology',
    question: 'How does the 7-Dimension Matching Engine calculate match scores?',
    answer:
      'Our intelligent heuristic matching engine evaluates seven distinct parameters: Route Proximity (GPS origin & destination coordinate distance), Schedule Overlap, Budget Alignment, Activity & Pace Fit, Host Reliability history, Social Preferences, and Identity Verification status. Rides with an 85%+ score indicate top-tier compatibility.',
  },
  {
    category: 'Vehicles',
    question: 'Can I offer motorcycle rides as well as carpools?',
    answer:
      'Absolutely! GoTogether supports both Car Commutes (sedans, hatchbacks, EVs) and Bike Rides (pillion). Bike rides are an exceptional way for solo commuters to bypass gridlock traffic swiftly while splitting fuel costs.',
  },
  {
    category: 'Changes & Cancellations',
    question: 'What happens if plans change or a trip is cancelled?',
    answer:
      'Both hosts and passengers can cancel or update trips directly from the "My Rides" page. Our real-time WebSocket infrastructure immediately notifies the other party, and seats are promptly made available to other commuters on the route.',
  },
];

export default function HomePage() {
  const { user, isAuthenticated, switchRole } = useAuth();
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CAR' | 'BIKE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);
  const [departureDate, setDepartureDate] = useState<string>('');

  // View state: 'HOME' vs 'MY_RIDES'
  const [viewMyRides, setViewMyRides] = useState(false);

  // How It Works Tab: 'PASSENGER' vs 'HOST'
  const [howItWorksTab, setHowItWorksTab] = useState<'PASSENGER' | 'HOST'>('PASSENGER');

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Dynamic database listings state
  const [listings, setListings] = useState<MatchListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Interactive Demo Score Calculator state
  const [calcDistance, setCalcDistance] = useState<number>(3);
  const [calcBudgetMatch, setCalcBudgetMatch] = useState<number>(90);
  const [calcPaceMatch, setCalcPaceMatch] = useState<number>(85);

  const calculatedScore = Math.round(
    ((15 - calcDistance) / 15) * 35 + (calcBudgetMatch / 100) * 35 + (calcPaceMatch / 100) * 30
  );

  // Chat drawer state with real MatchRequest ID
  const [activeChat, setActiveChat] = useState<{
    matchRequestId: string;
    peer: { id: string; name: string; avatarUrl?: string };
  } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedListing | null>(null);
  const [bookingAlert, setBookingAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auth modal states
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authDefaultRole, setAuthDefaultRole] = useState<Role>('TRAVELER');

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const scrollToRides = () => {
    const el = document.getElementById('live-rides-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDebouncedQuery(searchQuery.trim());
    scrollToRides();
  };

  const handleQuickRouteSelect = (route: string) => {
    setSearchQuery(route);
    setDebouncedQuery(route);
    scrollToRides();
  };

  // Fetch dynamic listings from GET /api/listings/search
  const loadListings = async () => {
    setLoading(true);
    setSearchError(null);
    try {
      const results = await searchListings({
        type: activeCategory,
        q: debouncedQuery,
        maxBudget,
        earliestDeparture: departureDate || undefined,
      });

      const formatted: MatchListing[] = results.map((r: any) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        originLabel: r.originLabel,
        destinationLabel: r.destinationLabel,
        departureTime: r.departureTime,
        distanceKm: r.distanceKm ?? 2.5,
        pricePerSeat: r.pricePerSeat,
        currency: r.currency ?? '₹',
        capacity: r.capacity ?? 3,
        seatsBooked: r.seatsBooked ?? 0,
        status: r.status ?? 'OPEN',
        tags: Array.isArray(r.tags) ? r.tags : [],
        subScores: r.subScores ?? [],
        host: {
          id: r.host?.id ?? 'host-placeholder',
          name: r.host?.name ?? 'Verified Host',
          avatarUrl: getProfessionalAvatarUrl(
            r.host?.avatarUrl,
            r.host?.name ?? 'Verified Host'
          ),
          rating: r.host?.rating ?? 4.8,
          tripsCompleted: r.host?.tripsCompleted ?? 12,
          verified: r.host?.verified ?? true,
        },
      }));

      setListings(formatted);
    } catch (err: any) {
      console.warn('Listing fetch error:', err);
      setSearchError(err.message || 'Could not fetch rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, [activeCategory, debouncedQuery, maxBudget, departureDate]);

  const handleListingCreated = (created: CreatedListing) => {
    setJustCreated(created);
    loadListings();
    setTimeout(() => setJustCreated(null), 8000);
  };

  const handleOpenAuth = (mode: 'login' | 'register', role: Role = 'TRAVELER') => {
    setAuthMode(mode);
    setAuthDefaultRole(role);
    setAuthModalOpen(true);
  };

  const handleHostAction = async () => {
    if (!isAuthenticated || !user) {
      handleOpenAuth('register', 'HOST');
      return;
    }

    if (user.role === 'TRAVELER') {
      try {
        await switchRole('HOST');
      } catch (err) {
        console.warn('Auto-switching role to HOST for ride creation:', err);
      }
    }

    setCreateOpen(true);
  };

  const effectiveUserId = user?.id ?? DEMO_FALLBACK_USER_ID;

  // Book seat handler
  const handleBookSeat = async (listing: MatchListing) => {
    const token = localStorage.getItem('gotogether_token');
    try {
      const res = await bookSeat(listing.id, 1, token);
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? {
                ...l,
                seatsBooked: res.seatsBooked,
                capacity: res.capacity,
                status: res.status,
              }
            : l
        )
      );
      const remaining = Math.max(0, res.capacity - res.seatsBooked);
      setBookingAlert({
        type: 'success',
        message: `Seat booked successfully on "${listing.title}"! (${remaining} seat${remaining === 1 ? '' : 's'} remaining)`,
      });
      setTimeout(() => setBookingAlert(null), 5000);
    } catch (err: any) {
      setBookingAlert({
        type: 'error',
        message: err.message || 'Could not book seat',
      });
      setTimeout(() => setBookingAlert(null), 5000);
      throw err;
    }
  };

  const handleStartConversation = async (listing: MatchListing) => {
    try {
      const token = localStorage.getItem('gotogether_token');
      const res = await getOrCreateMatchRequest(listing.id, effectiveUserId, token);
      setActiveChat({
        matchRequestId: res.matchRequestId,
        peer: res.peer || {
          id: listing.host.id,
          name: listing.host.name,
          avatarUrl: listing.host.avatarUrl,
        },
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not start conversation');
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[#F9FAFB] font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative">
      {/* View routing: Home vs My Rides */}
      {viewMyRides ? (
        <MyRidesPage
          onBackToHome={() => setViewMyRides(false)}
          onOpenAuth={handleOpenAuth}
          onOpenCreateListing={handleHostAction}
        />
      ) : (
        <>
          <Navbar
            onOpenAuth={handleOpenAuth}
            onOpenCreateListing={handleHostAction}
            onNavigateMyRides={() => setViewMyRides(true)}
            onNavigateHome={() => setViewMyRides(false)}
          />

          {/* =========================================================================
              HERO SECTION
              ========================================================================= */}
          <section className="relative overflow-hidden pt-10 pb-20 lg:pt-16 lg:pb-28">
            {/* Ambient Frosted Glow Meshes */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[650px] w-[1100px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.18),rgba(6,182,212,0.12),transparent_70%)] blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/3 -left-40 -z-10 h-[500px] w-[500px] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_70%)] blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-[-10%] -z-10 h-[450px] w-[450px] bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1),transparent_70%)] blur-3xl"
            />

            <div className="relative mx-auto max-w-6xl px-6">
              <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
                {/* Hero Left Content */}
                <div className="lg:col-span-7">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  >
                    <Compass className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Smart City Commutes & Ridesharing Network</span>
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.12]"
                  >
                    Commute Smarter. <br />
                    <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent drop-shadow-sm">
                      Share the Ride & Split Costs.
                    </span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mt-6 max-w-xl text-base text-slate-300 sm:text-lg leading-relaxed"
                  >
                    Connect with verified carpool hosts and bike riders traveling your way. Cut monthly fuel expenses by up to 70%, bypass daily traffic, and ride comfortably.
                  </motion.p>

                  {/* Frosted Floating Search & Host Capsule */}
                  <motion.form
                    onSubmit={handleSearchSubmit}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="glass-card mt-8 p-3 shadow-2xl border-white/15 flex flex-col sm:flex-row sm:items-center gap-2.5"
                  >
                    <div className="glass-input flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-xs sm:text-sm border-white/10">
                      <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search pickup, destination, or tech park (e.g. Koramangala, Manyata)..."
                        className="w-full bg-transparent text-white placeholder-slate-400 outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setDebouncedQuery('');
                          }}
                          className="text-slate-400 hover:text-white p-0.5"
                          title="Clear search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="glass-btn-primary flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-cyan-500/25 active:scale-95 transition"
                      >
                        <Search className="h-4 w-4" />
                        <span>Search Rides</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleHostAction}
                        className="glass-btn-secondary flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold border-white/15 hover:border-cyan-500/40 active:scale-95 transition"
                      >
                        <Plus className="h-4 w-4 text-cyan-400" />
                        <span className="whitespace-nowrap">Host a Ride</span>
                      </button>
                    </div>
                  </motion.form>

                  {/* Popular Route Fast Chips */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[11px] font-medium text-slate-400">Popular routes:</span>
                    {['Koramangala', 'Manyata Tech Park', 'Electronic City', 'HSR Layout', 'Indiranagar'].map((hub) => (
                      <button
                        key={hub}
                        type="button"
                        onClick={() => handleQuickRouteSelect(hub)}
                        className={`glass-chip rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          searchQuery.toLowerCase() === hub.toLowerCase()
                            ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                            : 'text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
                        }`}
                      >
                        {hub}
                      </button>
                    ))}
                  </div>

                  {/* Real Platform Pillars (Replacing fake ratings & numbers) */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-6"
                  >
                    <div className="glass-card flex items-center gap-3 p-3.5 rounded-2xl border-white/10 bg-white/[0.02]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">Verified ID & DL</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Government ID checked</p>
                      </div>
                    </div>

                    <div className="glass-card flex items-center gap-3 p-3.5 rounded-2xl border-white/10 bg-white/[0.02]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">4-Digit Boarding PIN</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Safe pickup check-in</p>
                      </div>
                    </div>

                    <div className="glass-card flex items-center gap-3 p-3.5 rounded-2xl border-white/10 bg-white/[0.02]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Fuel className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">Split Fuel 100%</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Zero platform surcharge</p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Hero Right Visual Showcase: Authentic Commute Visual with Live Overlay Elements */}
                <div className="lg:col-span-5">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="relative mx-auto max-w-md lg:max-w-none"
                  >
                    <div className="glass-card-hover group relative overflow-hidden rounded-3xl p-0 border-white/15 shadow-2xl">
                      <div className="relative h-80 sm:h-96 overflow-hidden">
                        {/* High-res authentic image of modern commuters traveling together */}
                        <img
                          src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80"
                          alt="Modern Carpool Commute"
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/30 to-transparent" />

                        {/* Floating Feature Badges */}
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-emerald-300 border-emerald-500/30 bg-emerald-500/20 shadow-lg backdrop-blur-md">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified Community
                          </span>
                        </div>

                        <div className="absolute top-4 right-4">
                          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/20 shadow-lg backdrop-blur-md">
                            <Radio className="h-3.5 w-3.5 text-cyan-300 animate-pulse" /> Live GPS Route
                          </span>
                        </div>

                        {/* Floating Interactive Micro-Card at bottom */}
                        <div className="absolute bottom-4 inset-x-4">
                          <div className="glass-card rounded-2xl p-4 border-white/15 bg-white/[0.08] backdrop-blur-xl shadow-xl">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md">
                                  <Car className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white">Direct Commute Match</p>
                                  <p className="text-[11px] text-slate-300">Office & Tech Park Corridors</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={scrollToRides}
                                className="glass-btn-primary rounded-xl px-3 py-1.5 text-xs font-bold"
                              >
                                View Rides
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
              HOW TO USE THIS APP ("HOW IT WORKS" SECTION)
              ========================================================================= */}
          <section className="py-16 border-t border-white/10 bg-white/[0.01]">
            <div className="mx-auto max-w-6xl px-6">
              <div className="text-center">
                <span className="glass-chip rounded-full px-3 py-1 text-xs font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                  Step-by-Step Guide
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  How GoTogether Works
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                  Whether you are seeking an affordable ride or driving with empty seats, getting started takes just two minutes.
                </p>

                {/* Role Switcher Pill */}
                <div className="mt-8 inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setHowItWorksTab('PASSENGER')}
                    className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition ${
                      howItWorksTab === 'PASSENGER'
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>For Passengers (Riders)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHowItWorksTab('HOST')}
                    className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition ${
                      howItWorksTab === 'HOST'
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Car className="h-4 w-4" />
                    <span>For Hosts (Drivers)</span>
                  </button>
                </div>
              </div>

              {/* Steps Grid */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                {howItWorksTab === 'PASSENGER' ? (
                  <>
                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            <Search className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">01</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">Search Your Route</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Enter your pickup landmark, office destination, and approximate travel timing to scan live listings.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-cyan-300 font-semibold flex items-center gap-1">
                        Car or Bike filters <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                            <Sparkles className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">02</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">View 7D Match Score</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Compare compatibility scores computed using distance proximity, schedule fit, and verified host reliability.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-indigo-300 font-semibold flex items-center gap-1">
                        Instant breakdown <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            <MessageSquare className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">03</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">Book & Chat</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Reserve your seat with one tap. Message your host directly in the encrypted chat room to coordinate exact pickup spots.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-sky-300 font-semibold flex items-center gap-1">
                        Zero commission fee <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <KeyRound className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">04</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">Board with PIN</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Receive your secure 4-digit check-in PIN in "My Rides". Present it to the host on pickup to confirm your seat safely.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                        Safe journey verified <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            <MapPin className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">01</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">Publish Your Route</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Input your starting point, destination, departure time, and vehicle type (Car with AC or swift Bike ride).
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-cyan-300 font-semibold flex items-center gap-1">
                        Takes under 60 seconds <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Fuel className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">02</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">Set Fuel Contribution</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Specify a fair seat cost to recover your fuel and toll charges. You keep 100% of contributions with zero deductions.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                        Split expenses easily <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                            <Users className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">03</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">Review Co-Travelers</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Accept passengers from your college or corporate neighborhood. Coordinate easily using real-time room chat.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-indigo-300 font-semibold flex items-center gap-1">
                        Total passenger control <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="glass-card-hover rounded-3xl p-6 relative border-white/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Radio className="h-6 w-6" />
                          </div>
                          <span className="text-2xl font-black text-white/20">04</span>
                        </div>
                        <h3 className="mt-5 text-base font-bold text-white">Validate PIN & Drive</h3>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                          Verify passenger 4-digit PINs at boarding, stream real-time GPS telemetry, and conclude the ride when you reach.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                        Tracked & verified trip <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* =========================================================================
              WHY CHOOSE GOTOGETHER (CORE VALUE PROPOSITION)
              ========================================================================= */}
          <section className="py-16">
            <div className="mx-auto max-w-6xl px-6">
              <div className="text-center">
                <span className="glass-chip rounded-full px-3 py-1 text-xs font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                  Built for Commuters
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Why Commuters Love GoTogether
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                  A modern ridesharing platform tailored for daily tech workers, students, and intercity travelers.
                </p>
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card-hover rounded-3xl p-6 border-white/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-white">Save Up to 70% Monthly</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Cut recurring cab and fuel costs drastically by splitting rides with travelers heading in the exact same direction.
                  </p>
                </div>

                <div className="glass-card-hover rounded-3xl p-6 border-white/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Leaf className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-white">Eco-Friendly Travel</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Reduce carbon emissions and urban traffic bottlenecks by converting empty passenger seats into shared commute solutions.
                  </p>
                </div>

                <div className="glass-card-hover rounded-3xl p-6 border-white/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-white">Verified Peer Circles</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Ride with authenticated members from your tech corridor or university. Government ID verification ensures total peace of mind.
                  </p>
                </div>

                <div className="glass-card-hover rounded-3xl p-6 border-white/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Radio className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-white">Real-Time GPS Tracking</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    In-transit telemetry streaming keeps riders and emergency contacts informed of the vehicle location throughout the journey.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
              INTERACTIVE 7-DIMENSION ALGORITHM SIMULATOR
              ========================================================================= */}
          <section className="mx-auto max-w-6xl px-6 py-6">
            <div className="glass-card rounded-3xl p-6 sm:p-8 border-white/15 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-cyan-400" />
                    <h2 className="text-xl font-extrabold text-white">7-Dimension Matching Engine</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Test how our heuristic matching algorithm dynamically ranks rides based on proximity, budget fit, and schedule overlap.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Calculated Compatibility</p>
                    <p className="text-xl font-extrabold text-cyan-300">{calculatedScore}%</p>
                  </div>
                  <MatchScoreBadge score={calculatedScore} size="lg" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Route Proximity</span>
                    <span className="text-cyan-400">{calcDistance} km away</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={calcDistance}
                    onChange={(e) => setCalcDistance(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">Closer origin points give higher ranking scores.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Budget Fit</span>
                    <span className="text-cyan-400">{calcBudgetMatch}% alignment</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={calcBudgetMatch}
                    onChange={(e) => setCalcBudgetMatch(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">Fare matches within preferred passenger range.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Schedule Overlap</span>
                    <span className="text-cyan-400">{calcPaceMatch}% match</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={calcPaceMatch}
                    onChange={(e) => setCalcPaceMatch(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">Alignment on departure timing and arrival margins.</p>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
              LIVE VEHICLE MATCHES SECTION
              ========================================================================= */}
          <section id="live-rides-section" className="mx-auto max-w-6xl px-6 py-12 scroll-mt-24">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Live Vehicle Matches</h2>
                  <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                    {listings.length} {listings.length === 1 ? 'ride' : 'rides'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Real-time rides retrieved directly from database and ranked by compatibility score.
                </p>
                {debouncedQuery && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Results for:</span>
                    <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                      "{debouncedQuery}"
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setDebouncedQuery('');
                        }}
                        className="hover:text-white transition"
                        title="Clear filter"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="glass-chip flex items-center gap-1.5 rounded-2xl p-1 border-white/10">
                  {(['ALL', 'CAR', 'BIKE'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                        activeCategory === cat
                          ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat === 'CAR' ? 'Cars' : cat === 'BIKE' ? 'Bikes' : 'All'}
                    </button>
                  ))}
                </div>

                {/* Budget Filter */}
                <select
                  value={maxBudget ?? ''}
                  onChange={(e) => setMaxBudget(e.target.value ? Number(e.target.value) : undefined)}
                  className="glass-input rounded-2xl px-3.5 py-2 text-xs font-semibold text-slate-200 outline-none"
                >
                  <option value="" className="bg-slate-900 text-white">Any Budget</option>
                  <option value="60" className="bg-slate-900 text-white">Under ₹60</option>
                  <option value="100" className="bg-slate-900 text-white">Under ₹100</option>
                  <option value="200" className="bg-slate-900 text-white">Under ₹200</option>
                  <option value="500" className="bg-slate-900 text-white">Under ₹500</option>
                </select>
              </div>
            </div>

            {/* Success Alert */}
            {justCreated && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-xs text-emerald-300">
                Published "{justCreated.title}". It is now ranked in the live search matches!
              </div>
            )}

            {/* Booking Notification Alert */}
            {bookingAlert && (
              <div
                className={`mt-6 rounded-2xl border px-4 py-3 text-xs flex items-center justify-between ${
                  bookingAlert.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                }`}
              >
                <span>{bookingAlert.message}</span>
                <button
                  type="button"
                  onClick={() => setBookingAlert(null)}
                  className="text-xs font-bold underline hover:text-white ml-3 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Error State */}
            {searchError && (
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/15 p-4 text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{searchError}</span>
                </div>
                <button
                  type="button"
                  onClick={loadListings}
                  className="flex items-center gap-1 font-bold underline hover:text-white ml-3"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {loading && (
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="glass-card animate-pulse flex flex-col gap-4 p-5 rounded-3xl border-white/10"
                  >
                    <div className="flex justify-between">
                      <div className="h-6 w-20 rounded-full bg-white/10" />
                      <div className="h-6 w-16 rounded-full bg-white/10" />
                    </div>
                    <div className="h-5 w-3/4 rounded-lg bg-white/10" />
                    <div className="h-4 w-1/2 rounded-lg bg-white/5" />
                    <div className="h-16 rounded-2xl bg-white/5" />
                    <div className="mt-2 flex gap-2">
                      <div className="h-9 flex-1 rounded-xl bg-white/10" />
                      <div className="h-9 flex-1 rounded-xl bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cards Grid */}
            {!loading && (
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <MatchCard
                    key={listing.id}
                    listing={listing}
                    onMessageHost={handleStartConversation}
                    onBookSeat={handleBookSeat}
                  />
                ))}
              </div>
            )}

            {/* Empty Search Results */}
            {!loading && listings.length === 0 && !searchError && (
              <div className="glass-card mt-12 rounded-3xl p-12 text-center border-white/12">
                <Filter className="mx-auto h-10 w-10 text-slate-500" />
                <h3 className="mt-3 text-base font-bold text-white">No matching vehicle rides found</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                  We couldn't find any open rides matching "{debouncedQuery || activeCategory}". Try searching for major routes or clear filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('ALL');
                    setMaxBudget(undefined);
                  }}
                  className="glass-btn-secondary mt-5 inline-flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-xs font-bold"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </section>

          {/* =========================================================================
              FREQUENTLY ASKED QUESTIONS (FAQ SECTION)
              ========================================================================= */}
          <section className="py-16 border-t border-white/10">
            <div className="mx-auto max-w-4xl px-6">
              <div className="text-center">
                <span className="glass-chip rounded-full px-3 py-1 text-xs font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                  Got Questions?
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Frequently Asked Questions
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                  Everything you need to know about booking, hosting, safety PINs, and verified community carpools.
                </p>
              </div>

              <div className="mt-10 space-y-3">
                {FAQ_DATA.map((faq, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div
                      key={index}
                      className="glass-card rounded-2xl border-white/10 overflow-hidden transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="flex w-full items-center justify-between p-5 text-left transition hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-3 pr-4">
                          <HelpCircle className="h-4 w-4 shrink-0 text-cyan-400" />
                          <span className="text-sm font-bold text-white">{faq.question}</span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${
                            isOpen ? 'rotate-180 text-cyan-400' : ''
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                          >
                            <div className="px-5 pb-5 pt-1 text-xs text-slate-300 leading-relaxed border-t border-white/5">
                              {faq.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* =========================================================================
              BOTTOM CALL-TO-ACTION (CTA) BANNER
              ========================================================================= */}
          <section className="mx-auto max-w-6xl px-6 py-12">
            <div className="glass-card relative overflow-hidden rounded-3xl p-8 sm:p-12 border-white/15 shadow-2xl text-center bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-emerald-500/10">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-64 w-96 -translate-x-1/2 bg-cyan-500/20 blur-3xl"
              />

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/30">
                <Compass className="h-7 w-7" />
              </div>

              <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold text-white">
                Ready to Transform Your Daily Commute?
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Join thousands of verified commuters saving fuel, meeting great co-riders, and beating peak rush hours every single day.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={scrollToRides}
                  className="glass-btn-primary w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-bold"
                >
                  <Search className="h-4 w-4" />
                  <span>Find a Ride Now</span>
                </button>

                <button
                  type="button"
                  onClick={handleHostAction}
                  className="glass-btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-bold"
                >
                  <Plus className="h-4 w-4 text-cyan-400" />
                  <span>Host a Ride (Car or Bike)</span>
                </button>
              </div>
            </div>
          </section>

          {/* =========================================================================
              PROFESSIONAL MODERN FOOTER
              ========================================================================= */}
          <footer className="border-t border-white/10 py-12 text-xs text-slate-400 glass-nav">
            <div className="mx-auto max-w-6xl px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md">
                      <Compass className="h-4 w-4" />
                    </div>
                    <span className="text-base font-extrabold text-white">GoTogether</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                    Peer-to-peer verified ridesharing network connecting commuters across university campuses and corporate tech parks.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white">Platform</p>
                  <ul className="mt-3 space-y-2">
                    <li>
                      <button type="button" onClick={scrollToRides} className="hover:text-cyan-300 transition">
                        Live Route Search
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={handleHostAction} className="hover:text-cyan-300 transition">
                        Publish a Commute
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => setHowItWorksTab('PASSENGER')} className="hover:text-cyan-300 transition">
                        Passenger Guide
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => setHowItWorksTab('HOST')} className="hover:text-cyan-300 transition">
                        Driver Guidelines
                      </button>
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white">Trust & Safety</p>
                  <ul className="mt-3 space-y-2">
                    <li className="flex items-center gap-1.5 text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" /> Government ID Verified
                    </li>
                    <li className="flex items-center gap-1.5 text-slate-300">
                      <KeyRound className="h-3.5 w-3.5 text-cyan-400" /> Contactless Boarding PIN
                    </li>
                    <li className="flex items-center gap-1.5 text-slate-300">
                      <Radio className="h-3.5 w-3.5 text-cyan-400" /> Live GPS Telemetry
                    </li>
                    <li className="flex items-center gap-1.5 text-slate-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> Encrypted Safety Chat
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white">Community</p>
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                    Available in major transit hubs. Zero platform commission on fuel splits.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="glass-chip rounded-full px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border-emerald-500/30 bg-emerald-500/10">
                      100% Direct Fuel Split
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-[11px] text-slate-500">© 2026 GoTogether Inc. All rights reserved.</p>
                <div className="flex items-center gap-6 text-[11px] text-slate-400">
                  <span className="hover:text-white cursor-pointer transition">Privacy Policy</span>
                  <span className="hover:text-white cursor-pointer transition">Terms of Service</span>
                  <span className="hover:text-white cursor-pointer transition">Community Guidelines</span>
                </div>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Real-time Socket.IO Chat Drawer with valid matchRequestId */}
      {activeChat && (
        <ChatDrawer
          open={Boolean(activeChat)}
          onClose={() => setActiveChat(null)}
          matchRequestId={activeChat.matchRequestId}
          currentUserId={effectiveUserId}
          peer={activeChat.peer}
        />
      )}

      <ListingCreationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        hostId={effectiveUserId}
        onCreated={handleListingCreated}
      />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
        defaultRole={authDefaultRole}
      />
    </div>
  );
}
