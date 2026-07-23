import React, { useEffect, useRef, useState } from 'react';
import { OrbitLogo } from '../ui/OrbitLogo';
import { AuthShowcase } from './AuthShowcase';
import { DecorFooterPattern } from '../DecorFooterPattern';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [patternOffset, setPatternOffset] = useState(0);

  useEffect(() => {
    const updateOffset = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        
        // The pattern is ~4 cells wide.
        const patternWidth = 478.35;
        const cellWidth = patternWidth / 4;
        const cellCenter = cellWidth / 2;
        
        // To center the first cell, we shift the pattern so its cellCenter aligns with the container's center.
        // If a different cell looks better, you can add or subtract `cellWidth` from this offset.
        const offset = (width / 2) - cellCenter;
        setPatternOffset(offset);
      }
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  return (
    <div className="h-[100vh] w-full flex bg-[#F9F8F6] overflow-hidden">
      {/* Left Showcase (Hidden on mobile) */}
      <AuthShowcase />

      {/* Right Form Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 relative bg-[#ffd653] overflow-hidden before:content-[''] before:absolute before:top-0 before:inset-x-[14px] before:h-3 before:bg-[repeating-linear-gradient(to_right,#3A5C34,#3A5C34_2px,transparent_2px,transparent_16px)]"
      >
        {/* Decorative Footer Pattern with Embedded Logo */}
        <div className="absolute bottom-0 left-0 w-full h-[120px] pointer-events-none flex items-center justify-center">
          <DecorFooterPattern offsetX={patternOffset} className="absolute inset-0 w-full h-full" />
          <OrbitLogo className="w-12 h-12 text-[#5F2427] relative z-10" />
        </div>

        <div className="w-full max-w-[420px] animate-in slide-in-from-bottom-4 fade-in duration-500 relative z-10 pb-[60px]">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <h1 className="text-[32px] font-bold text-[#5F2427] tracking-tight mb-2">{title}</h1>
            {subtitle && (
              <p className="text-[15px] text-gray-500 leading-relaxed max-w-sm">
                {subtitle}
              </p>
            )}
          </div>

          {/* Form Content */}
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
