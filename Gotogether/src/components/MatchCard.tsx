import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Car,
  MapPin,
  Clock,
  Star,
  BadgeCheck,
  MessageCircle,
  ChevronRight,
  Ticket,
  Users,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { MatchListing } from '../types/matching';
import { computeOverallScore } from '../lib/scoring';
import { bookSeat } from '../lib/api';
import { MatchScoreBadge } from './MatchScoreBadge';
import { MatchBreakdownModal } from './MatchBreakdownModal';
import { UserAvatar } from './UserAvatar';

const TYPE_META: Record<string, { label: string; icon: typeof Car }> = {
  CAR: { label: 'Car Pool', icon: Car },
  BIKE: { label: 'Bike Ride', icon: Car },
  car: { label: 'Car Pool', icon: Car },
  bike: { label: 'Bike Ride', icon: Car },
  carpool: { label: 'Car Pool', icon: Car },
};

interface MatchCardProps {
  listing: MatchListing;
  /**
   * Called when the person taps "Message". This is the integration point for the
   * Socket.IO chat drawer.
   */
  onMessageHost?: (listing: MatchListing) => void;
  /**
   * Optional custom booking handler. If provided, parent can synchronize state.
   */
  onBookSeat?: (listing: MatchListing) => Promise<void> | void;
}

export function MatchCard({ listing, onMessageHost, onBookSeat }: MatchCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [justBooked, setJustBooked] = useState(false);

  const capacity = listing.capacity ?? 1;
  const [localSeatsBooked, setLocalSeatsBooked] = useState(listing.seatsBooked ?? 0);
  const [localStatus, setLocalStatus] = useState(listing.status ?? 'OPEN');

  useEffect(() => {
    if (listing.seatsBooked !== undefined) setLocalSeatsBooked(listing.seatsBooked);
    if (listing.status !== undefined) setLocalStatus(listing.status);
  }, [listing.seatsBooked, listing.status]);

  const availableSeats = Math.max(0, capacity - localSeatsBooked);
  const isFull = localStatus === 'FULL' || availableSeats <= 0;

  const handleBook = async () => {
    if (isFull || isBooking) return;
    setIsBooking(true);
    setBookingError(null);

    try {
      if (onBookSeat) {
        await onBookSeat(listing);
      } else {
        const res = await bookSeat(listing.id, 1);
        setLocalSeatsBooked(res.seatsBooked);
        setLocalStatus(res.status);
      }
      setJustBooked(true);
      setTimeout(() => setJustBooked(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not book seat';
      setBookingError(message);
    } finally {
      setIsBooking(false);
    }
  };

  const overallScore = computeOverallScore(listing.subScores);
  const typeMeta = TYPE_META[listing.type] ?? { label: 'Vehicle Ride', icon: Car };
  const TypeIcon = typeMeta.icon;

  const formattedTime = new Date(listing.departureTime).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <>
      <motion.article
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="glass-card-hover group flex flex-col gap-4 p-5"
      >
        {/* Top Meta Bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="glass-chip flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-slate-300">
            <TypeIcon className="h-3.5 w-3.5 text-cyan-400" />
            <span>{typeMeta.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {isFull ? (
              <span className="glass-chip inline-flex items-center gap-1 rounded-full bg-rose-500/15 border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                Full
              </span>
            ) : (
              <span className="glass-chip inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                <Users className="h-3 w-3" />
                {availableSeats} left
              </span>
            )}
            <MatchScoreBadge score={overallScore} />
          </div>
        </div>

        {/* Title & Route */}
        <div>
          <h3 className="text-base font-bold leading-snug text-white group-hover:text-cyan-300 transition-colors">
            {listing.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>{listing.originLabel}</span>
              {listing.destinationLabel && (
                <span className="text-slate-400 font-normal">→ {listing.destinationLabel}</span>
              )}
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Host Glass Capsule */}
        <div className="glass-card flex items-center gap-3 rounded-2xl p-3 border-white/10 bg-white/[0.03]">
          <UserAvatar
            src={listing.host.avatarUrl}
            name={listing.host.name}
            size="lg"
            verified={listing.host.verified}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-white">
                {listing.host.name}
              </p>
              {listing.host.verified && (
                <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">
                  Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>{listing.host.rating.toFixed(1)}</span>
              <span className="text-slate-500">·</span>
              <span>{listing.host.tripsCompleted} trips hosted</span>
            </div>
          </div>
          {typeof listing.pricePerSeat === 'number' && (
            <div className="text-right">
              <p className="shrink-0 text-base font-extrabold text-cyan-300">
                {listing.currency}
                {listing.pricePerSeat}
                <span className="text-[11px] font-normal text-slate-400"> / seat</span>
              </p>
              <p className="text-[10px] text-slate-400">
                {isFull ? 'No seats left' : `${availableSeats}/${capacity} open`}
              </p>
            </div>
          )}
        </div>

        {/* Tags */}
        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {listing.tags.map((tag) => (
              <span
                key={tag}
                className="glass-chip rounded-full px-2.5 py-0.5 text-[11px] font-medium text-cyan-200 border-cyan-500/20 bg-cyan-500/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {bookingError && (
          <div className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs text-rose-300 border border-rose-500/30">
            {bookingError}
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBreakdownOpen(true)}
            className="glass-btn-secondary flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold"
            title="View match breakdown"
          >
            <span>Details</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={() => onMessageHost?.(listing)}
            className="glass-chip flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 hover:border-cyan-500/40"
            title="Message host"
          >
            <MessageCircle className="h-3.5 w-3.5 text-cyan-400" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            disabled={isFull || isBooking}
            onClick={handleBook}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              isFull
                ? 'cursor-not-allowed bg-white/5 border border-white/10 text-slate-500'
                : justBooked
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'glass-btn-primary'
            }`}
          >
            {isBooking ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                <span>Booking...</span>
              </>
            ) : isFull ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Ride Full</span>
              </>
            ) : justBooked ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Booked!</span>
              </>
            ) : (
              <>
                <Ticket className="h-3.5 w-3.5" />
                <span>Book Seat</span>
              </>
            )}
          </button>
        </div>
      </motion.article>

      <MatchBreakdownModal
        listing={{
          ...listing,
          capacity,
          seatsBooked: localSeatsBooked,
          status: localStatus,
        }}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        onBookSeat={handleBook}
      />
    </>
  );
}
