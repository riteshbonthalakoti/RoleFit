import React from 'react';

interface BrandMarkProps {
  size?: number;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="rf-bg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#11192B" />
        <stop offset="100%" stopColor="#070B14" />
      </linearGradient>
      <linearGradient id="rf-accent" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="55%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#22D3EE" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#rf-bg)" stroke="url(#rf-accent)" strokeWidth="2.2" />
    <path d="M32 10 A22 22 0 0 1 53.5 28" stroke="url(#rf-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
    <path d="M32 54 A22 22 0 0 1 10.5 36" stroke="url(#rf-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
    <path d="M21 19.5V44.5" stroke="#F8FAFC" strokeWidth="4.8" strokeLinecap="round" />
    <path
      d="M21 20.5H34.5C39.8 20.5 43.5 24 43.5 28.8C43.5 33 40.5 36.2 36 37L44.5 44.5"
      stroke="url(#rf-accent)"
      strokeWidth="4.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="45.5" cy="18.5" r="3.4" fill="#10B981" />
  </svg>
);
