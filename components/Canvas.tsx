
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { CardData, CardType, Position, GridPlannerContent, ToolType, StrokePoint, StrokeCardContent, ZoneCardContent, Connector } from '../types';
import { TOOL_VISUALS, TOOL_DEFAULT_SIZE } from './toolVisuals';
import { anchors, connectorPath, midPoint, dashArrayFor, DEFAULT_CONNECTOR_COLOR, Rect } from '../services/connectorGeometry';
import { ConnectorToolbar } from './ui/ConnectorToolbar';
import {
  Copy, Lock, Unlock, ArrowUpToLine, ArrowDownToLine, Trash2, Group, Ungroup, MousePointerSquareDashed,
  LayoutGrid, Expand, Shrink, ClipboardPaste, ExternalLink,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal
} from 'lucide-react';
import { PostCard } from './cards/PostCard';
import { AiStrategyCard } from './cards/AiStrategyCard';
import { AnalyticsCard } from './cards/AnalyticsCard';
import { GridPlannerCard } from './cards/GridPlannerCard';
import { PinterestCard } from './cards/PinterestCard';
import { StrokeCard } from './cards/StrokeCard';
import { TextCard } from './cards/TextCard';
import { StickyCard } from './cards/StickyCard';
import { LinkCard } from './cards/LinkCard';
import { GanttCard } from './cards/GanttCard';
import { AdsTestCard } from './cards/AdsTestCard';
import { ImageCard } from './cards/ImageCard';
import { NewsletterCard } from './cards/NewsletterCard';
import { ReferenceCard } from './cards/ReferenceCard';
import { DocCard } from './cards/DocCard';
import { ZoneCard } from './cards/ZoneCard';
import { StoryCard } from './cards/StoryCard';
import { ReelsCard } from './cards/ReelsCard';
import { SelectionToolbar } from './SelectionToolbar';
// Production Suite
import { FilmstripCard } from './cards/Production/FilmstripCard';
import { AvScriptCard } from './cards/Production/AvScriptCard';
import { CallSheetCard } from './cards/Production/CallSheetCard';
import { CastingBoardCard } from './cards/Production/CastingBoardCard';
import { PropTableCard } from './cards/Production/PropTableCard';

import { CardErrorBoundary } from './ErrorBoundary';
import { CardMeasureContext } from './cards/cardKit';
import { findLinkedGrid, getSlotDate } from '../services/gridPlanner';
import { isValidUrl, guessUrlPlatform, seedLinkContent } from '../services/linkService';
import * as coords from '../services/coords';
import { computeSnap, SnapGuide } from '../services/snapService';
import {
  copySelection, materializePaste, findFreeSpot, clipboardBounds,
  serializeClipboard, parseClipboardText, getInternalClipboard, hasInternalClipboard,
  imageCardsToMediaItems, isAllMediaClipboard
} from '../services/clipboardService';
import { beginMediaUpload, isWithinMediaLimit, mediaLimitMessage } from '../services/fileService';
import { resolveBoardKey, nudgeCards } from '../services/boardKeys';
import { tileGrid } from '../services/mediaLayout';
import { soundService } from '../services/soundService';
import { defaultAlignFor } from '../services/textDirection';

interface CanvasProps {
  cards: CardData[];
  onCardsChange: (cards: CardData[]) => void;
  onCardsChangeSilent?: (cards: CardData[]) => void;
  activeTool: ToolType;
  onToolUsed: () => void;
  scale: number;
  onScaleChange: React.Dispatch<React.SetStateAction<number>>;
  pan: Position;
  onPanChange: (p: Position) => void;
  isSpacePressed?: boolean;
  /** One-shot: select this card once it exists (so a newly-added card opens expanded). */
  selectCardId?: string | null;
  onCardSelected?: () => void;
  /** Recently-used card tools (most-recent first) for the right-click quick row. */
  recentTools?: CardType[];
  onQuickToolUsed?: (type: CardType) => void;
  /** Read-only viewer mode (public share): cards non-interactive; pan + zoom only. */
  readOnly?: boolean;
  /** Connectors (arrows between elements) + their mutator + global visibility. */
  connectors?: Connector[];
  onConnectorsChange?: (next: Connector[]) => void;
  showConnectors?: boolean;
  /** Open the board chat drawer filtered to a card (comment badge click). */
  onOpenComments?: (cardId: string) => void;
}

