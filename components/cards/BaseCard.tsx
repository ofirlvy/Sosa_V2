
import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { CardData, CardType } from '../../types';
import { Maximize2, Minimize2, Lock } from 'lucide-react';
import { FullscreenContext, CardMeasureContext } from './cardKit';

interface BaseCardProps {
  card: CardData;
  isSelected: boolean;
  isMultiSelect?: boolean;
  /**
   * Figma-style gesture: a click only ever SELECTS. Opening the editor is a
   * deliberate act — double-click, or Enter on the selection. Canvas owns the
   * expanded card id.
   */
  isExpanded?: boolean;
  onExpand?: (id: string) => void;
  onSelect: (id: string, options?: { toggle?: boolean; keepOthers?: boolean }) => void;
  onMove: (id: string, x: number, y: number) => void;
  /** Drag in progress: cumulative world-space delta from press origin (no global state churn). */
  onDragMove?: (id: string, dx: number, dy: number) => void;
  /** Drag finished: commit the accumulated offset to real x/y (one history entry + save). */
  onDragCommit?: (id: string) => void;
  /** Escape during a drag: discard the pending offset (nothing is written). */
  onDragCancel?: (id: string) => void;
  /** Live drag offset to apply as a composited transform (set for cards in the moving set). */
  dragOffset?: { x: number; y: number };
  onDelete: (id: string) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  children: React.ReactNode;
  title?: string;
  accentColor?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'minimal' | 'sticky';
  className?: string;
  lockAspectRatio?: boolean;
  /**
   * Fixed-box card (media/link): the container uses a DEFINITE height = card.height
   * (like isFixedLayout) instead of auto+minHeight, so the inner h-full/flex chain
   * fills it exactly and the selection box / resize handles / connector dots match
   * the visible surface. Content cards (text auto-grow) must NOT set this.
   */
  fixedHeight?: boolean;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  onDragEnd?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  /** Collapsed (overview) mode — shrink to content + show a strong title. */
  compact?: boolean;
  /** Extra header content (e.g. date/status chips) shown left of the maximize button. */
  headerRight?: React.ReactNode;
  /**
   * Controlled fullscreen (provided by Canvas so cards can render expanded while
   * fullscreen regardless of selection). Falls back to internal state when absent
   * (e.g. read-only share view).
   */
  isFullscreen?: boolean;
  onFullscreenChange?: (id: string, next: boolean) => void;
}

// Per-group color combos (all from the brand palette) for the unlock pill.
const LOCK_COMBOS: Record<string, { bg: string; text: string }> = {
  '#FCCAE2': { bg: '#5F2427', text: '#FCCAE2' }, // pink → burgundy / pink
  '#5F2427': { bg: '#5F2427', text: '#FCCAE2' }, // burgundy → burgundy / pink
  '#FFD753': { bg: '#3A5C34', text: '#FFD753' }, // yellow → green / yellow
  '#3A5C34': { bg: '#3A5C34', text: '#FFD753' }, // green → green / yellow
  '#F9E6D1': { bg: '#5F2427', text: '#F9E6D1' }, // peach → burgundy / peach
  '#007AFF': { bg: '#007AFF', text: '#F9E6D1' }, // blue → blue / peach
  '#8E8E93': { bg: '#5F2427', text: '#F9E6D1' }, // gray → burgundy / peach
};
const DEFAULT_LOCK_COMBO = { bg: '#5F2427', text: '#FCCAE2' };

