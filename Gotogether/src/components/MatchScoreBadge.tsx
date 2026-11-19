import { motion } from 'framer-motion';
import { getScoreTier, getTierStyle } from '../lib/scoring';

interface MatchScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<MatchScoreBadgeProps['size']>, string> = {
  sm: 'text-xs px-2.5 py-1 gap-1',
  md: 'text-sm px-3 py-1.5 gap-1.5',
  lg: 'text-base px-3.5 py-2 gap-2',
};

const ICON_SIZE_CLASSES: Record<NonNullable<MatchScoreBadgeProps['size']>, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4.5 w-4.5',
};

export function MatchScoreBadge({ score, size = 'md' }: MatchScoreBadgeProps) {
  const tier = getScoreTier(score);
  const style = getTierStyle(tier);
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`glass-chip inline-flex items-center rounded-full font-bold shadow-sm backdrop-blur-md ${style.badgeClass} ${style.textClass} ${SIZE_CLASSES[size]}`}
      title={style.label}
      role="status"
      aria-label={`${style.label}, ${score.toFixed(0)} percent compatibility`}
    >
      <Icon className={ICON_SIZE_CLASSES[size]} />
      <span className="tabular-nums tracking-tight">{score.toFixed(0)}%</span>
    </motion.div>
  );
}
