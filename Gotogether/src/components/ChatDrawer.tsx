import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Send,
  Loader2,
  AlertTriangle,
  Users,
  MessageSquare,
  ShieldAlert,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useChatRoom } from '../hooks/useChatRoom';
import { scanMessageSafety } from '../lib/chatSafety';
import { UserAvatar } from './UserAvatar';

export interface ChatPeer {
  id: string;
  name: string;
  avatarUrl?: string;
}

export type ChatChannelType = 'ride_group' | 'direct_inquiry' | 'support_ticket';

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The MatchRequest / Conversation id whose room this drawer connects to. */
  matchRequestId: string;
  currentUserId: string;
  peer: ChatPeer;
  /** Initial or default channel type */
  channelType?: ChatChannelType;
  /** Whether the trip has completed and the channel is archived to read-only */
  isClosed?: boolean;
}

export function ChatDrawer({
  open,
  onClose,
  matchRequestId,
  currentUserId,
  peer,
  channelType = 'direct_inquiry',
  isClosed = false,
}: ChatDrawerProps) {
  const [activeChannel, setActiveChannel] = useState<ChatChannelType>(channelType);
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);

  const { messages, connectionState, errorMessage, sendMessage } = useChatRoom({
    matchRequestId,
    userId: currentUserId,
    enabled: open,
  });

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveChannel(channelType);
  }, [channelType]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Live client-side safety scan as user types
  const handleDraftChange = (text: string) => {
    setDraft(text);
    if (!text.trim()) {
      setSafetyNotice(null);
      return;
    }
    const scan = scanMessageSafety(text);
    if (!scan.safe) {
      setSafetyNotice(scan.flaggedReason || 'Message violates safety rules');
    } else {
      setSafetyNotice(null);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || isClosed) return;

    // Safety gate
    const scan = scanMessageSafety(draft);
    if (!scan.safe) {
      setSafetyNotice(scan.flaggedReason || 'Message cannot be sent due to safety policies');
      return;
    }

    sendMessage(draft);
    setDraft('');
    setSafetyNotice(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="glass-modal fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/15 shadow-2xl"
          >
            {/* Header */}
            <header className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={peer.avatarUrl}
                    name={peer.name}
                    size="lg"
                    showStatus
                    status={
                      connectionState === 'connected'
                        ? 'online'
                        : connectionState === 'connecting'
                        ? 'connecting'
                        : 'offline'
                    }
                  />
                  <div>
                    <h2 className="text-sm font-bold text-white">{peer.name}</h2>
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      {connectionState === 'connecting' && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-cyan-400" /> Connecting to room...
                        </>
                      )}
                      {connectionState === 'connected' && (
                        <>
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                          <span className="text-emerald-300 font-medium">Online (Encrypted)</span>
                        </>
                      )}
                      {connectionState === 'error' && (
                        <>
                          <AlertTriangle className="h-3 w-3 text-amber-400" /> Connection issue
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close chat"
                  className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Communication Channel Matrix Selector */}
              <div className="mt-3 flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 text-xs backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setActiveChannel('direct_inquiry')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 font-semibold transition ${
                    activeChannel === 'direct_inquiry'
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>1-on-1</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveChannel('ride_group')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 font-semibold transition ${
                    activeChannel === 'ride_group'
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Ride Group</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveChannel('support_ticket')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 font-semibold transition ${
                    activeChannel === 'support_ticket'
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Support</span>
                </button>
              </div>
            </header>

            {/* Read-only / Archival Notice Banner */}
            {isClosed && (
              <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-xs text-amber-200">
                <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  This ride is completed. Chat is in <strong>Read-Only</strong> mode.
                </span>
              </div>
            )}

            {/* Message History */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && connectionState === 'connected' && (
                <div className="my-8 text-center px-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-white">
                    {activeChannel === 'ride_group'
                      ? 'Ride Discussion Group'
                      : activeChannel === 'support_ticket'
                      ? 'Support & Dispute Channel'
                      : `Conversation with ${peer.name}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {activeChannel === 'ride_group'
                      ? 'Coordinate pickup timing, luggage space, and stops with your driver and co-passengers.'
                      : activeChannel === 'support_ticket'
                      ? 'Report incidents, lost items, fare disputes, or KYC verification inquiries to moderators.'
                      : 'Messages are protected by Supabase RLS and audited for platform safety.'}
                  </p>
                </div>
              )}

              {messages.map((message) => {
                const isMine = message.senderId === currentUserId;
                return (
                  <div key={message.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {!isMine && (
                      <UserAvatar
                        src={message.sender?.avatarUrl || peer.avatarUrl}
                        name={message.sender?.name || peer.name}
                        size="xs"
                        className="mb-0.5"
                      />
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                        isMine
                          ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-br-sm shadow-cyan-500/20'
                          : 'glass-card text-slate-100 rounded-bl-sm border-white/12 bg-white/[0.07]'
                      }`}
                    >
                      {!isMine && (
                        <p className="mb-0.5 font-bold text-[10px] text-cyan-300">
                          {message.sender?.name || peer.name}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">{message.content}</p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          isMine ? 'text-cyan-100' : 'text-slate-400'
                        }`}
                      >
                        {new Date(message.createdAt).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error or Safety Warning Banner */}
            {safetyNotice && (
              <div className="border-t border-rose-500/30 bg-rose-500/15 px-4 py-2 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{safetyNotice}</span>
              </div>
            )}

            {errorMessage && (
              <p className="border-t border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs text-amber-200">
                {errorMessage}
              </p>
            )}

            {/* Message Input Box */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-white/10 p-3.5 bg-white/[0.02]"
            >
              <input
                type="text"
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                placeholder={
                  isClosed
                    ? 'Conversation archived (Read-only)'
                    : activeChannel === 'support_ticket'
                    ? 'Describe your dispute or incident...'
                    : activeChannel === 'ride_group'
                    ? 'Message group (driver + riders)...'
                    : 'Type a message...'
                }
                maxLength={2000}
                disabled={connectionState !== 'connected' || isClosed}
                className="glass-input flex-1 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-400 outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={connectionState !== 'connected' || !draft.trim() || isClosed || Boolean(safetyNotice)}
                aria-label="Send message"
                className="glass-btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
