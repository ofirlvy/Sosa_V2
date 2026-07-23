import React, { useLayoutEffect, useRef, useState } from 'react';

interface FloatingToolbarProps {
  children: React.ReactNode;
  /** When true the bar spans the full card width; otherwise it hugs its content (centered). */
  fullWidth?: boolean;
}

/**
 * Reusable floating toolbar shell in the app's visual language.
 * Renders just above its host card at a fixed gap. If positioning above would
 * push it off the top of the viewport, it flips to sit below the card instead.
 *
 * Must live inside the card with no `position: relative` wrappers between it and
 * the absolutely-positioned card container, so it anchors to the card box.
 */
export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ children, fullWidth = true }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      // If the bar's top is above the viewport (clipped), flip below the card.
      if (placement === 'top' && rect.top < 8) setPlacement('bottom');
      else if (placement === 'bottom' && rect.top > 80) {
        // Re-evaluate: if there's now room above, prefer top again.
        // (Only flip back when comfortably clear to avoid oscillation.)
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [placement]);

  const posClass = placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3';

  return (
    <div
      ref={ref}
      className={`absolute ${posClass} z-[100] no-drag ${fullWidth ? 'left-0 right-0' : 'left-1/2 -translate-x-1/2'} animate-in fade-in duration-200 ${placement === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'}`}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="flex items-center gap-1 p-1.5 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 overflow-visible flex-nowrap w-max max-w-[95vw]">
        {children}
      </div>
    </div>
  );
};
