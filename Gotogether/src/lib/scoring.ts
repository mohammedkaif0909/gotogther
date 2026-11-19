import type { ComponentType } from 'react';
import {
  MapPin,
  Clock,
  Wallet,
  Activity,
  ShieldCheck,
  Users,
  BadgeCheck,
  Sparkles,
  ThumbsUp,
  Gauge,
} from 'lucide-react';
import type { SubScore, SubScoreKey } from '../types/matching';

type IconComponent = ComponentType<{ className?: string }>;

export interface SubScoreMeta {
  key: SubScoreKey;
  label: string;
  weightPct: number;
  icon: IconComponent;
}

/**
 * Canonical weight configuration for the 7-dimension heuristic matching engine.
 * Score = sum(weight_i * s_i) for i = 1..7. Weights must sum to 100.
 */
export const SUB_SCORE_META: SubScoreMeta[] = [
  { key: 'proximity', label: 'Route Proximity', weightPct: 25, icon: MapPin },
  { key: 'schedule', label: 'Schedule Overlap', weightPct: 20, icon: Clock },
  { key: 'budget', label: 'Budget Alignment', weightPct: 15, icon: Wallet },
  { key: 'activity', label: 'Activity & Pace Fit', weightPct: 15, icon: Activity },
  { key: 'reliability', label: 'Host Reliability', weightPct: 10, icon: ShieldCheck },
  { key: 'social', label: 'Social Preferences', weightPct: 10, icon: Users },
  { key: 'verification', label: 'Identity Verification', weightPct: 5, icon: BadgeCheck },
];

export type ScoreTier = 'excellent' | 'good' | 'fair';

export function getScoreTier(score: number): ScoreTier {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  return 'fair';
}

interface TierStyle {
  label: string;
  icon: IconComponent;
  badgeClass: string;
  textClass: string;
  meterGradientClass: string;
}

const TIER_STYLES: Record<ScoreTier, TierStyle> = {
  excellent: {
    label: 'Excellent match',
    icon: Sparkles,
    badgeClass: 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
    textClass: 'text-emerald-300',
    meterGradientClass: 'from-emerald-400 to-teal-400',
  },
  good: {
    label: 'Good match',
    icon: ThumbsUp,
    badgeClass: 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
    textClass: 'text-cyan-300',
    meterGradientClass: 'from-sky-400 to-cyan-400',
  },
  fair: {
    label: 'Fair match',
    icon: Gauge,
    badgeClass: 'bg-amber-500/15 border border-amber-400/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
    textClass: 'text-amber-300',
    meterGradientClass: 'from-amber-400 to-orange-400',
  },
};

export function getTierStyle(tier: ScoreTier): TierStyle {
  return TIER_STYLES[tier];
}

/**
 * Recomputes the overall weighted score from a listing's sub-scores on the client,
 * so ranked cards can re-sort instantly as filters change without waiting on the server.
 * Mirrors the backend formula: Score = sum(weight_i * s_i), i = 1..7.
 */
export function computeOverallScore(subScores: SubScore[]): number {
  const total = subScores.reduce((sum, s) => sum + (s.value * s.weightPct) / 100, 0);
  return Math.round(total * 10) / 10;
}

/** Weighted point contribution of a single dimension, out of its own weight allotment. */
export function computeContribution(subScore: SubScore): number {
  return (subScore.value * subScore.weightPct) / 100;
}

export function formatContribution(subScore: SubScore): string {
  return `${computeContribution(subScore).toFixed(1)} / ${subScore.weightPct.toFixed(0)} pts`;
}
