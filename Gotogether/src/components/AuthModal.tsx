import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Compass, Car, Loader2, Sparkles, User, Lock, Mail, Phone, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types/auth';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  defaultRole?: Role;
}

export function AuthModal({
  open,
  onClose,
  defaultMode = 'login',
  defaultRole = 'TRAVELER',
}: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [selectedRole, setSelectedRole] = useState<Role>(defaultRole);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(defaultMode);
    setSelectedRole(defaultRole);
    setError(null);
  }, [defaultMode, defaultRole, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({
          name,
          email,
          password,
          role: selectedRole,
          phone: phone || undefined,
          collegeName: institution || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
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
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={mode === 'login' ? 'Sign In' : 'Create Account'}
              className="glass-modal relative w-full max-w-md overflow-hidden rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/15 my-8"
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close auth modal"
                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-white/20">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white">
                  {mode === 'login' ? 'Welcome Back' : 'Join GoTogether'}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {mode === 'login'
                    ? 'Sign in to access your rides and chat'
                    : 'Connect with commuters, carpoolers & bike riders'}
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="mt-6 flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === 'register' && (
                  <>
                    {/* Role Selector Card Pills */}
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Select Account Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRole('TRAVELER')}
                          className={`glass-card flex flex-col items-start rounded-2xl p-3 text-left transition ${
                            selectedRole === 'TRAVELER'
                              ? 'border-cyan-500/60 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                              : 'hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                            <Compass className="h-4 w-4" /> Traveler
                          </div>
                          <p className="mt-1 text-[11px] leading-tight text-slate-400">
                            Find rides & join commutes
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedRole('HOST')}
                          className={`glass-card flex flex-col items-start rounded-2xl p-3 text-left transition ${
                            selectedRole === 'HOST'
                              ? 'border-cyan-500/60 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                              : 'hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                            <Car className="h-4 w-4" /> Host / Driver
                          </div>
                          <p className="mt-1 text-[11px] leading-tight text-slate-400">
                            Publish trips & carpools
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Full Name
                      </label>
                      <div className="relative mt-1.5">
                        <User className="absolute left-3.5 top-3 h-4 w-4 text-cyan-400" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ananya Rao"
                          className="glass-input w-full rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-400 outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Email Address
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-cyan-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ananya@example.com"
                      className="glass-input w-full rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-400 outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-cyan-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="glass-input w-full rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-400 outline-none"
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <>
                    {/* Optional Phone & Workplace */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                          Phone (Optional)
                        </label>
                        <div className="relative mt-1.5">
                          <Phone className="absolute left-3 top-3 h-3.5 w-3.5 text-cyan-400" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765..."
                            className="glass-input w-full rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-400 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                          College / Work
                        </label>
                        <div className="relative mt-1.5">
                          <Building2 className="absolute left-3 top-3 h-3.5 w-3.5 text-cyan-400" />
                          <input
                            type="text"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="IISc / Infosys"
                            className="glass-input w-full rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-400 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="glass-btn-primary mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : mode === 'login' ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
