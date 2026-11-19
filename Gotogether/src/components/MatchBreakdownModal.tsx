import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MapPin, Clock, Ticket, Loader2, CheckCircle2 } from 'lucide-react';
import type { MatchListing } from '../types/matching';
import { SUB_SCORE_META, computeOverallScore, getScoreTier, getTierStyle } from '../lib/scoring';
import { bookSeat } from '../lib/api';
import { ScoreMeter } from './ScoreMeter';
import { MatchScoreBadge } from './MatchScoreBadge';

interface MatchBreakdownModalProps {
  listing: MatchListing | null;
  open: boolean;
  onClose: () => void;
  onBookSeat?: (listing: MatchListing) => Promise<void> | void;
}

export function MatchBreakdownModal({ listing, open, onClose, onBookSeat }: MatchBreakdownModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setBooked(false);
      setBookingError(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!listing) return null;

  const capacity = listing.capacity ?? 1;
  const seatsBooked = listing.seatsBooked ?? 0;
  const availableSeats = Math.max(0, capacity - seatsBooked);
  const isFull = listing.status === 'FULL' || availableSeats <= 0;

  const handleBook = async () => {
    if (isFull || isBooking) return;
    setIsBooking(true);
    setBookingError(null);
    try {
      if (onBookSeat) {
        await onBookSeat(listing);
      } else {
        await bookSeat(listing.id, 1);
      }
      setBooked(true);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Failed to book seat');
    } finally {
      setIsBooking(false);
    }
  };

  const overallScore = computeOverallScore(listing.subScores);
  const tier = getScoreTier(overallScore);
  const tierStyle = getTierStyle(tier);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={handleBackdropMouseDown}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-breakdown-title"
            className="glass-modal max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl border border-white/15"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="glass-chip rounded-full px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                  7-Dimension Matching Heuristic
                </span>
                <h2
                  id="match-breakdown-title"
                  className="mt-2 truncate text-xl font-extrabold text-white"
                >
                  {listing.title}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{listing.originLabel}</span>
                    {listing.destinationLabel ? ` → ${listing.destinationLabel}` : ''}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    {new Date(listing.departureTime).toLocaleString(undefined, {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close match breakdown"
                className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overall Compatibility Card */}
            <div className="glass-card mt-5 flex items-center justify-between rounded-2xl p-4 border-white/12 bg-white/[0.04]">
              <div>
                <p className="text-xs font-medium text-slate-400">Overall Compatibility</p>
                <p className={`text-sm font-bold ${tierStyle.textClass}`}>{tierStyle.label}</p>
              </div>
              <MatchScoreBadge score={overallScore} size="lg" />
            </div>

            {/* 7 Dimensions Breakdown Meters */}
            <div className="glass-card mt-5 flex flex-col gap-4 rounded-2xl p-4 border-white/10 bg-white/[0.03]">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Compatibility Factors</p>
              {SUB_SCORE_META.map((meta, index) => {
                const subScore = listing.subScores.find((s) => s.key === meta.key);
                if (!subScore) return null;
                return (
                  <ScoreMeter
                    key={meta.key}
                    label={meta.label}
                    icon={meta.icon}
                    subScore={subScore}
                    index={index}
                  />
                );
              })}
            </div>

            {bookingError && (
              <div className="mt-4 rounded-xl bg-rose-500/15 p-3 text-xs text-rose-300 border border-rose-500/30">
                {bookingError}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="glass-btn-secondary rounded-xl px-4 py-2.5 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isFull || isBooking || booked}
                onClick={handleBook}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition ${
                  isFull
                    ? 'cursor-not-allowed bg-white/5 border border-white/10 text-slate-500'
                    : booked
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'glass-btn-primary'
                }`}
              >
                {isBooking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Booking...</span>
                  </>
                ) : booked ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Seat Booked!</span>
                  </>
                ) : isFull ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Ride Full</span>
                  </>
                ) : (
                  <>
                    <Ticket className="h-4 w-4" />
                    <span>Book This Ride</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