// Brand-colored "Hold to unlock" pill with a long-press progress fill.
const LockPill: React.FC<{ onUnlock: () => void; bg: string; text: string }> = ({ onUnlock, bg, text }) => {
  const HOLD_MS = 1100;
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);
  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setHolding(true);
    timerRef.current = window.setTimeout(() => { setHolding(false); onUnlock(); }, HOLD_MS);
  };
  const cancel = () => {
    setHolding(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  return (
    <div
      className="absolute -top-3.5 right-4 z-[60] pointer-events-auto no-drag"
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      title="Hold to unlock"
    >
      <div className="relative overflow-hidden flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold shadow-md cursor-pointer select-none" style={{ backgroundColor: bg, color: text }}>
        <div
          className="absolute inset-y-0 left-0 opacity-30"
          style={{ width: holding ? '100%' : '0%', backgroundColor: text, transition: holding ? `width ${HOLD_MS}ms linear` : 'width 150ms ease-out' }}
        />
        <Lock size={12} className="relative" />
        <span className="relative whitespace-nowrap">Hold to unlock</span>
      </div>
    </div>
  );
};

export const BaseCard: React.FC<BaseCardProps> = ({
  card,
  isSelected,
  isMultiSelect = false,
  isExpanded = false,
  onExpand,
  onSelect,
  onMove,
  onDragMove,
  onDragCommit,
  onDragCancel,
  dragOffset,
  onDelete,
  onResize,
  zoomScale,
  children,
  title,
  icon,
  variant = 'default',
  className = '',
  lockAspectRatio = false,
  fixedHeight = false,
  onContextMenu,
  onDragEnd,
  onToggleLock,
  compact = false,
  headerRight,
  isFullscreen: controlledFullscreen,
  onFullscreenChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen = controlledFullscreen ?? internalFullscreen;
  const setIsFullscreen = (next: boolean) => {
    if (onFullscreenChange) onFullscreenChange(card.id, next);
    else setInternalFullscreen(next);
  };

  // Report the card's ACTUAL rendered size (world units — CSS transform scaling
  // doesn't affect layout size) so Canvas geometry (connectors, zone fitting,
  // group bounds) tracks auto-grown / collapsed heights. Skipped in fullscreen
  // (the node portals to a full-bleed layout that isn't board geometry).
  const reportMeasure = useContext(CardMeasureContext);
  useEffect(() => {
    if (!reportMeasure || isFullscreen) return;
    const el = containerRef.current;
    if (!el) return;
    const report = () => reportMeasure(card.id, el.offsetWidth, el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [reportMeasure, card.id, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  // When a card opens, put the caret in the field it marks with `data-card-focus`
  // so you can start typing immediately. Opt-in per card (never guesses), and it
  // won't steal focus from something you're already typing in.
  useEffect(() => {
    if (!isExpanded || isFullscreen) return;
    const el = containerRef.current?.querySelector<HTMLElement>('[data-card-focus]');
    if (!el) return;
    const active = document.activeElement as HTMLElement | null;
    const typingElsewhere = active && active !== document.body &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    if (typingElsewhere) return;
    el.focus({ preventScroll: true });
  }, [isExpanded, isFullscreen]);

  // Safety net only — the class is added/removed by the drag handlers. It must NOT
  // live in the drag effect's cleanup: that effect re-runs on every mouse move, so
  // its cleanup would strip the class one frame after it was set.
  useEffect(() => () => { document.body.classList.remove('sosa-dragging'); }, []);

  const hasMovedRef = useRef(false);
  const pressOriginRef = useRef({ x: 0, y: 0 });
  const pendingRef = useRef<{ shift: boolean; wasSoleSelection: boolean } | null>(null);
  const DRAG_THRESHOLD = 4; // px (screen) before a press becomes a drag

  const isFixedLayout = [CardType.GRID_PLANNER, CardType.ANALYTICS, CardType.PERSONA].includes(card.type);

  // Figma-style gesture model: a press starts a *potential* drag; selection happens
  // only on a click (mouse-up WITHOUT moving), so dragging never pops a card open.
  // Opening is separate again — double-click or Enter.
  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow Middle Click to bubble to Canvas for Panning
    if (e.button === 1 || isFullscreen) return;

    // Stop propagation so we don't trigger Canvas Marquee or Deselect
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const isInteractive =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('.no-drag');

    if (isInteractive) return; // let inputs/buttons handle their own clicks

    // While this card's own editor (input/textarea/contentEditable) is focused,
    // the card is position-locked: presses on its padding/chrome must not start
    // a drag — otherwise selecting text can "throw" the card around.
    const ae = document.activeElement as HTMLElement | null;
    if (ae && containerRef.current?.contains(ae) &&
        (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
      return;
    }

    pendingRef.current = { shift: e.shiftKey, wasSoleSelection: isSelected && !isMultiSelect };
    pressOriginRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true); // begins the press; movement is gated below (and blocked when locked)
  };

  const handleResizeStart = (e: React.MouseEvent, corner: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startBounds = { x: card.x, y: card.y, width: card.width, height: card.height };
    const originalRatio = startBounds.width / startBounds.height;

    const handleMouseMove = (ev: MouseEvent) => {
        const scale = zoomScale;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        
        let newBounds = { ...startBounds };

        const isLocked = lockAspectRatio && !ev.shiftKey;

        // Raw calculations
        let newWidth = startBounds.width;
        let newHeight = startBounds.height;
        let newX = startBounds.x;
        let newY = startBounds.y;

        // Basic resizing logic first
        if (corner.includes('e')) newWidth = Math.max(100, startBounds.width + dx);
        if (corner.includes('s')) newHeight = Math.max(100, startBounds.height + dy);
        if (corner.includes('w')) {
             const maxDx = startBounds.width - 100;
             const effectiveDx = Math.min(maxDx, dx);
             newWidth = startBounds.width - effectiveDx;
             newX = startBounds.x + effectiveDx;
        }
        if (corner.includes('n')) {
             const maxDy = startBounds.height - 100;
             const effectiveDy = Math.min(maxDy, dy);
             newHeight = startBounds.height - effectiveDy;
             newY = startBounds.y + effectiveDy;
        }

        if (isLocked) {
             // For corners, preserve aspect ratio
             // We drive by the dominant movement or simply width for East/West interaction
             
             if (corner === 'se') {
                 // Drive by width
                 newHeight = newWidth / originalRatio;
             } else if (corner === 'sw') {
                 // Drive by width
                 newHeight = newWidth / originalRatio;
                 // X is already adjusted above based on width change
             } else if (corner === 'ne') {
                 // Drive by width
                 newHeight = newWidth / originalRatio;
                 // Y must be adjusted because height changed
                 newY = startBounds.y + (startBounds.height - newHeight);
             } else if (corner === 'nw') {
                 // Drive by width
                 newHeight = newWidth / originalRatio;
                 // Y must be adjusted
                 newY = startBounds.y + (startBounds.height - newHeight);
                 // X is already adjusted above
             } else if (corner === 'e' || corner === 'w') {
                 newHeight = newWidth / originalRatio;
             } else if (corner === 's' || corner === 'n') {
                 newWidth = newHeight * originalRatio;
             }
        }

        newBounds = { x: newX, y: newY, width: newWidth, height: newHeight };
        onResize(card.id, newBounds);
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || card.isLocked) return; // locked cards never move

      // Don't move until the press clearly becomes a drag (keeps clicks crisp).
      if (!hasMovedRef.current) {
        const totalDx = e.clientX - pressOriginRef.current.x;
        const totalDy = e.clientY - pressOriginRef.current.y;
        if (Math.hypot(totalDx, totalDy) < DRAG_THRESHOLD) return;
        hasMovedRef.current = true;
        // Board-wide: no text-selection flicker under the pointer, grabbing cursor.
        document.body.classList.add('sosa-dragging');
      }

      // Emit the CUMULATIVE delta from the press origin. Canvas applies it as a
      // composited transform (no per-move global state / reflow) and commits to
      // x/y once on drop — buttery smooth even for heavy video cards.
      const dx = (e.clientX - pressOriginRef.current.x) / zoomScale;
      const dy = (e.clientY - pressOriginRef.current.y) / zoomScale;
      if (onDragMove) onDragMove(card.id, dx, dy);
      else onMove(card.id, card.x + dx, card.y + dy); // fallback (no transform path)
    };

    // Escape aborts an in-progress drag: snap back and commit nothing.
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isDragging) return;
      if (hasMovedRef.current) {
        e.stopPropagation();
        onDragMove?.(card.id, 0, 0); // back to the origin
        onDragCancel?.(card.id);
      }
      hasMovedRef.current = false;
      pendingRef.current = null;
      document.body.classList.remove('sosa-dragging');
      setIsDragging(false);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      if (hasMovedRef.current) {
        // It was a drag — commit the offset to real coordinates, then zone logic.
        onDragCommit?.(card.id);
        onDragEnd?.(card.id);
      } else {
        // It was a click — which ONLY ever selects. Opening the editor is a
        // deliberate gesture (double-click or Enter): when a click on an
        // already-selected card also opened it, you couldn't touch a card to
        // move or re-select it without an editor popping open mid-flow.
        if (pendingRef.current?.shift) {
          onSelect(card.id, { toggle: true });
        } else {
          onSelect(card.id, { keepOthers: false });
        }
      }
      pendingRef.current = null;
      document.body.classList.remove('sosa-dragging');
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('keydown', handleKey, true); // capture: beat the board handler
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [isDragging, card.id, card.x, card.y, card.isLocked, onMove, onDragMove, onDragCommit, zoomScale, onSelect, onDragEnd, onExpand]);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Selecting + expanding ensures the card renders its editor in fullscreen.
    if (!isFullscreen) {
      onSelect(card.id, { keepOthers: false });
      onExpand?.(card.id);
    }
    setIsFullscreen(!isFullscreen);
  };

  const getSelectionStyles = () => {
    if (isFullscreen) {
      // Full-bleed white screen for every card (no modal/backdrop/rounded sheet).
      // Fixed layouts (canvas/Feed Planner) fill the screen exactly as before.
      return isFixedLayout
        ? 'relative w-screen h-screen bg-white overflow-hidden flex flex-col'
        : 'relative w-full min-h-screen bg-white flex flex-col';
    }

    // ZONE and STROKE manage their own selection visuals (own frame / freeform),
    // so they get no card chrome here.
    if (card.type === CardType.ZONE || card.type === CardType.STROKE) {
      return 'absolute select-none';
    }

    // Unified "lift" on select + yellow hover ring across ALL card variants, so
    // images / video / text / sticky feel exactly like a PostCard.
    const lift = "transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-grab active:cursor-grabbing";
    const selectedLift = "shadow-[0_20px_40px_-12px_rgba(58,92,52,0.2)] z-50 scale-[1.005]";

    if (variant === 'minimal') {
      // `flex flex-col` so the children wrapper's `flex-1` fills the card's height
      // (with minHeight: card.height) — keeps media exactly card-sized so the
      // selection box + resize handles line up precisely.
      const base = `absolute flex flex-col select-none rounded-xl ${lift}`;
      return isSelected ? `${base} ${selectedLift}` : `${base} z-10 hover:ring-2 hover:ring-[#FFD753]`;
    }

    if (variant === 'sticky') {
      const base = `absolute flex flex-col ${lift}`;
      return isSelected ? `${base} ${selectedLift}` : `${base} shadow-md hover:shadow-lg hover:ring-2 hover:ring-[#FFD753] z-10`;
    }

    // Default Cards
    // Using the Vibrant Yellow for hover rings to make it feel active and creative
    const colors = {
      [CardType.POST]: { hover: 'hover:ring-[#FFD753]' },
      [CardType.STORY]: { hover: 'hover:ring-[#FFD753]' },
      [CardType.REELS]: { hover: 'hover:ring-[#FFD753]' },
      [CardType.STRATEGY_AI]: { hover: 'hover:ring-[#FFD753]' },
      [CardType.ANALYTICS]: { hover: 'hover:ring-[#FFD753]' },
      [CardType.PERSONA]: { hover: 'hover:ring-[#FFD753]' },
      [CardType.GRID_PLANNER]: { hover: 'hover:ring-[#FFD753]' },
      [CardType.PINTEREST]: { hover: 'hover:ring-[#FFD753]' }
    }[card.type] || { hover: 'hover:ring-gray-300' };

    // Transition only visual props (shadow/ring via box-shadow, select scale via
    // transform) — NOT left/top, so dragged group children move in lockstep with
    // the zone instead of animating ("chasing") behind it.
    const base = "flex flex-col bg-white transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-grab active:cursor-grabbing absolute";
    
    if (isSelected) {
      return `${base} shadow-[0_20px_40px_-12px_rgba(58,92,52,0.2)] z-50 scale-[1.005]`;
    } else {
      return `${base} shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)] z-10 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1)] hover:ring-2 hover:ring-offset-0 ${colors.hover}`;
    }
  };

  const cardContent = (
    <div
      ref={containerRef}
      className={`${getSelectionStyles()} ${className}`}
      style={!isFullscreen ? {
        left: card.x,
        top: card.y,
        width: card.width,
        // Fixed-box cards (isFixedLayout / fixedHeight media+link) get a DEFINITE
        // height so inner h-full fills exactly and the bounding box matches the
        // visible surface. Everything else auto-grows with content (min card.height).
        height: (isFixedLayout || fixedHeight) ? card.height : 'auto',
        // Collapsed cards shrink to their compact content (board-overview density).
        minHeight: (isFixedLayout || fixedHeight || compact) ? undefined : card.height,
        borderRadius: variant === 'default' ? '24px' : undefined,
        // Live drag: composited translate (no left/top reflow). 1:1 with the cursor
        // (no transition) and lifted above other cards while moving.
        ...(dragOffset ? {
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
          transition: 'none',
          zIndex: 9998,
          willChange: 'transform',
        } : {}),
      } : {}}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        // Double-click = select + expand in one gesture (also from collapsed).
        if (isFullscreen || card.isLocked) return;
        e.stopPropagation();
        onSelect(card.id, { keepOthers: false });
        onExpand?.(card.id);
      }}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, card.id); } : undefined}
    >
      {variant === 'default' && (
        <div className={`flex items-center justify-between px-5 pt-5 pb-2 select-none shrink-0 ${isFullscreen ? 'sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100 pb-3' : 'rounded-t-[24px]'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-gray-400 shrink-0">{icon}</span>
            <span dir="auto" className={`truncate ${compact ? 'text-[14px] font-bold text-gray-900' : 'text-[13px] font-semibold tracking-tight text-gray-500'}`}>{title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {headerRight}
            {isFullscreen && (
              <span className="hidden sm:inline-block text-[10px] font-semibold text-gray-400 border border-gray-200 rounded-md px-1.5 py-0.5 select-none">Esc</span>
            )}
            <button
              onClick={toggleFullscreen}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-[#FCCAE2] hover:text-[#5F2427] transition-colors"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      )}

      <FullscreenContext.Provider value={isFullscreen}>
        <div className={`flex-1 flex flex-col min-h-0 ${card.isLocked ? 'pointer-events-none' : ''} ${isFixedLayout ? 'overflow-hidden rounded-b-[24px]' : (variant === 'default' ? 'px-5 pb-5 overflow-visible' : '')}`}>
          {children}
        </div>
      </FullscreenContext.Provider>

      {isSelected && !isFullscreen && card.isLocked && (
        <>
          <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-[#5F2427]/30 z-50 rounded-[inherit]" />
          {(() => {
            const combo = card.type === CardType.ZONE ? (LOCK_COMBOS[(card.content as any)?.color] || DEFAULT_LOCK_COMBO) : DEFAULT_LOCK_COMBO;
            return <LockPill onUnlock={() => onToggleLock?.(card.id)} bg={combo.bg} text={combo.text} />;
          })()}
        </>
      )}

      {isSelected && !isFullscreen && !card.isLocked && card.type !== CardType.STROKE && (
         <>
            {/* Bounding Box Border - Using Deep Green for "Selected" state.
                Zones already have their own colored frame, so skip the extra border. */}
            {card.type !== CardType.ZONE && (
              <div className="absolute inset-0 pointer-events-none border border-[#3A5C34] z-50 rounded-[inherit]" />
            )}
            
            {/* Edge Resize Handles */}
            <div 
               className="absolute -top-1.5 left-1.5 right-1.5 h-3 z-40 cursor-n-resize pointer-events-auto"
               onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            <div 
               className="absolute -bottom-1.5 left-1.5 right-1.5 h-3 z-40 cursor-s-resize pointer-events-auto"
               onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            <div 
               className="absolute -left-1.5 top-1.5 bottom-1.5 w-3 z-40 cursor-w-resize pointer-events-auto"
               onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            <div 
               className="absolute -right-1.5 top-1.5 bottom-1.5 w-3 z-40 cursor-e-resize pointer-events-auto"
               onMouseDown={(e) => handleResizeStart(e, 'e')}
            />

            {/* Resize Handles - Using Yellow for interaction points */}
            <div 
               className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#FFD753] border border-white z-50 cursor-nw-resize pointer-events-auto shadow-sm"
               onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            <div 
               className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#FFD753] border border-white z-50 cursor-ne-resize pointer-events-auto shadow-sm"
               onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div 
               className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#FFD753] border border-white z-50 cursor-sw-resize pointer-events-auto shadow-sm"
               onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div 
               className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#FFD753] border border-white z-50 cursor-se-resize pointer-events-auto shadow-sm"
               onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
         </>
      )}
    </div>
  );

  if (isFullscreen) {
    // True full-bleed white screen (NOT a modal) — like opening an item to its
    // fullscreen editor in Notion. Same treatment the Feed Planner already uses.
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-white overflow-auto animate-in fade-in duration-200">
        {cardContent}
      </div>,
      document.body
    );
  }

  return cardContent;
};
