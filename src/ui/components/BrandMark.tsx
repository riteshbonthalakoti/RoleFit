import React from 'react';

interface BrandMarkProps {
  size?: number;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32 }) => {
  const iconUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('icons/icon128.png')
      : './icons/icon128.png';

  return (
    <img
      src={iconUrl}
      alt="RoleFit"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="flex-shrink-0 rounded-[22%] shadow-sm"
    />
  );
};
