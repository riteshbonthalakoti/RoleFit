import React from 'react';

interface BrandMarkProps {
  size?: number;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="rf-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10B981" />
        <stop offset="1" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    <rect x="1.5" y="1.5" width="33" height="33" rx="9" fill="#0F172A" stroke="url(#rf-grad)" strokeWidth="2" />
    <path
      d="M10.5 11.5H19.5C22.2614 11.5 24.5 13.7386 24.5 16.5C24.5 18.85 22.88 20.82 20.7 21.35L25 25.5"
      stroke="url(#rf-grad)"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.5 11.5V25.5"
      stroke="#F8FAFC"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <circle cx="25.5" cy="11" r="2.2" fill="#10B981" />
  </svg>
);
