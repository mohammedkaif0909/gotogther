import type { ComponentType } from 'react';
import { motion } from 'framer-motion';
import type { SubScore } from '../types/matching';
import { formatContribution } from '../lib/scoring';

interface ScoreMeterProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  subScore: SubScore;
  /** Position in the list, used only to stagger the fill animation */
  index: number;
}

export function ScoreMeter({ label, icon: Icon, subScore, index }: ScoreMeterProps) {
  const clamped = Math.max(0, Math.min(100, subScore.value));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-slate-200">
          <Icon className="h-4 w-4 shrink-0 text-cyan-400" />
          <span className="truncate font-semibold">{label}</span>
          <span className="shrink-0 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-cyan-300 font-medium">
            {subScore.weightPct}% weight
          </span>
        </div>
        <span className="shrink-0 tabular-nums font-bold text-white">
          {clamped.toFixed(0)}%
        </span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5 border border-white/10 p-0.5 backdrop-blur-sm">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="truncate">{subScore.detail}</span>
        <span className="shrink-0 tabular-nums text-slate-400 font-medium">{formatContribution(subScore)}</span>
      </div>
    </div>
  );
}
