import React from 'react';
import type { FitGrade } from '../../core/types';

interface RadialGaugeProps {
  score: number;
  grade: FitGrade;
  size?: number;
}

const GRADE_STYLE: Record<
  FitGrade,
  { label: string; strokeStart: string; strokeEnd: string; glow: string; badge: string; dot: string }
> = {
  strong: {
    label: 'Strong Fit',
    strokeStart: '#10B981',
    strokeEnd: '#22D3EE',
    glow: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.35))',
    badge: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  good: {
    label: 'Good Fit',
    strokeStart: '#06B6D4',
    strokeEnd: '#38BDF8',
    glow: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.35))',
    badge: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  partial: {
    label: 'Partial Fit',
    strokeStart: '#F59E0B',
    strokeEnd: '#FBBF24',
    glow: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.3))',
    badge: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  low: {
    label: 'Low Fit',
    strokeStart: '#F43F5E',
    strokeEnd: '#FB7185',
    glow: 'drop-shadow(0 0 8px rgba(244, 63, 94, 0.3))',
    badge: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30',
    dot: 'bg-rose-400',
  },
};

export const RadialGauge: React.FC<RadialGaugeProps> = ({ score, grade, size = 100 }) => {
  const strokeWidth = size >= 120 ? 10 : 8;
  const radius = (size - strokeWidth - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;
  const style = GRADE_STYLE[grade];
  const gradId = `rf-gauge-${grade}-${size}`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ filter: style.glow }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={style.strokeStart} />
              <stop offset="100%" stopColor={style.strokeEnd} />
            </linearGradient>
          </defs>
          {/* Subtle calibration tick ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + 4}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="2 5"
            className="text-slate-300 dark:text-slate-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-800/90"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${size >= 120 ? 'text-3xl' : 'text-2xl'} font-extrabold tracking-tight tabular-nums`}>
            {clamped}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Score
          </span>
        </div>
      </div>
      <span
        className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {style.label}
      </span>
    </div>
  );
};
