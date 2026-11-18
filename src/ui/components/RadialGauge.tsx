import React from 'react';
import type { FitGrade } from '../../core/types';

interface RadialGaugeProps {
  score: number;
  grade: FitGrade;
  size?: number;
}

const GRADE_STYLE: Record<FitGrade, { label: string; stroke: string; badge: string }> = {
  strong: {
    label: 'Strong Fit',
    stroke: '#10B981',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  },
  good: {
    label: 'Good Fit',
    stroke: '#06B6D4',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  },
  partial: {
    label: 'Partial Fit',
    stroke: '#F59E0B',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  low: {
    label: 'Low Fit',
    stroke: '#F43F5E',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
};

export const RadialGauge: React.FC<RadialGaugeProps> = ({ score, grade, size = 92 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const style = GRADE_STYLE[grade];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={style.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight tabular-nums">{score}</span>
          <span className="text-[10px] font-medium text-slate-400">/ 100</span>
        </div>
      </div>
      <span className={`mt-2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
        {style.label}
      </span>
    </div>
  );
};
