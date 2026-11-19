import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, Sparkles, Upload, ShieldCheck, RefreshCw } from 'lucide-react';
import { PROFESSIONAL_AVATARS, type ProfessionalAvatar } from '../utils/avatar';
import { UserAvatar } from './UserAvatar';
import type { User } from '../types/auth';

interface ProfileIconPickerModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSelectAvatar: (newAvatarUrl: string) => Promise<void>;
}

export function ProfileIconPickerModal({
  open,
  onClose,
  currentUser,
  onSelectAvatar,
}: ProfileIconPickerModalProps) {
  const [selectedUrl, setSelectedUrl] = useState<string>(
    currentUser?.avatarUrl || PROFESSIONAL_AVATARS[0].url
  );
  const [customUrl, setCustomUrl] = useState<string>('');
  const [useCustomUrl, setUseCustomUrl] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const activeAvatarUrl = useCustomUrl && customUrl.trim() ? customUrl.trim() : selectedUrl;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSelectAvatar(activeAvatarUrl);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile icon');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="glass-modal relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-slate-900/90 p-6 shadow-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 text-white shadow-lg shadow-cyan-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Choose Professional Profile Icon
                </h2>
                <p className="text-xs text-slate-400">
                  Select a verified professional headshot for your GoTogether profile
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Current Preview Banner */}
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
            <UserAvatar
              src={activeAvatarUrl}
              name={currentUser?.name ?? 'You'}
              size="2xl"
              verified={currentUser?.isVerified}
              ringClassName="ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white truncate">
                  {currentUser?.name ?? 'Professional User'}
                </h3>
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300 border border-cyan-500/30">
                  {currentUser?.role ?? 'Commuter'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {currentUser?.email ?? 'profile@gotogether.com'}
              </p>
              <p className="text-[11px] text-cyan-400 font-medium flex items-center gap-1.5 mt-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified ID & Safety Badge Active
              </p>
            </div>
          </div>

          {/* Avatar Gallery Scrollable List */}
          <div className="mt-5 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Curated Executive & Commuter Collection
              </h4>
              <span className="text-[11px] text-slate-400">
                {PROFESSIONAL_AVATARS.length} Professional Icons
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {PROFESSIONAL_AVATARS.map((avatar) => {
                const isSelected = !useCustomUrl && selectedUrl === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => {
                      setSelectedUrl(avatar.url);
                      setUseCustomUrl(false);
                    }}
                    className={`group relative flex flex-col items-center rounded-2xl border p-3 text-center transition ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/15 shadow-md shadow-cyan-500/20'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="relative mb-2">
                      <img
                        src={avatar.url}
                        alt={avatar.name}
                        className={`h-14 w-14 rounded-full object-cover ring-2 transition group-hover:scale-105 ${
                          isSelected ? 'ring-cyan-400 shadow-lg' : 'ring-white/20'
                        }`}
                      />
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-slate-950 font-bold shadow">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-white truncate w-full">
                      {avatar.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate w-full mt-0.5">
                      {avatar.roleHint}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Custom URL Option */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">
                  Or use a custom headshot image URL
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/your-headshot..."
                  value={customUrl}
                  onChange={(e) => {
                    setCustomUrl(e.target.value);
                    if (e.target.value.trim()) setUseCustomUrl(true);
                  }}
                  className="glass-input flex-1 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setUseCustomUrl(Boolean(customUrl.trim()))}
                  className="glass-btn-secondary rounded-xl px-3 py-2 text-xs font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Feedback & Actions */}
          {error && (
            <p className="mt-3 text-center text-xs font-medium text-rose-400">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="glass-btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-lg shadow-cyan-500/25"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : success ? (
                <>
                  <Check className="h-4 w-4 text-emerald-300" /> Saved!
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Save Profile Icon
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
