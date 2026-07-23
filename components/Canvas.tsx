
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

  const handleMouseUp = (e: React.MouseEvent) => {
    // Trigger drop sound if we were dragging a card
    if (draggingCardId) {
      soundService.play('drop');
    }

    // Finalize Marquee Selection
    if (selectionBox) {
        // selectionBox is stored container-local — convert directly to world.
        const startWorld = localToWorld(selectionBox.start.x, selectionBox.start.y);
        const endWorld = localToWorld(selectionBox.current.x, selectionBox.current.y);
        
        const minX = Math.min(startWorld.x, endWorld.x);
        const maxX = Math.max(startWorld.x, endWorld.x);
        const minY = Math.min(startWorld.y, endWorld.y);
        const maxY = Math.max(startWorld.y, endWorld.y);
        
        if (Math.abs(maxX - minX) > 2 || Math.abs(maxY - minY) > 2) {
             const intersectingIds = cards.filter(c => {
                const r = effectiveRect(c);
                return (minX < r.x + r.width && maxX > r.x && minY < r.y + r.height && maxY > r.y);
            }).map(c => c.id);

            if (e.shiftKey) {
                const newSet = new Set([...selectedCardIds, ...intersectingIds]);
                setSelectedCardIds(Array.from(newSet));
            } else {
                setSelectedCardIds(intersectingIds);
            }
        }
        setSelectionBox(null);
    }

    if (isDrawing) {
        if (activeTool === 'PEN' || activeTool === 'HIGHLIGHTER') {
            if (currentStroke.length > 2) {
                const xs = currentStroke.map(p => p.x);
                const ys = currentStroke.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);
                const width = maxX - minX;
                const height = maxY - minY;

                const relativePoints = currentStroke.map(p => ({
                    x: p.x - minX,
                    y: p.y - minY,
                    p: p.p
                }));

                const newCard: CardData = {
                    id: `stroke-${Date.now()}`,
                    type: CardType.STROKE,
                    x: minX,
                    y: minY,
                    width: Math.max(width, 1), 
                    height: Math.max(height, 1),
                    zIndex: 50,
                    content: {
                        points: relativePoints,
                        color: activeTool === 'HIGHLIGHTER' ? '#FFE500' : '#1C1C1E',
                        width: activeTool === 'HIGHLIGHTER' ? 20 : 4,
                        isHighlighter: activeTool === 'HIGHLIGHTER'
                    }
                };
                onCardsChange([...cards, newCard]);
            }
        } else if (activeTool === 'LASSO') {
            if (lassoPath.length > 2) {
                const lx = lassoPath.map(p => p.x);
                const ly = lassoPath.map(p => p.y);
                const minX = Math.min(...lx);
                const minY = Math.min(...ly);
                const maxX = Math.max(...lx);
                const maxY = Math.max(...ly);

                const hit = cards.filter(c => 
                    c.x >= minX && c.x + c.width <= maxX &&
                    c.y >= minY && c.y + c.height <= maxY
                ).map(c => c.id);
                
                if (hit.length > 0) setSelectedCardIds(hit);
            }
        }
    }

    setIsPanning(false);
    setIsDrawing(false);
    setCurrentStroke([]);
    setLassoPath([]);
    setDraggingCardId(null);
    setHoveredGridId(null);
    setHoveredSlotIndex(null);
  };

  // --- CRUD Handlers ---

  // Compute the full set of card ids that move together with `id`:
  // the whole selection if `id` is selected (else just `id`), plus ZONE children.
  const computeMovingIds = (id: string): string[] => {
    const ids = new Set<string>();
    if (selectedCardIds.includes(id)) selectedCardIds.forEach(cid => ids.add(cid));
    else ids.add(id);
    cardsRef.current.forEach(c => {
      if (ids.has(c.id) && c.type === CardType.ZONE) {
        (c.content as ZoneCardContent).childIds?.forEach(cid => ids.add(cid));
      }
    });
    return Array.from(ids);
  };

  // Live drag move — updates the transient offset (cheap, composited) and applies
  // magnetic snapping to nearby cards' edges/centers (unless Cmd/Ctrl is held).
  const handleDragMove = (id: string, dx: number, dy: number) => {
    if (draggingCardId !== id) setDraggingCardId(id);
    const ids = dragState && dragState.ids.includes(id) ? dragState.ids : computeMovingIds(id);
    const movingSet = new Set(ids);

    let snapDx = dx, snapDy = dy;
    let guides: SnapGuide[] = [];
    if (!snapDisabledRef.current && !isSpacePressed) {
      // Bounding box of the moving set at the raw (unsnapped) position.
      const movingRects = cardsRef.current.filter(c => movingSet.has(c.id)).map(effectiveRect);
      if (movingRects.length > 0) {
        const bx = Math.min(...movingRects.map(r => r.x)) + dx;
        const by = Math.min(...movingRects.map(r => r.y)) + dy;
        const br = Math.max(...movingRects.map(r => r.x + r.width)) + dx;
        const bb = Math.max(...movingRects.map(r => r.y + r.height)) + dy;
        const moving = { x: bx, y: by, width: br - bx, height: bb - by };
        // Snap against everything not moving and not a freeform stroke.
        const others = cardsRef.current
          .filter(c => !movingSet.has(c.id) && c.type !== CardType.STROKE)
          .map(effectiveRect);
        const res = computeSnap(moving, others, 8 / scale);
        snapDx = dx + res.dx;
        snapDy = dy + res.dy;
        guides = res.guides;
      }
    }
    setSnapGuides(guides);
    setDragState(prev =>
      prev && prev.ids.includes(id) ? { ...prev, dx: snapDx, dy: snapDy } : { ids, dx: snapDx, dy: snapDy }
    );
  };

  // Apply a moving card's drop into/out of a ZONE (membership + refit), operating
  // on a passed array so it composes with the position commit in one update.
  const withZoneMembership = (arr: CardData[], id: string): CardData[] => {
    const card = arr.find(c => c.id === id);
    if (!card || card.type === CardType.ZONE) return arr;
    const cardRect = effectiveRect(card);
    const cx = cardRect.x + cardRect.width / 2;
    const cy = cardRect.y + cardRect.height / 2;
    const targetZone = arr.find(z => z.type === CardType.ZONE &&
      cx >= z.x && cx <= z.x + z.width && cy >= z.y && cy <= z.y + z.height);
    // Is this a NEW membership (card wasn't already in the target zone)?
    const wasInTarget = targetZone
      ? ((targetZone.content as ZoneCardContent).childIds || []).includes(id)
      : false;

    let next = arr.map(c => {
      if (c.type !== CardType.ZONE) return c;
      const zc = c.content as ZoneCardContent;
      const childIds: string[] = zc.childIds || [];
      const has = childIds.includes(id);
      if (targetZone && c.id === targetZone.id) {
        if (!has) return { ...c, content: { ...zc, childIds: [...childIds, id] } };
      } else if (has) {
        return { ...c, content: { ...zc, childIds: childIds.filter(x => x !== id) } };
      }
      return c;
    });

    // "Magic" placement: a card newly dropped into a zone that overlaps an
    // existing member is nudged to the nearest free slot (right of the row it
    // landed on, else a new row) so it never lands on top of another card.
    if (targetZone && !wasInTarget) {
      const siblings = ((targetZone.content as ZoneCardContent).childIds || [])
        .filter(cid => cid !== id)
        .map(cid => next.find(c => c.id === cid))
        .filter(Boolean) as CardData[];
      const me = next.find(c => c.id === id)!;
      const meRect = effectiveRect(me);
      const overlaps = (a: Rect, b: Rect) =>
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      const GAP = 24;
      let placed = { x: me.x, y: me.y };
      const collides = () => siblings.some(s => {
        const sr = effectiveRect(s);
        return overlaps({ ...meRect, x: placed.x, y: placed.y }, sr);
      });
      if (collides()) {
        // Slide right past the sibling row that contains the drop point.
        const rowSibs = siblings
          .map(effectiveRect)
          .filter(sr => placed.y + meRect.height > sr.y && placed.y < sr.y + sr.height);
        const rightEdge = rowSibs.length ? Math.max(...rowSibs.map(sr => sr.x + sr.width)) : null;
        if (rightEdge != null) placed = { x: rightEdge + GAP, y: placed.y };
        // Still colliding → drop to a new row below everything.
        if (collides()) {
          const bottom = Math.max(...siblings.map(s => { const sr = effectiveRect(s); return sr.y + sr.height; }));
          placed = { x: placed.x, y: bottom + GAP };
        }
        next = next.map(c => c.id === id ? { ...c, x: placed.x, y: placed.y } : c);
      }
    }

    next = next.map(c => {
      if (c.type !== CardType.ZONE) return c;
      const fit = fitZoneToChildren(c, next);
      return fit ? { ...c, ...fit } : c;
    });
    return next;
  };

  // When a zone child's RENDERED size changes (expand/collapse, media load, text
  // growth) refit the owning zone frame silently so it keeps hugging its contents.
  // Guarded by a >1px delta to avoid save loops.
  useEffect(() => {
    if (!dragStateRef.current) {
      const zones = cardsRef.current.filter(c => c.type === CardType.ZONE);
      if (zones.length === 0) return;
      let changed = false;
      const next = cardsRef.current.map(c => {
        if (c.type !== CardType.ZONE) return c;
        const fit = fitZoneToChildren(c, cardsRef.current);
        if (fit && (Math.abs(fit.x - c.x) > 1 || Math.abs(fit.y - c.y) > 1 ||
                    Math.abs(fit.width - c.width) > 1 || Math.abs(fit.height - c.height) > 1)) {
          changed = true;
          return { ...c, ...fit };
        }
        return c;
      });
      if (changed) (onCardsChangeSilent || onCardsChange)(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureVersion]);

  // Escape mid-drag: throw away the pending offset so the cards snap back to
  // where they started. Nothing is written, so an accidental drag across a
  // carefully arranged board costs nothing.
  const handleDragCancel = useCallback(() => {
    setDragState(null);
    setDraggingCardId(null);
    setSnapGuides([]);
  }, []);

  // Drop — commit the accumulated offset to real x/y in a SINGLE update (one
  // history entry + one save), then resolve zone membership for single-card drags.
  const handleDragCommit = (id: string) => {
    const ds = dragStateRef.current;
    setDragState(null);
    setDraggingCardId(null);
    setSnapGuides([]);
    if (!ds || (ds.dx === 0 && ds.dy === 0)) return;
    const movingSet = new Set(ds.ids);
    let moved = cardsRef.current.map(c => movingSet.has(c.id) ? { ...c, x: c.x + ds.dx, y: c.y + ds.dy } : c);
    if (selectedCardIds.length <= 1) moved = withZoneMembership(moved, id);
    onCardsChange(moved);
  };

  // Direct single-card move (fallback for the non-transform path; rarely used now).
  const moveCardAbsolute = (id: string, x: number, y: number) => {
    onCardsChange(cardsRef.current.map(c => c.id === id ? { ...c, x, y } : c));
  };

  // Quick-add a card AT the right-click point (from the context-menu tools row).
  const addCardAtPoint = (type: CardType) => {
    if (!contextMenu) return;
    const world = screenToWorld(contextMenu.x, contextMenu.y);
    const size = TOOL_DEFAULT_SIZE[type] || { w: 340, h: 400 };
    const maxZ = cardsRef.current.reduce((m, c) => Math.max(m, c.zIndex || 1), 0);
    const newCard: CardData = {
      id: `card-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      type,
      x: world.x - size.w / 2,
      y: world.y - size.h / 2,
      width: size.w,
      height: size.h,
      zIndex: maxZ + 1,
      content: {} as any, // each card initializes its own defaults from empty content (same as the drawer)
    };
    onCardsChange([...cardsRef.current, newCard]);
    setSelectedCardIds([newCard.id]);
    soundService.play('drop');
    onQuickToolUsed?.(type);
    setContextMenu(null);
  };

  const updateCardGeometry = (id: string, geometry: { width?: number, height?: number, x?: number, y?: number }) => {
    onCardsChange(cards.map(c => c.id === id ? { ...c, ...geometry } : c));
  };
  
  const updateCardContent = (id: string, content: any) => {
    onCardsChange(cards.map(c => c.id === id ? { ...c, content } : c));
  };

  const handleDeleteCard = (id: string) => {
    if (selectedCardIds.includes(id)) {
        onCardsChange(cards.filter(c => !selectedCardIds.includes(c.id)));
        setSelectedCardIds([]);
    } else {
        onCardsChange(cards.filter(c => c.id !== id));
        if (selectedCardIds.includes(id)) {
            setSelectedCardIds(prev => prev.filter(cid => cid !== id));
        }
    }
  };

  const handleGroup = (color: string) => {
      if (!groupBounds) return;
      const newZoneId = Date.now().toString();
      const newZone: CardData = {
          id: newZoneId,
          type: CardType.ZONE,
          x: groupBounds.x - 20,
          y: groupBounds.y - 20,
          width: groupBounds.width + 40,
          height: groupBounds.height + 40,
          zIndex: Math.min(...cards.filter(c => selectedCardIds.includes(c.id)).map(c => c.zIndex)) - 1, // Place behind
          content: {
              title: 'Untitled Group',
              color,
              childIds: [...selectedCardIds]
          }
      };
      onCardsChange([...cards, newZone]);
      setSelectedCardIds([newZoneId]);
  };

  const handleUngroup = (zoneId: string) => {
      onCardsChange(cards.filter(c => c.id !== zoneId));
      setSelectedCardIds([]);
  };

  const handleAlign = (alignment: string) => {
      if (!groupBounds || selectedCardIds.length < 2) return;
      const selectedCards = cards.filter(c => selectedCardIds.includes(c.id));
      
      let newCards = [...cards];
      
      if (alignment === 'left') {
          newCards = newCards.map(c => selectedCardIds.includes(c.id) ? { ...c, x: groupBounds.x } : c);
      } else if (alignment === 'center') {
          newCards = newCards.map(c => selectedCardIds.includes(c.id) ? { ...c, x: groupBounds.x + groupBounds.width / 2 - c.width / 2 } : c);
      } else if (alignment === 'right') {
          newCards = newCards.map(c => selectedCardIds.includes(c.id) ? { ...c, x: groupBounds.x + groupBounds.width - c.width } : c);
      } else if (alignment === 'top') {
          newCards = newCards.map(c => selectedCardIds.includes(c.id) ? { ...c, y: groupBounds.y } : c);
      } else if (alignment === 'middle') {
          newCards = newCards.map(c => selectedCardIds.includes(c.id) ? { ...c, y: groupBounds.y + groupBounds.height / 2 - c.height / 2 } : c);
      } else if (alignment === 'bottom') {
          newCards = newCards.map(c => selectedCardIds.includes(c.id) ? { ...c, y: groupBounds.y + groupBounds.height - c.height } : c);
      } else if (alignment === 'distribute-h') {
          const sorted = [...selectedCards].sort((a, b) => a.x - b.x);
          const totalWidth = sorted.reduce((sum, c) => sum + c.width, 0);
          const gap = (groupBounds.width - totalWidth) / (sorted.length - 1);
          let currentX = groupBounds.x;
          sorted.forEach(c => {
              newCards = newCards.map(nc => nc.id === c.id ? { ...nc, x: currentX } : nc);
              currentX += c.width + gap;
          });
      } else if (alignment === 'distribute-v') {
          const sorted = [...selectedCards].sort((a, b) => a.y - b.y);
          const totalHeight = sorted.reduce((sum, c) => sum + c.height, 0);
          const gap = (groupBounds.height - totalHeight) / (sorted.length - 1);
          let currentY = groupBounds.y;
          sorted.forEach(c => {
              newCards = newCards.map(nc => nc.id === c.id ? { ...nc, y: currentY } : nc);
              currentY += c.height + gap;
          });
      }
      
      onCardsChange(newCards);
  };

  // Copy the current selection (expands zones to their children + captures internal
  // connectors) into both the in-memory clipboard and the system clipboard.
  const copyCurrentSelection = () => {
    if (selectedCardIds.length === 0) return null;
    const clip = copySelection(cards, selectedCardIds, connectors);
    try { navigator.clipboard?.writeText(serializeClipboard(clip)); } catch { /* best effort */ }
    return clip;
  };

  // Insert a materialized clipboard at a free spot near a world point; selects the
  // pasted cards. Cards are added BEFORE connectors so connector pruning in
  // writeCards sees the new cards.
  const insertClipboard = (clip: ReturnType<typeof getInternalClipboard>, worldPoint: Position) => {
    if (!clip || clip.cards.length === 0) return;
    const bounds = clipboardBounds(clip);
    const obstacles = cardsRef.current.map(effectiveRect);
    const spot = findFreeSpot(bounds, obstacles, { x: worldPoint.x - bounds.width / 2, y: worldPoint.y - bounds.height / 2 });
    const maxZ = cardsRef.current.reduce((m, c) => Math.max(m, c.zIndex || 1), 0);
    const { cards: newCards, connectors: newConnectors } = materializePaste(clip, spot, maxZ);
    onCardsChange([...cardsRef.current, ...newCards]);
    if (newConnectors.length > 0 && onConnectorsChange) onConnectorsChange([...connectors, ...newConnectors]);
    setSelectedCardIds(newCards.map(c => c.id));
    soundService.play('drop');
  };

  // Duplicate in place (offset), reusing the copy/materialize machinery so zones
  // duplicate WITH their children (and remapped childIds — fixes the shared-id bug)
  // and internal connectors come along.
  const handleDuplicateSelection = () => {
      if (selectedCardIds.length === 0) return;
      const clip = copySelection(cards, selectedCardIds, connectors);
      const bounds = clipboardBounds(clip);
      const maxZ = cards.reduce((m, c) => Math.max(m, c.zIndex || 1), 0);
      const { cards: newCards, connectors: newConnectors } = materializePaste(clip, { x: bounds.x + 24, y: bounds.y + 24 }, maxZ);
      onCardsChange([...cards, ...newCards]);
      if (newConnectors.length > 0 && onConnectorsChange) onConnectorsChange([...connectors, ...newConnectors]);
      setSelectedCardIds(newCards.map(c => c.id));
  };

  const handleLockToggle = () => {
      const sel = cards.filter(c => selectedCardIds.includes(c.id));
      const allLocked = sel.every(c => c.isLocked);
      // Locking a zone cascades to its children so the whole group locks together.
      const ids = new Set(selectedCardIds);
      sel.forEach(c => {
          if (c.type === CardType.ZONE) (c.content as ZoneCardContent).childIds?.forEach(id => ids.add(id));
      });
      onCardsChange(cards.map(c => ids.has(c.id) ? { ...c, isLocked: !allLocked } : c));
  };

  // Toggle lock for a whole group given ANY member id (used by the unlock pill):
  // a zone → its children; a child → its owning zone + all its children.
  const handleToggleLockById = (id: string) => {
      const target = cards.find(c => c.id === id);
      if (!target) return;
      const newLocked = !target.isLocked;
      const ids = new Set<string>([id]);
      if (target.type === CardType.ZONE) (target.content as ZoneCardContent).childIds?.forEach(c => ids.add(c));
      const owningZone = cards.find(z => z.type === CardType.ZONE && (z.content as ZoneCardContent).childIds?.includes(id));
      if (owningZone) { ids.add(owningZone.id); (owningZone.content as ZoneCardContent).childIds?.forEach(c => ids.add(c)); }
      onCardsChange(cards.map(c => ids.has(c.id) ? { ...c, isLocked: newLocked } : c));
  };

  const handleDeleteSelection = () => {
      onCardsChange(cards.filter(c => !selectedCardIds.includes(c.id)));
      setSelectedCardIds([]);
      setContextMenu(null);
  };

  // Pin/unpin a content card as "keep expanded" (never auto-collapses).
  const handleToggleAlwaysExpanded = (id: string) => {
      onCardsChange(cards.map(c => c.id === id ? { ...c, alwaysExpanded: !c.alwaysExpanded } : c));
  };

  const handleSendToBack = () => {
      const minZ = Math.min(...cards.map(c => c.zIndex || 1));
      onCardsChange(cards.map(c => selectedCardIds.includes(c.id) ? { ...c, zIndex: minZ - 1 } : c));
  };

  const handleBringSelectionToFront = () => {
      const maxZ = Math.max(...cards.map(c => c.zIndex || 1));
      onCardsChange(cards.map(c => selectedCardIds.includes(c.id) ? { ...c, zIndex: maxZ + 1 } : c));
  };

  // --- Right-click context menu ---
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const handleCardContextMenu = (e: React.MouseEvent, id: string) => {
      setSelectedCardIds(prev => prev.includes(id) ? prev : [id]);
      setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Bounding box of a zone's children + padding (room for the name tag on top).
  const fitZoneToChildren = (zone: CardData, all: CardData[]): { x: number; y: number; width: number; height: number } | null => {
      const zc = zone.content as ZoneCardContent;
      const children = (zc.childIds || []).map(id => all.find(c => c.id === id)).filter(Boolean) as CardData[];
      if (children.length === 0) return null;
      const PADDING = 28;
      const TOP = 44;
      // Measured rects: media/content cards render taller than card.height —
      // the frame must wrap what's actually on screen.
      const rects = children.map(effectiveRect);
      const minX = Math.min(...rects.map(r => r.x));
      const minY = Math.min(...rects.map(r => r.y));
      const maxX = Math.max(...rects.map(r => r.x + r.width));
      const maxY = Math.max(...rects.map(r => r.y + r.height));
      return { x: minX - PADDING, y: minY - TOP, width: (maxX - minX) + PADDING * 2, height: (maxY - minY) + TOP + PADDING };
  };

  // After dragging a single card: (un)assign it to a zone by its center, then
  // refit every zone to its children so the frame tracks the layout.
  // Auto-arrange a zone's children into a tidy grid, then fit the zone to them.
  const handleTidyZone = (zoneId: string) => {
      const zone = cards.find(c => c.id === zoneId);
      if (!zone) return;
      const zc = zone.content as ZoneCardContent;
      const children = (zc.childIds || []).map(id => cards.find(c => c.id === id)).filter(Boolean) as CardData[];
      if (children.length === 0) return;
      const PADDING = 28;
      const TOP = 44; // room below the name tag
      const GAP = 24;
      const cols = Math.ceil(Math.sqrt(children.length));
      const rows = Math.ceil(children.length / cols);
      const cellW = Math.max(...children.map(c => c.width));
      const cellH = Math.max(...children.map(c => c.height));
      const startX = zone.x + PADDING;
      const startY = zone.y + TOP;
      const pos = new Map<string, { x: number; y: number }>();
      children.forEach((c, i) => {
          pos.set(c.id, { x: startX + (i % cols) * (cellW + GAP), y: startY + Math.floor(i / cols) * (cellH + GAP) });
      });
      const newW = PADDING * 2 + cols * cellW + (cols - 1) * GAP;
      const newH = TOP + PADDING + rows * cellH + (rows - 1) * GAP;
      onCardsChange(cards.map(c => {
          if (c.id === zoneId) return { ...c, width: newW, height: newH };
          const p = pos.get(c.id);
          return p ? { ...c, x: p.x, y: p.y } : c;
      }));
      setContextMenu(null);
  };

  const bringToFront = (id: string, options?: { toggle?: boolean, keepOthers?: boolean }) => {
    handleSelectionAction(id, options);
    const maxZ = Math.max(...cards.map(c => c.zIndex || 1));
    const target = cards.find(c => c.id === id);
    // Skip the write entirely if the card is already on top — avoids a needless
    // save on every click. Otherwise bump z-index SILENTLY (not an undo step).
    if (target && (target.zIndex || 1) >= maxZ) return;
    const applyZ = onCardsChangeSilent || onCardsChange;
    applyZ(cards.map(c => c.id === id ? { ...c, zIndex: maxZ + 1 } : c));
  };

  // --- GRID PLANNER LINKING HANDLERS ---

  const handleLinkPost = (gridId: string, slotIndex: number, postId: string) => {
      const newCards = cards.map(c => {
          if (c.id === gridId) {
             const content = c.content as GridPlannerContent;
             const newConnections = { ...content.connections, [slotIndex]: postId };
             return { ...c, content: { ...content, connections: newConnections } };
          }
          return c;
      });
      onCardsChange(newCards);
  };

  const handleUnlink = (gridId: string, slotIndex: number, _postId: string) => {
      const newCards = cards.map(c => {
          if (c.id === gridId) {
             const content = c.content as GridPlannerContent;
             const newConnections = { ...content.connections };
             delete newConnections[slotIndex];
             return { ...c, content: { ...content, connections: newConnections } };
          }
          return c;
      });
      onCardsChange(newCards);
  };

  const handleSwapSlots = (gridId: string, slotA: number, slotB: number) => {
      const newCards = cards.map(c => {
          if (c.id === gridId) {
             const content = c.content as GridPlannerContent;
             const connections = { ...content.connections };
             
             const postA = connections[slotA];
             const postB = connections[slotB];

             if (postB) connections[slotA] = postB; else delete connections[slotA];
             if (postA) connections[slotB] = postA; else delete connections[slotB];

             return { ...c, content: { ...content, connections } };
          }
          return c;
      });
      onCardsChange(newCards);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // What a key means is decided by a pure function (services/boardKeys) so the
      // rules — especially "never act while typing" — are unit-tested.
      const action = resolveBoardKey(e, {
        typing: ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable,
        // While a card is fullscreen it owns its keys (Delete would remove the very
        // card being edited; Escape closes it).
        fullscreen: !!fullscreenCardIdRef.current,
        selectedCount: selectedCardIds.length,
        expanded: !!expandedCardId,
      });
      if (!action) return;

      switch (action.kind) {
        case 'delete':
          onCardsChange(cards.filter(c => !selectedCardIds.includes(c.id)));
          setSelectedCardIds([]);
          break;
        case 'collapse':
          // Close the editor but KEEP the card selected — Escape peels one layer.
          setExpandedCardId(null);
          break;
        case 'deselect':
          setSelectedCardIds([]);
          setSelectionBox(null);
          setIsDrawing(false);
          setContextMenu(null);
          break;
        case 'open':
          setExpandedCardId(selectedCardIds[0]);
          break;
        case 'selectAll':
          e.preventDefault();
          setSelectedCardIds(cards.map(c => c.id));
          break;
        case 'copy':
          copyCurrentSelection();
          break;
        case 'cut':
          copyCurrentSelection();
          onCardsChange(cards.filter(c => !selectedCardIds.includes(c.id)));
          setSelectedCardIds([]);
          break;
        case 'duplicate':
          e.preventDefault(); // Cmd+D is "bookmark" in the browser
          handleDuplicateSelection();
          break;
        case 'nudge': {
          e.preventDefault(); // arrows would scroll the page
          const next = nudgeCards(cards, selectedCardIds, action.dx, action.dy);
          if (next !== cards) onCardsChange(next);
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardIds, cards, connectors, expandedCardId]);

  const isPostLinked = (postId: string) => {
    return cards.some(c => 
      c.type === CardType.GRID_PLANNER && 
      Object.values((c.content as GridPlannerContent).connections || {}).includes(postId)
    );
  };

  // Synced date from a Grid connection (shared slot↔date logic).
  const getLinkedDate = (postId: string): Date | null => {
    const linked = findLinkedGrid(cards, postId);
    if (!linked) return null;
    return getSlotDate(linked.grid.content as GridPlannerContent, linked.slotIndex);
  };

  const renderCard = (card: CardData) => {
    const commonProps = {
      card,
      isSelected: selectedCardIds.includes(card.id),
      onSelect: bringToFront,
      onMove: moveCardAbsolute,
      onDragMove: handleDragMove,
      onDragCommit: handleDragCommit,
      dragOffset: dragState && dragState.ids.includes(card.id)
        ? { x: dragState.dx, y: dragState.dy }
        : undefined,
      onDelete: handleDeleteCard,
      onUpdateContent: updateCardContent,
      onResize: updateCardGeometry,
      onContextMenu: handleCardContextMenu,
      onToggleLock: handleToggleLockById,
      isMultiSelect: selectedCardIds.length > 1,
      zoomScale: scale,
      isExpanded: expandedCardId === card.id,
      onExpand: handleExpand,
      onDragCancel: handleDragCancel,
      isFullscreen: fullscreenCardId === card.id,
      onFullscreenChange: handleFullscreenChange,
      onOpenComments
    };

    const cardElement = (() => { switch (card.type) {
      case CardType.POST:
        return (
            <PostCard 
                key={card.id}
                {...commonProps} 
                isLinked={isPostLinked(card.id)} 
                linkedDate={getLinkedDate(card.id) || undefined}
            />
        );
      case CardType.STRATEGY_AI:
        return <AiStrategyCard key={card.id} {...commonProps} />;
      case CardType.ANALYTICS:
        return <AnalyticsCard key={card.id} {...commonProps} />;
      case CardType.GRID_PLANNER:
        return (
          <GridPlannerCard 
            key={card.id}
            {...commonProps} 
            allCards={cards}
            onUnlink={handleUnlink} 
            onLinkPost={handleLinkPost} 
            onSwapSlots={handleSwapSlots}
            hoveredSlotIndex={null}
          />
        );
      case CardType.PINTEREST:
        return <PinterestCard key={card.id} {...commonProps} />;
      case CardType.TEXT:
        return <TextCard key={card.id} {...commonProps} />;
      case CardType.STICKY:
        return <StickyCard key={card.id} {...commonProps} />;
      case CardType.STROKE:
        return <StrokeCard key={card.id} {...commonProps} />;
      case CardType.LINK:
        return <LinkCard key={card.id} {...commonProps} />;
      case CardType.IMAGE:
        return <ImageCard key={card.id} {...commonProps} />;
      case CardType.GANTT:
        return <GanttCard key={card.id} {...commonProps} />;
      case CardType.ADS_TEST:
        return <AdsTestCard key={card.id} {...commonProps} />;
      case CardType.NEWSLETTER:
        return <NewsletterCard key={card.id} {...commonProps} />;
      case CardType.REFERENCE:
        return <ReferenceCard key={card.id} {...commonProps} />;
      case CardType.DOC:
        return <DocCard key={card.id} {...commonProps} />;
        
      // --- PRODUCTION SUITE ---
      case CardType.FILMSTRIP:
        return <FilmstripCard key={card.id} {...commonProps} />;
      case CardType.AV_SCRIPT:
        return <AvScriptCard key={card.id} {...commonProps} />;
      case CardType.CALL_SHEET:
        return <CallSheetCard key={card.id} {...commonProps} />;
      case CardType.CASTING_BOARD:
        return <CastingBoardCard key={card.id} {...commonProps} />;
      case CardType.PROP_TABLE:
        return <PropTableCard key={card.id} {...commonProps} />;
        
      case CardType.STORY:
        return <StoryCard key={card.id} {...commonProps} />;

      case CardType.REELS:
        return (
            <ReelsCard
                key={card.id}
                {...commonProps}
                isLinked={isPostLinked(card.id)}
                linkedDate={getLinkedDate(card.id) || undefined}
            />
        );

      case CardType.ZONE:
        return <ZoneCard key={card.id} {...commonProps} />;
        
      default:
        return <PostCard key={card.id} {...commonProps} />;
    } })();

    return <CardErrorBoundary key={card.id}>{cardElement}</CardErrorBoundary>;
  };

  const groupBounds = useMemo(() => {
      if (selectedCardIds.length <= 1) return null;
      const selectedCards = cards.filter(c => selectedCardIds.includes(c.id));
      if (selectedCards.length === 0) return null;

      const rects = selectedCards.map(effectiveRect);
      const minX = Math.min(...rects.map(r => r.x));
      const minY = Math.min(...rects.map(r => r.y));
      const maxX = Math.max(...rects.map(r => r.x + r.width));
      const maxY = Math.max(...rects.map(r => r.y + r.height));

      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      // measureVersion: recompute when a selected card's rendered size changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardIds, cards, measureVersion]);

  const isPanMode = isSpacePressed || activeTool === 'PAN' || isPanning;

  // --- DRAG FILES FROM THE COMPUTER ONTO THE BOARD ---
  const [isFileDragOver, setIsFileDragOver] = useState(false);

  const handleCanvasDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    // Files from the computer, OR links/images dragged from another browser tab
    // (e.g. a Pinterest pin) — both are droppable.
    if (!types.includes('Files') && !types.includes('text/uri-list') && !types.includes('text/html')) return;
    e.preventDefault();
    setIsFileDragOver(true);
  };

  // First usable URL from a cross-tab drag: uri-list line, else <img src> / <a href>
  // out of the dragged HTML fragment.
  const urlFromDrag = (dt: DataTransfer): string | null => {
    const uri = (dt.getData('text/uri-list') || '').split('\n').find(l => l && !l.startsWith('#'))?.trim();
    if (uri && isValidUrl(uri)) return uri;
    const html = dt.getData('text/html');
    if (html) {
      const img = html.match(/<img[^>]+src="([^"]+)"/i)?.[1];
      if (img && isValidUrl(img)) return img;
      const a = html.match(/<a[^>]+href="([^"]+)"/i)?.[1];
      if (a && isValidUrl(a)) return a;
    }
    const plain = (dt.getData('text/plain') || '').trim();
    return plain && isValidUrl(plain) ? plain : null;
  };

  const handleCanvasDrop = async (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files || []).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (files.length === 0) {
      // No files → maybe a link/image dragged from another tab (Pinterest pin etc.)
      const url = urlFromDrag(e.dataTransfer);
      setIsFileDragOver(false);
      if (!url) return;
      e.preventDefault();
      const newCard = cardForUrl(url, screenToWorld(e.clientX, e.clientY));
      onCardsChange([...cardsRef.current, newCard]);
      setSelectedCardIds([newCard.id]);
      soundService.play('drop');
      return;
    }
    e.preventDefault();
    setIsFileDragOver(false);
    // Optimistic + auto-tiled: all files paste at once and lay out without overlap.
    addMediaFiles(files, screenToWorld(e.clientX, e.clientY));
  };

  // --- Connector render helpers ---
  // Rect for an element, including any live drag offset so arrows follow during a drag.
  const rectFor = (c: CardData): Rect => {
    const moving = dragState && dragState.ids.includes(c.id);
    const r = effectiveRect(c);
    return { x: r.x + (moving ? dragState!.dx : 0), y: r.y + (moving ? dragState!.dy : 0), width: r.width, height: r.height };
  };
  const rectById = (id: string): Rect | null => { const c = cards.find(x => x.id === id); return c ? rectFor(c) : null; };

  const worldCursor = screenToWorld(cursorPos.x, cursorPos.y);
  const hoverDotsCardId = (!readOnly && showConnectors && activeTool === 'SELECT' && !isPanning && !dragState && !connectFrom && !selectionBox && selectedCardIds.length === 0)
    ? elementAtWorld(worldCursor.x, worldCursor.y)
    : null;

  const selectedConnector = connectors.find(c => c.id === selectedConnectorId) || null;
  const connectorToolbarPos = (() => {
    if (!selectedConnector) return null;
    const a = rectById(selectedConnector.from), b = rectById(selectedConnector.to);
    if (!a || !b) return null;
    const an = anchors(a, b); const m = midPoint(an.from, an.to);
    return { left: m.x * scale + pan.x, top: m.y * scale + pan.y - 46 };
  })();

  // Edge-midpoint connect dots for the hovered element (constant screen size).
  const connectDots = (rect: Rect, fromId: string) => {
    const r = 6 / scale, sw = 2 / scale;
    const pts = [
      { x: rect.x + rect.width / 2, y: rect.y },                 // top
      { x: rect.x + rect.width, y: rect.y + rect.height / 2 },   // right
      { x: rect.x + rect.width / 2, y: rect.y + rect.height },   // bottom
      { x: rect.x, y: rect.y + rect.height / 2 },                // left
    ];
    return pts.map((p, i) => (
      <circle
        key={i} cx={p.x} cy={p.y} r={r}
        fill="#fff" stroke="#3A5C34" strokeWidth={sw}
        style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setSelectedConnectorId(null); setConnectTarget(null); setConnectCursor(worldCursor); setConnectFrom(fromId); }}
      />
    ));
  };

  return (
    // Changed bg from #f3f4f6 to #F9F8F6 (Warm Stone)
    <div 
      ref={containerRef}
      className={`w-full h-full bg-[#F9F8F6] relative overflow-hidden ${isPanMode ? 'cursor-grab active:cursor-grabbing' : (activeTool === 'SELECT' ? 'cursor-default' : 'cursor-crosshair')}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={readOnly ? (e) => e.preventDefault() : (e) => { e.preventDefault(); setSelectedCardIds([]); setContextMenu({ x: e.clientX, y: e.clientY }); }}
      onDragOver={readOnly ? undefined : handleCanvasDragOver}
      onDragLeave={readOnly ? undefined : (e) => { if (e.currentTarget === e.target) setIsFileDragOver(false); }}
      onDrop={readOnly ? undefined : handleCanvasDrop}
    >
      {isFileDragOver && (
        <div className="absolute inset-3 z-[150] pointer-events-none rounded-3xl border-2 border-dashed border-[#3A5C34] bg-[#3A5C34]/5 flex items-center justify-center">
          <span className="px-4 py-2 rounded-full bg-white shadow-md text-[13px] font-semibold text-[#3A5C34]">Drop image or video to add</span>
        </div>
      )}
      {gridLayers.map((layer) => (
        <div 
          key={layer.key}
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundSize: `${layer.spacing}px ${layer.spacing}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            // Changed radial gradient from gray to burgundy for brand consistency
            backgroundImage: `radial-gradient(circle, rgba(95, 36, 39, ${layer.opacity}) 1.5px, transparent 1.5px)`,
            opacity: 1 
          }}
        />
      ))}

      {/* Connector lines — BELOW cards (Miro-style). pointer-events only on hit paths. */}
      {showConnectors && connectors.length > 0 && (
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5, overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <marker id="conn-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
            </marker>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
            {connectors.map(conn => {
              const a = rectById(conn.from), b = rectById(conn.to);
              if (!a || !b) return null;
              const an = anchors(a, b);
              const d = connectorPath(conn.routing, an.from, an.to);
              const color = conn.color || DEFAULT_CONNECTOR_COLOR;
              const w = conn.width || 2;
              const isSel = conn.id === selectedConnectorId;
              const mid = midPoint(an.from, an.to);
              const labelW = (conn.label?.length || 0) * 6.6 + 14;
              return (
                <g key={conn.id}>
                  {/* fat invisible hit area */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: readOnly ? 'none' : 'stroke', cursor: 'pointer' }}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedCardIds([]); setSelectedConnectorId(conn.id); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedCardIds([]); setSelectedConnectorId(conn.id); }} />
                  {isSel && <path d={d} fill="none" stroke="#FFD753" strokeWidth={w + 4} strokeLinecap="round" opacity={0.6} style={{ pointerEvents: 'none' }} />}
                  <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round"
                    strokeDasharray={dashArrayFor(conn.lineStyle)}
                    markerStart={conn.arrowStart ? 'url(#conn-arrow)' : undefined}
                    markerEnd={conn.arrowEnd === false ? undefined : 'url(#conn-arrow)'}
                    style={{ pointerEvents: 'none' }} />
                  {conn.label && (
                    <g transform={`translate(${mid.x} ${mid.y})`} style={{ pointerEvents: 'none' }}>
                      <rect x={-labelW / 2} y={-9} width={labelW} height={18} rx={5} fill="#fff" stroke={color} strokeWidth={1} opacity={0.95} />
                      <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#5F2427">{conn.label}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}

      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          pointerEvents: (isPanMode || readOnly) ? 'none' : 'auto'
        }}
      >
        <CardMeasureContext.Provider value={handleCardMeasure}>
        {/* Render GANTT cards first (background layer) */}
        {cards.filter(c => c.type === CardType.GANTT).map(renderCard)}
        {/* Render all other cards */}
        {cards.filter(c => c.type !== CardType.GANTT).map(renderCard)}
        </CardMeasureContext.Provider>
        
        {groupBounds && !dragState && (
            <div
                className="absolute border border-[#3A5C34] pointer-events-none z-[60]"
                style={{
                    left: groupBounds.x,
                    top: groupBounds.y,
                    width: groupBounds.width,
                    height: groupBounds.height,
                }}
            />
        )}

        {/* Alignment snap guides (burgundy, 1 screen-px at any zoom) */}
        {snapGuides.map((g, i) => (
            <div
                key={i}
                className="absolute pointer-events-none z-[9997]"
                style={g.orientation === 'v' ? {
                    left: g.position,
                    top: Math.min(g.from, g.to),
                    width: 1 / scale,
                    height: Math.abs(g.to - g.from),
                    backgroundColor: '#5F2427',
                } : {
                    left: Math.min(g.from, g.to),
                    top: g.position,
                    width: Math.abs(g.to - g.from),
                    height: 1 / scale,
                    backgroundColor: '#5F2427',
                }}
            />
        ))}

        {/* Selection Toolbar */}
        <SelectionToolbar
            selectedCards={cards.filter(c => selectedCardIds.includes(c.id))}
            groupBounds={groupBounds}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            onAlign={handleAlign}
            onDuplicate={handleDuplicateSelection}
            onLockToggle={handleLockToggle}
            onDelete={handleDeleteSelection}
        />
      </div>

      {/* Connector creation overlay — ABOVE cards so hover-dots are grabbable. */}
      {showConnectors && !readOnly && (
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 55, overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <marker id="conn-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
            </marker>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
            {connectFrom && connectCursor && (() => {
              const a = rectById(connectFrom); if (!a) return null;
              const targetRect = connectTarget && connectTarget !== connectFrom ? rectById(connectTarget) : null;
              const aPt = targetRect ? anchors(a, targetRect).from : { x: a.x + a.width / 2, y: a.y + a.height / 2 };
              const bPt = targetRect ? anchors(a, targetRect).to : connectCursor;
              return (
                <g>
                  <path d={connectorPath('bezier', aPt, bPt)} fill="none" stroke="#3A5C34" strokeWidth={2} strokeDasharray="6 5" markerEnd="url(#conn-arrow)" />
                  {targetRect && <rect x={targetRect.x} y={targetRect.y} width={targetRect.width} height={targetRect.height} rx={12} fill="none" stroke="#3A5C34" strokeWidth={2} opacity={0.7} />}
                </g>
              );
            })()}
            {hoverDotsCardId && (() => { const r = rectById(hoverDotsCardId); return r ? <g>{connectDots(r, hoverDotsCardId)}</g> : null; })()}
          </g>
        </svg>
      )}

      {/* Connector toolbar (when a connector is selected) */}
      {selectedConnector && connectorToolbarPos && !readOnly && (
        <ConnectorToolbar
          connector={selectedConnector}
          onChange={(patch) => onConnectorsChange?.(connectors.map(c => c.id === selectedConnector.id ? { ...c, ...patch } : c))}
          onDelete={() => { onConnectorsChange?.(connectors.filter(c => c.id !== selectedConnector.id)); setSelectedConnectorId(null); }}
          style={connectorToolbarPos}
        />
      )}

      <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full overflow-visible">
              {isDrawing && currentStroke.length > 0 && (
                  <path 
                    d={`M ${currentStroke.map(p => `${(p.x * scale) + pan.x} ${(p.y * scale) + pan.y}`).join(' L ')}`}
                    stroke={activeTool === 'HIGHLIGHTER' ? '#FFE500' : '#1C1C1E'}
                    strokeWidth={(activeTool === 'HIGHLIGHTER' ? 20 : 4) * scale}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={activeTool === 'HIGHLIGHTER' ? 0.5 : 1}
                  />
              )}
              {isDrawing && activeTool === 'LASSO' && lassoPath.length > 0 && (
                   <path 
                   d={`M ${lassoPath.map(p => `${(p.x * scale) + pan.x} ${(p.y * scale) + pan.y}`).join(' L ')} Z`}
                   stroke="#3A5C34"
                   strokeWidth={2}
                   fill="rgba(58, 92, 52, 0.1)"
                   strokeDasharray="5,5"
                 />
              )}
          </svg>
          
          {selectionBox && (
              <div 
                  className="absolute bg-[#3A5C34]/10 border border-[#3A5C34] z-[9999]"
                  style={{
                      left: Math.min(selectionBox.start.x, selectionBox.current.x),
                      top: Math.min(selectionBox.start.y, selectionBox.current.y),
                      width: Math.abs(selectionBox.current.x - selectionBox.start.x),
                      height: Math.abs(selectionBox.current.y - selectionBox.start.y),
                  }}
              />
          )}
      </div>

      {/* Right-click context menu (context-aware) */}
      {contextMenu && (() => {
        const sel = cards.filter(c => selectedCardIds.includes(c.id));
        const single = sel.length === 1 ? sel[0] : null;
        const isZone = single?.type === CardType.ZONE;
        const multi = sel.length >= 2;
        const hasZone = sel.some(c => c.type === CardType.ZONE);
        const allLocked = sel.length > 0 && sel.every(c => c.isLocked);
        const close = () => setContextMenu(null);
        const run = (fn: () => void) => { fn(); close(); };

        type Item = { icon: any; label: string; onClick: () => void; danger?: boolean; disabled?: boolean };
        const items: (Item | 'sep' | 'colorrow' | 'toolsrow' | 'alignrow')[] = [];
        const GROUP_COLORS = ['#FCCAE2', '#FFD753', '#3A5C34', '#5F2427', '#F9E6D1', '#007AFF', '#8E8E93'];
        const quickTools = recentTools.filter(t => TOOL_VISUALS[t]).slice(0, 4);
        const canPaste = hasInternalClipboard();
        const menuWorld = screenToWorld(contextMenu.x, contextMenu.y);
        const expandableTypes = [CardType.POST, CardType.STORY, CardType.REELS, CardType.DOC];

        if (sel.length === 0) {
          // Empty canvas
          if (quickTools.length > 0) { items.push('toolsrow'); items.push('sep'); }
          if (canPaste) items.push({ icon: ClipboardPaste, label: 'Paste here', onClick: () => run(() => insertClipboard(getInternalClipboard(), menuWorld)) });
          items.push({ icon: MousePointerSquareDashed, label: 'Select all', onClick: () => run(() => setSelectedCardIds(cards.map(c => c.id))) });
        } else if (allLocked) {
          // Locked selection: only unlock + copy are meaningful.
          items.push({ icon: Unlock, label: 'Unlock', onClick: () => run(handleLockToggle) });
          items.push({ icon: Copy, label: 'Copy', onClick: () => run(() => { copyCurrentSelection(); }) });
        } else {
          if (multi) items.push({ icon: Group, label: 'Group', onClick: () => run(() => handleGroup('#FCCAE2')) });
          if (isZone) {
            items.push('colorrow');
            items.push({ icon: LayoutGrid, label: 'Tidy up', onClick: () => run(() => handleTidyZone(single!.id)) });
            items.push({ icon: Ungroup, label: 'Ungroup', onClick: () => run(() => handleUngroup(single!.id)) });
          }
          else if (multi && hasZone) items.push({ icon: Ungroup, label: 'Ungroup', onClick: () => run(() => handleUngroup(sel.find(c => c.type === CardType.ZONE)!.id)) });
          if (multi) items.push('alignrow');
          items.push('sep');
          items.push({ icon: Copy, label: 'Copy', onClick: () => run(() => { copyCurrentSelection(); }) });
          items.push({ icon: Copy, label: 'Duplicate', onClick: () => run(handleDuplicateSelection) });
          if (canPaste) items.push({ icon: ClipboardPaste, label: 'Paste', onClick: () => run(() => insertClipboard(getInternalClipboard(), menuWorld)) });
          if (single?.type === CardType.LINK) {
            items.push({ icon: ExternalLink, label: 'Open link', onClick: () => run(() => { const u = (single.content as any)?.url; if (u) window.open(u, '_blank'); }) });
          }
          if (single && expandableTypes.includes(single.type)) {
            items.push(single.alwaysExpanded
              ? { icon: Shrink, label: 'Allow collapse', onClick: () => run(() => handleToggleAlwaysExpanded(single.id)) }
              : { icon: Expand, label: 'Keep expanded', onClick: () => run(() => handleToggleAlwaysExpanded(single.id)) });
          }
          items.push('sep');
          items.push({ icon: Lock, label: 'Lock', onClick: () => run(handleLockToggle) });
          items.push({ icon: ArrowUpToLine, label: 'Bring to front', onClick: () => run(handleBringSelectionToFront) });
          items.push({ icon: ArrowDownToLine, label: 'Send to back', onClick: () => run(handleSendToBack) });
          items.push('sep');
          items.push({ icon: Trash2, label: 'Delete', onClick: () => run(handleDeleteSelection), danger: true });
        }

        return (
          <>
            <div className="fixed inset-0 z-[200]" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
            <div
              className="fixed z-[201] min-w-[180px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-100 py-1.5 animate-in fade-in zoom-in-95 duration-150"
              style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 320) }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {items.map((it, i) => {
                if (it === 'sep') return <div key={i} className="h-px bg-gray-100 my-1" />;
                if (it === 'toolsrow') return (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1.5">
                    {quickTools.map(t => {
                      const v = TOOL_VISUALS[t]!;
                      return (
                        <button
                          key={t}
                          onClick={() => addCardAtPoint(t)}
                          title={v.label}
                          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform"
                          style={{ backgroundColor: v.bg, color: v.fg }}
                        >
                          <v.Icon size={17} />
                        </button>
                      );
                    })}
                  </div>
                );
                if (it === 'colorrow') return (
                  <div key={i} className="flex items-center justify-between gap-1 px-3 py-2">
                    {GROUP_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => { if (single) updateCardContent(single.id, { ...single.content, color: c }); close(); }}
                        className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${(single?.content as ZoneCardContent)?.color === c ? 'ring-2 ring-offset-1 ring-gray-400 border-white' : 'border-black/10'}`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                );
                if (it === 'alignrow') return (
                  <div key={i} className="flex items-center justify-between gap-0.5 px-2 py-1.5">
                    {([
                      { k: 'left', Icon: AlignStartVertical, t: 'Align left' },
                      { k: 'center', Icon: AlignCenterVertical, t: 'Align center' },
                      { k: 'right', Icon: AlignEndVertical, t: 'Align right' },
                      { k: 'top', Icon: AlignStartHorizontal, t: 'Align top' },
                      { k: 'middle', Icon: AlignCenterHorizontal, t: 'Align middle' },
                      { k: 'bottom', Icon: AlignEndHorizontal, t: 'Align bottom' },
                    ] as const).map(({ k, Icon, t }) => (
                      <button
                        key={k}
                        onClick={() => { handleAlign(k); close(); }}
                        title={t}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        <Icon size={15} />
                      </button>
                    ))}
                  </div>
                );
                return (
                  <button
                    key={i}
                    onClick={it.onClick}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium text-left transition-colors ${it.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <it.icon size={15} className={it.danger ? 'text-red-500' : 'text-gray-400'} />
                    {it.label}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
};
