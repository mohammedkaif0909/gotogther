import { useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Car, Bike, Loader2, Plus, Sparkles } from 'lucide-react';
import type { ListingFormState, ListingFormType } from '../types/listingForm';
import {
  buildCreateListingPayload,
  createEmptyListingFormState,
  validateListingForm,
  type ListingFormErrors,
} from '../lib/listingValidation';
import { createListing, type CreatedListing } from '../lib/api';
import { AddressAutocomplete } from './AddressAutocomplete';

interface ListingCreationModalProps {
  open: boolean;
  onClose: () => void;
  /** The currently signed-in user, who becomes the listing's host. */
  hostId: string;
  onCreated: (listing: CreatedListing) => void;
}

const TYPE_TABS: { type: ListingFormType; label: string; icon: typeof Car | typeof Bike }[] = [
  { type: 'CAR', label: 'Car Pool', icon: Car },
  { type: 'BIKE', label: 'Bike Ride', icon: Bike },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-400 font-medium">{message}</p>;
}

const inputClass =
  'glass-input w-full rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 outline-none';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300';

export function ListingCreationModal({ open, onClose, hostId, onCreated }: ListingCreationModalProps) {
  const [form, setForm] = useState<ListingFormState>(createEmptyListingFormState());
  const [errors, setErrors] = useState<ListingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateField = <K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const handleTypeChange = (type: ListingFormType) => {
    setForm(createEmptyListingFormState(type));
    setErrors({});
    setSubmitError(null);
  };

  const handleClose = () => {
    setForm(createEmptyListingFormState());
    setErrors({});
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateListingForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildCreateListingPayload(form, hostId);
      const created = await createListing(payload);
      onCreated(created);
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish listing';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Create listing"
              className="glass-modal relative w-full max-w-xl rounded-3xl p-6 shadow-2xl my-8 border border-white/15"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            >
              {/* Header */}
              <header className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      <Plus className="h-4 w-4" />
                    </span>
                    <h2 className="text-lg font-extrabold text-white">Publish a Vehicle Ride</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Host a Car pool or Bike ride for commuters & travelers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close modal"
                  className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {/* Type Switcher */}
              <div className="mt-4 flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
                {TYPE_TABS.map(({ type, label, icon: Icon }) => {
                  const active = form.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleTypeChange(type)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                        active
                          ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label className={labelClass} htmlFor="title">
                    Title
                  </label>
                  <input
                    id="title"
                    className={inputClass}
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder={
                      form.type === 'CAR'
                        ? 'Koramangala → Whitefield Morning Commute'
                        : 'Indiranagar → HSR Layout Quick Bike Ride'
                    }
                  />
                  <FieldError message={errors.title} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="description">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    className={`${inputClass} min-h-20 resize-y`}
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Anything co-riders should know (e.g. AC car, spare helmet provided, non-smoking)"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <AddressAutocomplete
                    id="originLabel"
                    label="Origin location"
                    placeholder="Search pickup point (e.g. Koramangala)..."
                    value={form.originLabel}
                    latitude={form.originLatitude}
                    longitude={form.originLongitude}
                    error={errors.originLabel || errors.originLatitude || errors.originLongitude}
                    onChange={(label, lat, lng) => {
                      updateField('originLabel', label);
                      updateField('originLatitude', lat);
                      updateField('originLongitude', lng);
                    }}
                  />

                  <AddressAutocomplete
                    id="destinationLabel"
                    label="Destination location"
                    placeholder="Search drop-off point (e.g. Whitefield)..."
                    value={form.destinationLabel}
                    latitude={form.destinationLatitude}
                    longitude={form.destinationLongitude}
                    error={errors.destinationLabel || errors.destinationLatitude || errors.destinationLongitude}
                    onChange={(label, lat, lng) => {
                      updateField('destinationLabel', label);
                      updateField('destinationLatitude', lat);
                      updateField('destinationLongitude', lng);
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="departureTime">
                      Departure time
                    </label>
                    <input
                      id="departureTime"
                      type="datetime-local"
                      className={inputClass}
                      value={form.departureTime}
                      onChange={(e) => updateField('departureTime', e.target.value)}
                    />
                    <FieldError message={errors.departureTime} />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="capacity">
                      Available Seats ({form.type === 'BIKE' ? 'Pillion' : 'Car seats'})
                    </label>
                    <input
                      id="capacity"
                      className={inputClass}
                      value={form.capacity}
                      onChange={(e) => updateField('capacity', e.target.value)}
                      inputMode="numeric"
                    />
                    <FieldError message={errors.capacity} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="pricePerSeat">
                      Price per seat (₹, optional)
                    </label>
                    <input
                      id="pricePerSeat"
                      className={inputClass}
                      value={form.pricePerSeat}
                      onChange={(e) => updateField('pricePerSeat', e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                    />
                    <FieldError message={errors.pricePerSeat} />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="tags">
                      Tags (comma-separated)
                    </label>
                    <input
                      id="tags"
                      className={inputClass}
                      value={form.tags}
                      onChange={(e) => updateField('tags', e.target.value)}
                      placeholder="AC, Non-smoking, Helmet provided"
                    />
                  </div>
                </div>

                {submitError && (
                  <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-300">
                    {submitError}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="glass-btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="glass-btn-primary flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Publish Ride</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