const GRID_HEADER_HEIGHT = 132; 
const GRID_PADDING = 20;
const GRID_GAP = 8;

export const Canvas: React.FC<CanvasProps> = ({ 
  cards,
  onCardsChange,
  onCardsChangeSilent,
  activeTool,
  onToolUsed,
  scale, 
  onScaleChange,
  pan,
  onPanChange,
  isSpacePressed = false,
  selectCardId = null,
  onCardSelected,
  recentTools = [],
  onQuickToolUsed,
  readOnly = false,
  connectors = [],
  onConnectorsChange,
  showConnectors = true,
  onOpenComments
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  
  // Interaction States
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Position>({ x: 0, y: 0 });
  // Track continuous mouse pos for Smart Paste location
  const [cursorPos, setCursorPos] = useState<Position>({ x: 0, y: 0 });
  
  // Selection States
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: Position, current: Position } | null>(null);

  // --- Connectors ---
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null); // dragging a new connector from this element
  const [connectCursor, setConnectCursor] = useState<Position | null>(null); // world point of the cursor while connecting
  const [connectTarget, setConnectTarget] = useState<string | null>(null); // element under cursor while connecting
  const connectTargetRef = useRef<string | null>(null);
  connectTargetRef.current = connectTarget;

  // --- Measured card sizes (actual rendered DOM size, world units) ---
  // Cards auto-grow past card.height and shrink when collapsed; BaseCard reports
  // the live size here via CardMeasureContext. All geometry consumers (connectors,
  // zone fitting, group bounds, hit-tests) read effectiveRect() so they always
  // track the REAL height. Never written back into card data.
  const measuredSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const measureRafRef = useRef<number | null>(null);
  const [measureVersion, setMeasureVersion] = useState(0);
  const handleCardMeasure = useCallback((id: string, width: number, height: number) => {
    const prev = measuredSizesRef.current.get(id);
    if (prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) return;
    measuredSizesRef.current.set(id, { width, height });
    if (measureRafRef.current == null) {
      measureRafRef.current = requestAnimationFrame(() => {
        measureRafRef.current = null;
        setMeasureVersion(v => v + 1);
      });
    }
  }, []);

  // Actual on-board rect for a card: measured DOM size when available (auto-height
  // content cards), declared size otherwise (zones, strokes, fixed layouts).
  const effectiveRect = (c: CardData): Rect => {
    if (c.type === CardType.ZONE || c.type === CardType.STROKE) {
      return { x: c.x, y: c.y, width: c.width, height: c.height };
    }
    const m = measuredSizesRef.current.get(c.id);
    return { x: c.x, y: c.y, width: m?.width || c.width, height: m?.height || c.height };
  };

  // Topmost element id under a world point (cards + zones — anything with geometry).
  const elementAtWorld = (wx: number, wy: number, exclude?: string): string | null => {
    let found: string | null = null, topZ = -Infinity;
    for (const c of cardsRef.current) {
      if (c.id === exclude) continue;
      const r = effectiveRect(c);
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height && (c.zIndex || 0) >= topZ) {
        found = c.id; topZ = c.zIndex || 0;
      }
    }
    return found;
  };

  // While dragging a new connector: track cursor + hovered target; finish/cancel.
  useEffect(() => {
    if (!connectFrom) return;
    const move = (e: MouseEvent) => {
      const w = screenToWorld(e.clientX, e.clientY);
      setConnectCursor(w);
      setConnectTarget(elementAtWorld(w.x, w.y, connectFrom));
    };
    const up = () => {
      const target = connectTargetRef.current;
      if (target && target !== connectFrom && onConnectorsChange) {
        const dup = connectors.some(c => (c.from === connectFrom && c.to === target) || (c.from === target && c.to === connectFrom));
        if (!dup) {
          const id = `conn-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
          onConnectorsChange([...connectors, { id, from: connectFrom, to: target }]);
          setSelectedConnectorId(id);
          soundService.play('drop');
        }
      }
      setConnectFrom(null); setConnectCursor(null); setConnectTarget(null);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setConnectFrom(null); setConnectCursor(null); setConnectTarget(null); } };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key); };
  }, [connectFrom, connectors, onConnectorsChange, pan, scale]);

  // Delete the selected connector with Delete/Backspace.
  useEffect(() => {
    if (!selectedConnectorId) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onConnectorsChange?.(connectors.filter(c => c.id !== selectedConnectorId));
        setSelectedConnectorId(null);
      } else if (e.key === 'Escape') {
        setSelectedConnectorId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedConnectorId, connectors, onConnectorsChange]);

  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  // Two-stage gesture: which card is EXPANDED (open editor). Selection alone no
  // longer expands — the first click selects, a second click / double-click opens.
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const handleExpand = useCallback((id: string) => setExpandedCardId(id), []);
  // Expansion is only valid while the card is the sole selection.
  useEffect(() => {
    if (expandedCardId && (selectedCardIds.length !== 1 || selectedCardIds[0] !== expandedCardId)) {
      setExpandedCardId(null);
    }
  }, [selectedCardIds, expandedCardId]);

  // Fullscreen card (lifted here so cards can render EXPANDED while fullscreen
  // regardless of selection — clicking/typing inside fullscreen must never
  // collapse the editor). Also silences canvas shortcuts while open.
  const [fullscreenCardId, setFullscreenCardId] = useState<string | null>(null);
  const fullscreenCardIdRef = useRef(fullscreenCardId);
  fullscreenCardIdRef.current = fullscreenCardId;
  const handleFullscreenChange = useCallback((id: string, next: boolean) => {
    setFullscreenCardId(curr => next ? id : (curr === id ? null : curr));
    if (next) setExpandedCardId(id);
  }, []);

  // Live drag: a transient composited offset applied to the moving card(s). Kept
  // out of the cards/nodes state so a drag does NO per-move history/reconcile/save
  // (which caused the flicker/"resistance"); committed to x/y once on drop.
  const [dragState, setDragState] = useState<{ ids: string[]; dx: number; dy: number } | null>(null);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  // Figma-style alignment guides shown while a drag is magnetically snapping.
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  // Whether a snap-suppress modifier (Cmd/Ctrl) is currently held (updated on drag).
  const snapDisabledRef = useRef(false);

  // When App adds a card, select it once it appears so it renders EXPANDED while
  // being placed (it collapses on its own when the user clicks away).
  useEffect(() => {
    if (selectCardId && cards.some(c => c.id === selectCardId)) {
      setSelectedCardIds([selectCardId]);
      setExpandedCardId(selectCardId); // a freshly-added card opens in its editor
      onCardSelected?.();
    }
  }, [selectCardId, cards, onCardSelected]);

  // Drawing States
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Lasso State
  const [lassoPath, setLassoPath] = useState<Position[]>([]);

  // Snapping / Grid Logic
  const [hoveredGridId, setHoveredGridId] = useState<string | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);

  // --- Infinite Background Logic ---
  const gridLayers = useMemo(() => {
    const layers = [];
    const baseSpacing = 40; 
    const logScale = Math.log10(scale);
    const currentPower = Math.floor(logScale);

    for (let i = -1; i <= 1; i++) {
      const power = -currentPower + i; 
      const worldSpacing = baseSpacing * Math.pow(10, power);
      const visualSpacing = worldSpacing * scale;
      let rawOpacity = 0;
      
      if (visualSpacing >= 15 && visualSpacing <= 250) {
        if (visualSpacing < 50) {
           rawOpacity = (visualSpacing - 15) / 35;
        } else if (visualSpacing > 100) {
           rawOpacity = 1 - (visualSpacing - 100) / 150;
        } else {
           rawOpacity = 1;
        }
      }
      const finalOpacity = Math.max(0, Math.min(1, rawOpacity)) * 0.3;
      if (finalOpacity > 0.01) {
        layers.push({ spacing: visualSpacing, opacity: finalOpacity, key: `grid-layer-${power}` });
      }
    }
    return layers;
  }, [scale]);

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom toward the pointer: keep the world point under the cursor fixed.
      // Pointer converted to container-local coords (pan is container-relative).
      const s = Math.exp(-e.deltaY * 0.005);
      const newScale = Math.min(Math.max(0.05, scale * s), 10);
      const r = containerRef.current?.getBoundingClientRect();
      const lx = e.clientX - (r?.left ?? 0);
      const ly = e.clientY - (r?.top ?? 0);
      const worldX = (lx - pan.x) / scale;
      const worldY = (ly - pan.y) / scale;
      onScaleChange(newScale);
      onPanChange({ x: lx - worldX * newScale, y: ly - worldY * newScale });
    } else {
      // Pan - Update prop
      onPanChange({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [scale, pan]); // Added pan dependency

  // --- Coordinate Utilities ---

  // --- Offset-aware coordinate helpers ---
  // The canvas container is NOT always at the viewport origin (e.g. when the
  // board shrinks into a rounded "window" while the chat drawer is open), so
  // client coords must first be translated into container-local space.
  // Pure math lives in services/coords.ts (unit-tested); these thin wrappers
  // just bind the live container rect / pan / scale.
  const toLocal = (cx: number, cy: number) =>
    coords.toLocal(cx, cy, containerRef.current?.getBoundingClientRect());
  const localToWorld = (lx: number, ly: number) => coords.localToWorld(lx, ly, pan, scale);
  const screenToWorld = (sx: number, sy: number) =>
    coords.screenToWorld(sx, sy, containerRef.current?.getBoundingClientRect(), pan, scale);

  // After an optimistic media insert, swap the local preview for the persisted
  // Storage URL once the background upload resolves, then revoke the objectURL.
  const swapMediaUrlWhenReady = (id: string, previewUrl: string, promise: Promise<string>) => {
    promise
      .then(finalUrl => {
        const updated = cardsRef.current.map(c =>
          c.id === id ? { ...c, content: { ...(c.content as any), url: finalUrl, uploading: false } } : c
        );
        (onCardsChangeSilent || onCardsChange)(updated);
        // Revoke the blob only AFTER the swap, on a delay, so the card never
        // points at a revoked URL mid-load (which showed "Failed to load").
        setTimeout(() => { try { URL.revokeObjectURL(previewUrl); } catch { /* already revoked */ } }, 15000);
      })
      // On failure keep the blob preview alive — the card stays visible.
      .catch(() => { /* persistMedia falls back to base64; blob left intact */ });
  };

  // Add one or more media files as ImageCards. A single file lands centered
  // (auto-fits up to 800px); several tile in a centered grid (each capped so
  // they don't overlap). Selects the new cards. Returns how many were added.
  const addMediaFiles = (rawFiles: File[], center: Position): number => {
    const files = rawFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length === 0) return 0;
    const allowed = files.filter(f => isWithinMediaLimit(f));
    if (allowed.length < files.length) alert(mediaLimitMessage());
    if (allowed.length === 0) return 0;

    const multi = allowed.length > 1;
    const CELL = 260, GAP = 28;
    const positions = multi ? tileGrid(allowed.length, CELL, GAP, center.x, center.y) : [{ x: center.x - 200, y: center.y - 150 }];

    const newCards: CardData[] = allowed.map((file, i) => {
      const isVideo = file.type.startsWith('video/');
      const id = `img-${Date.now()}-${i}-${Math.round(Math.random() * 1e4)}`;
      const { previewUrl, promise, posterPromise } = beginMediaUpload(file);
      const card: CardData = {
        id,
        type: CardType.IMAGE,
        x: positions[i].x,
        y: positions[i].y,
        width: multi ? CELL : 400,
        height: multi ? CELL : 300,
        zIndex: 100,
        content: {
          url: previewUrl,
          loading: true,
          uploading: true,
          mediaType: isVideo ? 'video' : 'image',
          ...(multi ? { maxFitDim: 240 } : {}),
        },
      };
      swapMediaUrlWhenReady(id, previewUrl, promise);
      // Poster frame for video — lets every thumbnail paint without downloading
      // the whole clip (see services/videoPoster).
      posterPromise.then(thumb => {
        if (!thumb) return;
        onCardsChange(cardsRef.current.map(c =>
          c.id === id ? { ...c, content: { ...(c.content as any), thumbnail: thumb } } : c));
      });
      return card;
    });

    onCardsChange([...cardsRef.current, ...newCards]);
    setSelectedCardIds(newCards.map(c => c.id));
    soundService.play('drop');
    return newCards.length;
  };

  // Card factory for a pasted/dropped URL: image URLs → ImageCard; everything
  // else → LinkCard sized per platform (YouTube 16:9, TikTok tall 9:16,
  // Instagram square+caption, Pinterest pin) so it lands "right" immediately.
  const cardForUrl = (url: string, worldCenter: Position): CardData => {
    const isImageUrl = /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(url);
    if (isImageUrl) {
      return {
        id: `img-${Date.now()}`,
        type: CardType.IMAGE,
        x: worldCenter.x - 200, y: worldCenter.y - 150,
        width: 400, height: 300, zIndex: 100,
        content: { url, loading: true }, // Component fetches and resizes
      };
    }
    const platform = guessUrlPlatform(url);
    const SIZE: Record<string, { w: number; h: number }> = {
      youtube:   { w: 480, h: 380 }, // 16:9 preview + header/footer
      tiktok:    { w: 300, h: 580 }, // tall vertical video
      instagram: { w: 360, h: 560 }, // square media + caption footer
      pinterest: { w: 300, h: 480 }, // pin ratio
      generic:   { w: 300, h: 240 },
    };
    const { w, h } = SIZE[platform];
    return {
      id: `link-${Date.now()}`,
      type: CardType.LINK,
      x: worldCenter.x - w / 2, y: worldCenter.y - h / 2,
      width: w, height: h, zIndex: 100,
      // Instant, network-free seed (platform/siteName/favicon + YT thumbnail) so
      // the card renders its final shape immediately; LinkCard enriches in the bg.
      content: seedLinkContent(url),
    };
  };

  // --- SMART PASTE IMPLEMENTATION ---

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
        // 1. Check if paste target is an input field
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
        
        // Helper to get paste coordinates
        const getPasteCoords = () => {
           if (cursorPos.x !== 0 && cursorPos.y !== 0) {
               return screenToWorld(cursorPos.x, cursorPos.y);
           }
           // Fallback: center of the CANVAS CONTAINER (not the viewport — the
           // board may be offset while the chat drawer is open).
           const r = containerRef.current?.getBoundingClientRect();
           return r
             ? localToWorld(r.width / 2, r.height / 2)
             : screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        };

        const createCardOnCanvas = (newCard: CardData) => {
             onCardsChange([...cardsRef.current, newCard]);
             setSelectedCardIds([newCard.id]);
             soundService.play('drop');
        };

        // 2. Check for Media Files (images OR video — binary data)
        if (e.clipboardData?.files.length > 0) {
            e.preventDefault();
            const files = Array.from(e.clipboardData.files);

            // Slot paste: if the pointer is over a card's paste zone (e.g. a PostCard
            // References / Final Assets area), route the pasted image(s) THERE — the
            // card adds them exactly like a manual upload — instead of a new ImageCard.
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (imageFiles.length > 0) {
                const overEl = document.elementFromPoint(cursorPos.x, cursorPos.y);
                const zone = overEl?.closest('[data-paste-zone]') as HTMLElement | null;
                if (zone) {
                    zone.dispatchEvent(new CustomEvent('sosa:paste-media', { detail: { files: imageFiles } }));
                    soundService.play('drop');
                    return;
                }
            }

            const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
            if (mediaFiles.length > 0) {
                // Optimistic + auto-tiled (multiple paste at once, no overlap).
                if (addMediaFiles(mediaFiles, getPasteCoords()) > 0) return;
            }
        }

        // 3. Sosa clipboard envelope → paste cards/connectors (cross-board).
        const rawText = e.clipboardData?.getData('text') || '';
        const envelope = parseClipboardText(rawText);
        const clip = envelope || (hasInternalClipboard() && !rawText.trim() ? getInternalClipboard() : null);
        if (clip) {
            // 3a. Copied on-board media object(s) dropped over a card slot → add the
            // media THERE (References / Final Assets / frames / cover) via the same
            // paste-zone channel as file paste, instead of a new canvas card.
            if (isAllMediaClipboard(clip.cards)) {
                const overEl = document.elementFromPoint(cursorPos.x, cursorPos.y);
                const zone = overEl?.closest('[data-paste-zone]') as HTMLElement | null;
                if (zone) {
                    const items = imageCardsToMediaItems(clip.cards);
                    if (items.length > 0) {
                        e.preventDefault();
                        zone.dispatchEvent(new CustomEvent('sosa:paste-media', { detail: { items } }));
                        soundService.play('drop');
                        return;
                    }
                }
            }
            e.preventDefault();
            insertClipboard(clip, getPasteCoords());
            return;
        }

        // 4. Check for URL / Text
        const text = rawText;
        if (text && isValidUrl(text.trim())) {
            e.preventDefault();
            createCardOnCanvas(cardForUrl(text.trim(), getPasteCoords()));
            return;
        }

        // 5. Plain text → a TextCard sized to the content, RTL-aware.
        if (text && text.trim()) {
            e.preventDefault();
            const raw = text.replace(/\r\n/g, '\n');
            const coords = getPasteCoords();
            const fontSize = 16;
            const lines = raw.split('\n');
            const longest = Math.max(...lines.map(l => l.length), 1);
            // Approx char width ≈ fontSize*0.55; clamp line width to a comfortable range.
            const cols = Math.min(Math.max(longest, 16), 55);
            const width = Math.min(Math.max(Math.round(cols * fontSize * 0.55) + 24, 160), 560);
            const align = defaultAlignFor(raw);
            const newTextCard: CardData = {
                id: `text-${Date.now()}`,
                type: CardType.TEXT,
                x: coords.x - width / 2,
                y: coords.y - 24,
                width,
                height: 50,
                zIndex: 100,
                content: { text: raw, fontSize, fontFamily: 'Inter', textAlign: align, color: '#1C1C1E' }
            };
            createCardOnCanvas(newTextCard);
        }
    };

    if (readOnly) return;
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pan, scale, cursorPos, onCardsChange, onConnectorsChange, connectors, readOnly]);

  // --- SELECTION HELPERS ---

  const handleSelectionAction = (id: string, options?: { toggle?: boolean, keepOthers?: boolean }) => {
      if (options?.toggle) {
          if (selectedCardIds.includes(id)) {
              setSelectedCardIds(prev => prev.filter(cId => cId !== id));
          } else {
              setSelectedCardIds(prev => [...prev, id]);
          }
      } else if (options?.keepOthers) {
          if (!selectedCardIds.includes(id)) {
              setSelectedCardIds(prev => [...prev, id]);
          }
      } else {
          // Exclusive Select
          setSelectedCardIds([id]);
      }
  };

  // --- MOUSE HANDLERS ---

  const handleMouseDown = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Read-only viewer: any drag just pans (no marquee / draw / selection).
    if (readOnly) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Clicking the canvas background deselects any selected connector.
    setSelectedConnectorId(null);

    // 1. Panning Priority (Space, Middle Click, or Pan Tool)
    if (isSpacePressed || activeTool === 'PAN' || e.button === 1) {
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
    }

    // 2. Tool Logic
    if (activeTool === 'SELECT') {
        if (e.button === 0) { // Left Click
            // Check if clicking background (cards stop propagation)
            if (!e.shiftKey) {
               setSelectedCardIds([]); // Clear selection on background click
            }
            // Start Marquee Selection (container-local coords — the render layer
            // is absolute inset-0 within the container).
            setSelectionBox({
                start: toLocal(e.clientX, e.clientY),
                current: toLocal(e.clientX, e.clientY)
            });
        }
    } else if (activeTool === 'TEXT') {
        const newCard: CardData = {
            id: `text-${Date.now()}`,
            type: CardType.TEXT,
            x: worldPos.x,
            y: worldPos.y,
            width: 300,
            height: 50,
            zIndex: 100,
            content: { text: 'Type something...', fontSize: 24, fontFamily: 'Inter', textAlign: 'left', color: '#1C1C1E' }
        };
        onCardsChange([...cards, newCard]);
        setSelectedCardIds([newCard.id]);
        onToolUsed(); 
        soundService.play('drop');
    } else if (activeTool === 'STICKY') {
        const newCard: CardData = {
            id: `sticky-${Date.now()}`,
            type: CardType.STICKY,
            x: worldPos.x - 110, 
            y: worldPos.y - 110,
            width: 220,
            height: 220,
            zIndex: 100,
            content: { text: '', color: '#FFF475', fontSize: 24, shape: 'square' }
        };
        onCardsChange([...cards, newCard]);
        setSelectedCardIds([newCard.id]);
        onToolUsed();
        soundService.play('drop');
    } else if (activeTool === 'REFERENCE') {
        const newCard: CardData = {
            id: `reference-${Date.now()}`,
            type: CardType.REFERENCE,
            x: worldPos.x - 350, 
            y: worldPos.y - 350,
            width: 700,
            height: 700,
            zIndex: 100,
            content: { 
                sku: `R-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
                title: '',
                source: '',
                whyILoveIt: '',
                whatToTake: '',
                vibeTags: [],
                comments: []
            }
        };
        onCardsChange([...cards, newCard]);
        onToolUsed();
        setSelectedCardIds([newCard.id]);
    } else if (activeTool === 'DOC') {
        const newCard: CardData = {
            id: `doc-${Date.now()}`,
            type: CardType.DOC,
            x: worldPos.x - 340,
            y: worldPos.y - 400,
            width: 680,
            height: 800,
            zIndex: 100,
            content: { 
                title: 'Untitled Document',
                body: '',
                author: 'Anonymous',
                date: new Date().toLocaleDateString()
            }
        };
        onCardsChange([...cards, newCard]);
        onToolUsed();
        setSelectedCardIds([newCard.id]);
    } else if (activeTool === 'PEN' || activeTool === 'HIGHLIGHTER') {
        setIsDrawing(true);
        setCurrentStroke([{ x: worldPos.x, y: worldPos.y }]);
    } else if (activeTool === 'ERASER') {
        setIsDrawing(true);
    } else if (activeTool === 'LASSO') {
        setIsDrawing(true);
        setLassoPath([{ x: worldPos.x, y: worldPos.y }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Track cursor for Smart Paste
    setCursorPos({ x: e.clientX, y: e.clientY });
    // Cmd/Ctrl held → suppress magnetic snapping (Figma convention).
    snapDisabledRef.current = e.metaKey || e.ctrlKey;

    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Pan Canvas
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      onPanChange({ x: pan.x + dx, y: pan.y + dy }); // Update prop
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Marquee Selection Update (container-local)
    if (selectionBox) {
        const p = toLocal(e.clientX, e.clientY);
        setSelectionBox(prev => ({ ...prev!, current: p }));
    }

    // Drawing Update
    if (isDrawing) {
        if (activeTool === 'PEN' || activeTool === 'HIGHLIGHTER') {
            setCurrentStroke(prev => [...prev, { x: worldPos.x, y: worldPos.y }]);
        } else if (activeTool === 'LASSO') {
            setLassoPath(prev => [...prev, { x: worldPos.x, y: worldPos.y }]);
        } else if (activeTool === 'ERASER') {
            const ERASER_RADIUS = 20 / scale;
            const remainingCards = cards.filter(c => {
                if (c.type !== CardType.STROKE) return true;
                if (
                    worldPos.x < c.x - ERASER_RADIUS || worldPos.x > c.x + c.width + ERASER_RADIUS ||
                    worldPos.y < c.y - ERASER_RADIUS || worldPos.y > c.y + c.height + ERASER_RADIUS
                ) return true;

                const content = c.content;
                const points = (content as StrokeCardContent).points;
                return !points.some(p => {
                    const px = c.x + p.x;
                    const py = c.y + p.y;
                    const dist = Math.sqrt(Math.pow(px - worldPos.x, 2) + Math.pow(py - worldPos.y, 2));
                    return dist < ERASER_RADIUS;
                });
            });
            
            if (remainingCards.length !== cards.length) {
                onCardsChange(remainingCards);
            }
        }
    }
  };

  cons