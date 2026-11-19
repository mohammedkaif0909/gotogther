import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car,
  Clock,
  MapPin,
  Users,
  MessageCircle,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Phone,
  Mail,
  ArrowLeft,
  RefreshCw,
  KeyRound,
  Radio,
  Play,
  Check,
  Star,
  Flag,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import {
  fetchHostedRides,
  fetchJoinedRides,
  cancelListing,
  getOrCreateMatchRequest,
  updateRideStatus,
  checkInPassenger,
  submitReview,
  type HostedRide,
  type JoinedRide,
} from '../lib/api';
import { getSocket } from '../lib/socket';
import { ChatDrawer } from './ChatDrawer';
import { Navbar } from './Navbar';
import type { Role } from '../types/auth';

interface MyRidesPageProps {
  onBackToHome: () => void;
  onOpenAuth: (mode: 'login' | 'register', role?: Role) => void;
  onOpenCreateListing: () => void;
}

export function MyRidesPage({ onBackToHome, onOpenAuth, onOpenCreateListing }: MyRidesPageProps) {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'HOSTED' | 'JOINED'>('JOINED');
  const [hostedRides, setHostedRides] = useState<HostedRide[]>([]);
  const [joinedRides, setJoinedRides] = useState<JoinedRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stage 5 Live Trip & Boarding Verification State
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [checkingInBookingId, setCheckingInBookingId] = useState<string | null>(null);
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [telemetryBroadcasting, setTelemetryBroadcasting] = useState<Record<string, boolean>>({});
  const [liveTelemetry, setLiveTelemetry] = useState<Record<string, { lat: number; lng: number; speed?: number }>>({});
  const telemetryIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Reciprocal Review modal state
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    listingId: string;
    subjectId: string;
    subjectName: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  // Chat state
  const [activeChat, setActiveChat] = useState<{
    matchRequestId: string;
    peer: { id: string; name: string; avatarUrl?: string };
  } | null>(null);

  const loadRides = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('gotogether_token');

    try {
      const [hosted, joined] = await Promise.all([
        fetchHostedRides(token).catch((err) => {
          console.warn('Hosted rides fetch warning:', err);
          return [] as HostedRide[];
        }),
        fetchJoinedRides(token).catch((err) => {
          console.warn('Joined rides fetch warning:', err);
          return [] as JoinedRide[];
        }),
      ]);

      setHostedRides(hosted);
      setJoinedRides(joined);

      // If user is HOST and has hosted rides, default to HOSTED tab
      if (user?.role === 'HOST' && hosted.length > 0 && joined.length === 0) {
        setActiveTab('HOSTED');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRides();
  }, [user]);

  // Stage 5 Real-Time Event Sync via Socket.IO
  useEffect(() => {
    const socket = getSocket();

    const handleStatusUpdated = (data: { listingId: string; status: string }) => {
      setHostedRides((prev) =>
        prev.map((r) => (r.id === data.listingId ? { ...r, status: data.status } : r))
      );
      setJoinedRides((prev) =>
        prev.map((r) =>
          r.listing.id === data.listingId
            ? { ...r, listing: { ...r.listing, status: data.status } }
            : r
        )
      );
    };

    const handlePassengerCheckedIn = (data: { listingId: string; bookingId: string }) => {
      setHostedRides((prev) =>
        prev.map((r) =>
          r.id === data.listingId
            ? {
                ...r,
                bookings: r.bookings.map((b) =>
                  b.id === data.bookingId ? { ...b, isCheckedIn: true } : b
                ),
              }
            : r
        )
      );
      setJoinedRides((prev) =>
        prev.map((r) =>
          r.bookingId === data.bookingId ? { ...r, isCheckedIn: true } : r
        )
      );
    };

    socket.on('ride:status_updated', handleStatusUpdated);
    socket.on('passenger:checked_in', handlePassengerCheckedIn);

    // Listen for live GPS telemetry pings
    joinedRides.forEach((r) => {
      if (r.listing.status === 'IN_TRANSIT') {
        socket.on(`ride:telemetry:${r.listing.id}`, (telemetry: any) => {
          setLiveTelemetry((prev) => ({ ...prev, [r.listing.id]: telemetry }));
        });
      }
    });

    return () => {
      socket.off('ride:status_updated', handleStatusUpdated);
      socket.off('passenger:checked_in', handlePassengerCheckedIn);
    };
  }, [joinedRides]);

  // Stage 5 State Machine Transition
  const handleTransitionStatus = async (
    listingId: string,
    nextStatus: 'BOARDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'
  ) => {
    setTransitioningId(listingId);
    const token = localStorage.getItem('gotogether_token');
    try {
      await updateRideStatus(listingId, nextStatus, token);
      setHostedRides((prev) =>
        prev.map((r) => (r.id === listingId ? { ...r, status: nextStatus } : r))
      );

      if (nextStatus === 'COMPLETED') {
        if (telemetryIntervals.current[listingId]) {
          clearInterval(telemetryIntervals.current[listingId]);
          delete telemetryIntervals.current[listingId];
        }
        setTelemetryBroadcasting((prev) => ({ ...prev, [listingId]: false }));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update ride status');
    } finally {
      setTransitioningId(null);
    }
  };

  // Stage 5 Driver GPS Telemetry Broadcasting Simulator
  const handleToggleTelemetry = (
    listingId: string,
    originLat: number,
    originLng: number,
    destLat?: number | null,
    destLng?: number | null
  ) => {
    const isBroadcasting = telemetryBroadcasting[listingId];
    const socket = getSocket();

    if (isBroadcasting) {
      clearInterval(telemetryIntervals.current[listingId]);
      delete telemetryIntervals.current[listingId];
      setTelemetryBroadcasting((prev) => ({ ...prev, [listingId]: false }));
    } else {
      let progress = 0;
      const targetLat = destLat || originLat + 0.08;
      const targetLng = destLng || originLng + 0.08;

      const interval = setInterval(() => {
        progress = Math.min(1, progress + 0.05);
        const currentLat = originLat + (targetLat - originLat) * progress;
        const currentLng = originLng + (targetLng - originLng) * progress;
        const currentSpeed = Math.round(35 + Math.random() * 20);

        socket.emit('driver:telemetry_ping', {
          listingId,
          lat: currentLat,
          lng: currentLng,
          speed: currentSpeed,
        });

        if (progress >= 1) {
          clearInterval(telemetryIntervals.current[listingId]);
          delete telemetryIntervals.current[listingId];
          setTelemetryBroadcasting((prev) => ({ ...prev, [listingId]: false }));
        }
      }, 3000);

      telemetryIntervals.current[listingId] = interval;
      setTelemetryBroadcasting((prev) => ({ ...prev, [listingId]: true }));
    }
  };

  // Stage 5 Passenger PIN Verification by Driver
  const handleVerifyPin = async (listingId: string, bookingId: string) => {
    const pin = pinInputs[bookingId];
    if (!pin || pin.length !== 4) {
      alert('Please enter a valid 4-digit check-in PIN');
      return;
    }

    setCheckingInBookingId(bookingId);
    const token = localStorage.getItem('gotogether_token');
    try {
      await checkInPassenger(listingId, pin, token);
      setHostedRides((prev) =>
        prev.map((r) =>
          r.id === listingId
            ? {
                ...r,
                bookings: r.bookings.map((b) =>
                  b.id === bookingId ? { ...b, isCheckedIn: true } : b
                ),
              }
            : r
        )
      );
      setPinInputs((prev) => ({ ...prev, [bookingId]: '' }));
    } catch (err: any) {
      alert(err.message || 'Incorrect PIN or verification failure');
    } finally {
      setCheckingInBookingId(null);
    }
  };

  // Stage 5 Reciprocal Review Submission
  const handleReviewSubmit = async () => {
    if (!reviewModal) return;
    setSubmittingReview(true);
    const token = localStorage.getItem('gotogether_token');
    try {
      await submitReview(
        reviewModal.listingId,
        {
          subjectId: reviewModal.subjectId,
          rating: reviewRating,
          comment: reviewComment,
        },
        token
      );
      setReviewSuccessMsg('Review recorded! Thank you for rating.');
      setTimeout(() => {
        setReviewModal(null);
        setReviewSuccessMsg(null);
        setReviewComment('');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancel = async (listingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this ride? Booked passengers will be notified.')) {
      return;
    }

    setCancellingId(listingId);
    try {
      const token = localStorage.getItem('gotogether_token');
      await cancelListing(listingId, token);
      setHostedRides((prev) =>
        prev.map((r) => (r.id === listingId ? { ...r, status: 'CANCELLED' } : r))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not cancel listing');
    } finally {
      setCancellingId(null);
    }
  };

  const handleStartChatWithHost = async (ride: JoinedRide) => {
    try {
      const token = localStorage.getItem('gotogether_token');
      const res = await getOrCreateMatchRequest(ride.listing.id, user?.id, token);
      setActiveChat({
        matchRequestId: res.matchRequestId,
        peer: res.peer || ride.host,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start conversation with host');
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar
        onOpenAuth={onOpenAuth}
        onOpenCreateListing={onOpenCreateListing}
        onNavigateMyRides={() => {}}
        onNavigateHome={onBackToHome}
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="glass-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" />
            <span>Back to Live Rides</span>
          </button>

          <button
            type="button"
            onClick={loadRides}
            disabled={loading}
            className="glass-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Header */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-white">My Rides & Bookings</h1>
            <p className="mt-1 text-xs text-slate-400">
              Manage rides you have booked as a passenger or published as a verified host.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="glass-chip flex rounded-2xl p-1.5 border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('JOINED')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'JOINED'
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Joined Rides ({joinedRides.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HOSTED')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'HOSTED'
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Car className="h-4 w-4" />
              <span>Hosted Rides ({hostedRides.length})</span>
            </button>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/15 p-4 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-card animate-pulse rounded-3xl p-6 border-white/10"
              >
                <div className="h-5 w-48 rounded bg-white/10" />
                <div className="mt-3 h-4 w-72 rounded bg-white/5" />
                <div className="mt-5 flex gap-4">
                  <div className="h-10 w-28 rounded-xl bg-white/10" />
                  <div className="h-10 w-28 rounded-xl bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 1: RIDES I AM HOSTING */}
        {!loading && activeTab === 'HOSTED' && (
          <div className="mt-8 space-y-6">
            {hostedRides.map((ride) => {
              const occupancyPct = Math.min(
                100,
                Math.round((ride.seatsBooked / Math.max(1, ride.capacity)) * 100)
              );
              const isCancelled = ride.status === 'CANCELLED';

              return (
                <div
                  key={ride.id}
                  className="glass-card-hover rounded-3xl p-6 shadow-xl border-white/12"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="glass-chip rounded-full px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                          {ride.type}
                        </span>
                        <h2 className="text-lg font-extrabold text-white">{ride.title}</h2>
                        <span
                          className={`glass-chip rounded-full px-3 py-0.5 text-xs font-bold ${
                            isCancelled
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : ride.status === 'FULL'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {ride.status}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{ride.originLabel} {ride.destinationLabel ? `→ ${ride.destinationLabel}` : ''}</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="h-3.5 w-3.5 text-amber-400" />
                          {new Date(ride.departureTime).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        {ride.pricePerSeat && (
                          <span className="font-extrabold text-cyan-300">
                            {ride.currency} {ride.pricePerSeat} / seat
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stage 5 State Transition Controller */}
                    {!isCancelled && (
                      <div className="flex flex-wrap items-center gap-2">
                        {['OPEN', 'SCHEDULED', 'FULL'].includes(ride.status) && (
                          <button
                            type="button"
                            disabled={transitioningId === ride.id}
                            onClick={() => handleTransitionStatus(ride.id, 'BOARDING')}
                            className="glass-btn-amber inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                          >
                            {transitioningId === ride.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Users className="h-3.5 w-3.5" />
                            )}
                            <span>Start Boarding</span>
                          </button>
                        )}

                        {ride.status === 'BOARDING' && (
                          <button
                            type="button"
                            disabled={transitioningId === ride.id}
                            onClick={() => handleTransitionStatus(ride.id, 'IN_TRANSIT')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                          >
                            {transitioningId === ride.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                            <span>Depart / Start Ride</span>
                          </button>
                        )}

                        {ride.status === 'IN_TRANSIT' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleTelemetry(
                                  ride.id,
                                  ride.originLatitude ?? 12.9716,
                                  ride.originLongitude ?? 77.5946,
                                  ride.destinationLatitude,
                                  ride.destinationLongitude
                                )
                              }
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-md transition ${
                                telemetryBroadcasting[ride.id]
                                  ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                                  : 'glass-btn-secondary'
                              }`}
                            >
                              <Radio className="h-3.5 w-3.5 text-cyan-400" />
                              <span>
                                {telemetryBroadcasting[ride.id]
                                  ? 'Broadcasting GPS Telemetry'
                                  : 'Broadcast GPS Pings'}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={transitioningId === ride.id}
                              onClick={() => handleTransitionStatus(ride.id, 'COMPLETED')}
                              className="glass-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                            >
                              {transitioningId === ride.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Flag className="h-3.5 w-3.5" />
                              )}
                              <span>End Ride (Complete)</span>
                            </button>
                          </div>
                        )}

                        {ride.status === 'COMPLETED' && (
                          <span className="glass-chip inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-emerald-300 border-emerald-500/30 bg-emerald-500/15">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                          </span>
                        )}

                        {ride.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            disabled={cancellingId === ride.id}
                            onClick={() => handleCancel(ride.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25 disabled:opacity-50"
                          >
                            {cancellingId === ride.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Seat Occupancy Bar */}
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Seat Occupancy</span>
                      <span className="font-bold text-white">
                        {ride.seatsBooked} of {ride.capacity} seats reserved ({occupancyPct}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/5 border border-white/10 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          occupancyPct >= 100
                            ? 'bg-amber-400'
                            : occupancyPct > 0
                            ? 'bg-gradient-to-r from-sky-400 to-cyan-400'
                            : 'bg-white/10'
                        }`}
                        style={{ width: `${occupancyPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Booked Passengers Section */}
                  <div className="glass-card mt-5 rounded-2xl p-4 border-white/10 bg-white/[0.03]">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Booked Passengers ({ride.bookings?.length ?? 0})
                    </h3>

                    {ride.bookings && ride.bookings.length > 0 ? (
                      <div className="mt-3 divide-y divide-white/10">
                        {ride.bookings.map((b) => (
                          <div
                            key={b.id}
                            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                src={b.user.avatarUrl}
                                name={b.user.name}
                                size="md"
                              />
                              <div>
                                <p className="text-xs font-bold text-white">{b.user.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  {b.seats} seat(s) · Booked on{' '}
                                  {new Date(b.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              {b.isCheckedIn ? (
                                <span className="glass-chip inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border-emerald-500/30">
                                  <Check className="h-3 w-3" /> Checked In
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    maxLength={4}
                                    placeholder="4-digit PIN"
                                    value={pinInputs[b.id] ?? ''}
                                    onChange={(e) =>
                                      setPinInputs((prev) => ({
                                        ...prev,
                                        [b.id]: e.target.value.replace(/\D/g, ''),
                                      }))
                                    }
                                    className="glass-input w-28 rounded-xl px-2 py-1.5 text-center font-mono text-xs text-white uppercase placeholder-slate-500 outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      checkingInBookingId === b.id ||
                                      pinInputs[b.id]?.length !== 4
                                    }
                                    onClick={() => handleVerifyPin(ride.id, b.id)}
                                    className="glass-btn-primary rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                                  >
                                    {checkingInBookingId === b.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Verify PIN'
                                    )}
                                  </button>
                                </div>
                              )}

                              {b.user.phone && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-300">
                                  <Phone className="h-3 w-3 text-cyan-400" />
                                  {b.user.phone}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-[11px] text-slate-300">
                                <Mail className="h-3 w-3 text-cyan-400" />
                                {b.user.email}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400 italic">
                        No passengers have booked seats yet. Your listing is open for bookings.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {hostedRides.length === 0 && (
              <div className="glass-card rounded-3xl p-12 text-center border-white/12">
                <Car className="mx-auto h-12 w-12 text-slate-500" />
                <h3 className="mt-4 text-base font-bold text-white">You have not hosted any rides yet</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Publish a carpool or bike commute to share fuel costs and travel comfortably with co-riders.
                </p>
                <button
                  type="button"
                  onClick={onOpenCreateListing}
                  className="glass-btn-primary mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-xs font-bold"
                >
                  <Car className="h-4 w-4" />
                  <span>Host a Ride Now</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RIDES I HAVE JOINED */}
        {!loading && activeTab === 'JOINED' && (
          <div className="mt-8 space-y-6">
            {joinedRides.map((ride) => (
              <div
                key={ride.id}
                className="glass-card-hover rounded-3xl p-6 shadow-xl border-white/12"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="glass-chip rounded-full px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                        {ride.listing.type}
                      </span>
                      <h2 className="text-lg font-extrabold text-white">{ride.listing.title}</h2>
                      <span className="glass-chip inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        {ride.bookingStatus || 'CONFIRMED'}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                        <span>{ride.listing.originLabel}{' '}
                        {ride.listing.destinationLabel ? `→ ${ride.listing.destinationLabel}` : ''}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        {new Date(ride.listing.departureTime).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      {ride.listing.pricePerSeat && (
                        <span className="font-extrabold text-cyan-300">
                          {ride.listing.currency} {ride.listing.pricePerSeat} / seat ({ride.seatsBooked} seat(s) booked)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chat With Host Button */}
                  <button
                    type="button"
                    onClick={() => handleStartChatWithHost(ride)}
                    className="glass-btn-primary inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Chat with Host</span>
                  </button>
                </div>

                {/* Host Contact Box */}
                <div className="glass-card mt-5 flex items-center justify-between rounded-2xl p-4 border-white/10 bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={ride.host.avatarUrl}
                      name={ride.host.name}
                      size="lg"
                      verified
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{ride.host.name} (Host)</p>
                      <p className="text-[11px] text-slate-400">
                        {ride.host.ratingAvg ? `${ride.host.ratingAvg.toFixed(1)} ★` : 'Verified Host'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
                    {ride.host.phone && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-300">
                        <Phone className="h-3 w-3 text-cyan-400" />
                        {ride.host.phone}
                      </span>
                    )}
                    {ride.host.email && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-300">
                        <Mail className="h-3 w-3 text-cyan-400" />
                        {ride.host.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage 5: Passenger 4-Digit Boarding PIN Capsule */}
                {ride.checkInPin && (
                  <div className="glass-card mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl p-4 border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-cyan-300 font-bold uppercase tracking-wider">Your 4-Digit Boarding PIN</p>
                        <p className="font-mono text-2xl font-extrabold tracking-widest text-white drop-shadow-sm">
                          {ride.checkInPin}
                        </p>
                        <p className="text-[10px] text-slate-300">
                          Present this PIN to your driver upon pickup to verify your seat
                        </p>
                      </div>
                    </div>
                    <div>
                      {ride.isCheckedIn ? (
                        <span className="glass-chip inline-flex items-center gap-1.5 rounded-full bg-emerald-500/25 px-3 py-1 text-xs font-bold text-emerald-300 border-emerald-500/40">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Checked In & Boarded
                        </span>
                      ) : (
                        <span className="glass-chip inline-flex items-center gap-1.5 rounded-full bg-amber-500/25 px-3 py-1 text-xs font-bold text-amber-300 border-amber-500/40">
                          <Clock className="h-3.5 w-3.5" /> Awaiting Pickup
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Stage 5: Live In-Transit Telemetry Widget */}
                {ride.listing.status === 'IN_TRANSIT' && (
                  <div className="glass-card mt-3 flex items-center justify-between rounded-2xl p-3.5 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                      </span>
                      <div>
                        <p className="text-xs font-bold text-emerald-300">Live Driver Telemetry Active</p>
                        <p className="text-[11px] text-slate-300">
                          {liveTelemetry[ride.listing.id]
                            ? `GPS: ${liveTelemetry[ride.listing.id].lat.toFixed(4)}, ${liveTelemetry[ride.listing.id].lng.toFixed(4)} · Speed: ${liveTelemetry[ride.listing.id].speed ?? 42} km/h`
                            : 'Awaiting telemetry coordinate stream from driver vehicle...'}
                        </p>
                      </div>
                    </div>
                    <span className="glass-chip rounded-xl px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-300 border-emerald-500/30">
                      IN TRANSIT
                    </span>
                  </div>
                )}

                {/* Stage 5: Reciprocal Review & Rating Prompt */}
                {ride.listing.status === 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() =>
                      setReviewModal({
                        open: true,
                        listingId: ride.listing.id,
                        subjectId: ride.host.id,
                        subjectName: ride.host.name,
                      })
                    }
                    className="glass-btn-amber mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold"
                  >
                    <Star className="h-4 w-4 text-white fill-white" />
                    <span>Rate Your Completed Trip with {ride.host.name}</span>
                  </button>
                )}
              </div>
            ))}

            {joinedRides.length === 0 && (
              <div className="glass-card rounded-3xl p-12 text-center border-white/12">
                <Users className="mx-auto h-12 w-12 text-slate-500" />
                <h3 className="mt-4 text-base font-bold text-white">You haven't joined any rides yet</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Browse real-time carpools and bike pillion rides in your city and book your seat with a single tap.
                </p>
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="glass-btn-primary mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-xs font-bold"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Browse Live Rides</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Stage 5: Reciprocal Review & Rating Modal */}
      <AnimatePresence>
        {reviewModal?.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-modal w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/15 text-white"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                  <h3 className="text-base font-bold text-white">Rate Your Experience</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-300">
                  How was your commute with <span className="font-bold text-cyan-300">{reviewModal.subjectName}</span>?
                </p>

                {/* Star Rating Selector */}
                <div className="mt-5 flex items-center justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 transition hover:scale-115"
                    >
                      <Star
                        className={`h-8 w-8 transition ${
                          star <= reviewRating
                            ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Feedback & Comments (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Punctual, safe driving, clean car..."
                    className="glass-input w-full rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 outline-none"
                  />
                </div>

                {reviewSuccessMsg && (
                  <p className="mt-3 text-xs font-bold text-emerald-400 text-center">
                    {reviewSuccessMsg}
                  </p>
                )}

                <div className="mt-6 flex gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setReviewModal(null)}
                    className="glass-btn-secondary flex-1 rounded-2xl py-2.5 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingReview}
                    onClick={handleReviewSubmit}
                    className="glass-btn-primary flex-1 rounded-2xl py-2.5 text-xs font-bold disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Rating'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time Socket.IO Chat Drawer */}
      {activeChat && (
        <ChatDrawer
          open={Boolean(activeChat)}
          onClose={() => setActiveChat(null)}
          matchRequestId={activeChat.matchRequestId}
          currentUserId={user?.id ?? 'demo-current-user'}
          peer={activeChat.peer}
        />
      )}
    </div>
  );
}
