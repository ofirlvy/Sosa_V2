import React, { useMemo } from 'react';
import { CardData, CardType, Workspace, StickyCardContent, ZoneCardContent, TextCardContent, DocCardContent } from '../types';
import { pickWorkspace, thumbCards, computeThumbFrame, cardAssets, assetUrl, pickImageBudget } from '../services/boardThumbnail';

// A real miniature of a board — the Figma-style "zoom to fit" preview, so a user
// with many boards recognises one by its CONTENT, not just its name.
//
// Everything is drawn in WORLD coordinates inside an SVG viewBox, so it scales to
// any thumbnail size with no measuring. Pure read from persisted data: no writes.
// Empty boards never reach this component (PageView keeps its own empty state).

// Text is drawn as bars, not glyphs: at this scale (a board ~2000px wide shown in
// ~250px) real type is sub-pixel noise. Bars read as "there is writing here",
// which is exactly what Figma's smudged thumbnail text conveys.
const INK = 'rgba(15,23,42,0.16)';
const INK_STRONG = 'rgba(15,23,42,0.32)';
const CARD_STROKE = 'rgba(15,23,42,0.10)';

const stripHtml = (s?: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Fallback tint for card types without a bespoke skeleton. */
const typeFill = (c: CardData): { fill: string; stroke?: string } => {
  switch (c.type) {
    case CardType.GRID_PLANNER: return { fill: '#ffffff', stroke: 'rgba(255,215,83,0.55)' };
    case CardType.LINK: return { fill: '#ffffff', stroke: CARD_STROKE };
    default: return { fill: '#ffffff', stroke: CARD_STROKE };
  }
};

interface DrawCtx {
  /** viewBox width — used to keep strokes/rounding proportional at any zoom. */
  vw: number;
  /** May this card paint real images? (budgeted, see services/boardThumbnail) */
  canImage: boolean;
}

/** A rounded bar standing in for a line of text. */
const Bar: React.FC<{ x: number; y: number; w: number; h: number; strong?: boolean }> = ({ x, y, w, h, strong }) => (
  <rect x={x} y={y} width={Math.max(w, 0)} height={h} rx={h / 2} fill={strong ? INK_STRONG : INK} />
);

/** An image clipped to a rounded rect, filling its box like object-cover. */
const Thumb: React.FC<{ id: string; x: number; y: number; w: number; h: number; href?: string; r: number }> = ({ id, x, y, w, h, href, r }) => (
  <g>
    <clipPath id={id}>
      <rect x={x} y={y} width={w} height={h} rx={r} />
    </clipPath>
    <rect x={x} y={y} width={w} height={h} rx={r} fill="rgba(15,23,42,0.06)" />
    {href && (
      <image
        href={href}
        x={x} y={y} width={w} height={h}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${id})`}
      />
    )}
  </g>
);

/**
 * One card as a small structural drawing: the same anatomy the real card has
 * (header row, media grid, caption), which is what makes the miniature legible.
 */
const CardMini: React.FC<{ card: CardData; ctx: DrawCtx }> = ({ card, ctx }) => {
  const { x, y, width: w, height: h } = card;
  const r = Math.min(w, h) * 0.07;
  const content: any = card.content || {};
  // Only detail cards that are actually big enough on screen to read.
  const detailed = w / ctx.vw > 0.04;
  const pad = w * 0.06;
  const assets = cardAssets(card);
  const uid = `t${card.id}`.replace(/[^a-zA-Z0-9_-]/g, '');

  switch (card.type) {
    case CardType.ZONE: {
      const c = content as ZoneCardContent;
      const col = c?.color || '#8E8E93';
      const titleW = Math.min(w * 0.5, Math.max(w * 0.16, (c?.title || '').length * h * 0.018));
      const pillH = Math.min(h * 0.07, w * 0.05);
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={`${col}3D`} stroke={col} strokeOpacity={0.85}
                strokeWidth={ctx.vw * 0.004} strokeDasharray={`${ctx.vw * 0.012} ${ctx.vw * 0.008}`} />
          {c?.title && (
            <rect x={x + pad * 0.4} y={y - pillH * 0.75} width={titleW} height={pillH * 1.5} rx={pillH * 0.75} fill={col} />
          )}
        </g>
      );
    }

    case CardType.IMAGE:
      // The media IS the card — exactly how it looks on the board.
      return <Thumb id={uid} x={x} y={y} w={w} h={h} r={r} href={ctx.canImage ? assetUrl(assets[0]) : undefined} />;

    case CardType.STICKY: {
      const c = content as StickyCardContent;
      const text = stripHtml(c?.html) || c?.text || '';
      const lineH = h * 0.075;
      const lines = Math.min(4, Math.max(1, Math.round(text.length / 22)));
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={c?.color || '#FFF475'} stroke="rgba(0,0,0,0.05)" strokeWidth={ctx.vw * 0.0012} />
          {detailed && Array.from({ length: lines }).map((_, i) => (
            <Bar key={i} x={x + pad} y={y + pad + i * lineH * 1.9} w={(w - pad * 2) * (i === lines - 1 ? 0.55 : 1)} h={lineH} />
          ))}
        </g>
      );
    }

    case CardType.TEXT: {
      const c = content as TextCardContent;
      const text = stripHtml(c?.html) || c?.text || '';
      const lineH = h * 0.16;
      const lines = Math.min(3, Math.max(1, Math.round(text.length / 26)));
      return (
        <g>
          {c?.highlightColor && <rect x={x} y={y} width={w} height={h} rx={r} fill={c.highlightColor} />}
          {Array.from({ length: lines }).map((_, i) => (
            <Bar key={i} x={x} y={y + i * lineH * 1.6} w={w * (i === lines - 1 ? 0.6 : 1)} h={lineH} strong />
          ))}
        </g>
      );
    }

    case CardType.REELS:
    case CardType.STORY: {
      // Portrait media filling the body, under a small header row.
      const headH = h * 0.14;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill="#ffffff" stroke={CARD_STROKE} strokeWidth={ctx.vw * 0.0012} />
          {detailed && <Bar x={x + pad} y={y + headH * 0.35} w={w * 0.42} h={headH * 0.38} strong />}
          <Thumb id={uid} x={x + pad} y={y + headH} w={w - pad * 2} h={h - headH - pad} r={r * 0.7}
                 href={ctx.canImage ? assetUrl(assets[0]) : undefined} />
        </g>
      );
    }

    case CardType.POST: {
      // Mirrors the real collapsed PostCard: header row, a grid of square assets,
      // then caption lines. The real card uses 4 columns, but at thumbnail scale
      // those cells shrink to specks — 3 keeps the photos recognisable, which is
      // the whole point of the preview.
      const headH = h * 0.16;
      const gap = w * 0.03;
      const cols = 3;
      const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
      const shown = assets.slice(0, cols);
      const gridBottom = y + headH + (shown.length ? cellW + gap : 0);
      const capLineH = h * 0.055;
      const caption = (content.caption || '') as string;
      const capLines = caption ? Math.min(3, Math.max(1, Math.round(caption.length / 30))) : 0;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill="#ffffff" stroke={CARD_STROKE} strokeWidth={ctx.vw * 0.0012} />
          {detailed && (
            <>
              <rect x={x + pad} y={y + headH * 0.3} width={headH * 0.4} height={headH * 0.4} rx={headH * 0.1} fill={INK} />
              <Bar x={x + pad + headH * 0.6} y={y + headH * 0.32} w={w * 0.34} h={headH * 0.36} strong />
            </>
          )}
          {shown.map((a, i) => (
            <Thumb key={a.id || i} id={`${uid}i${i}`} x={x + pad + i * (cellW + gap)} y={y + headH}
                   w={cellW} h={cellW} r={cellW * 0.14} href={ctx.canImage ? assetUrl(a) : undefined} />
          ))}
          {detailed && Array.from({ length: capLines }).map((_, i) => (
            <Bar key={`c${i}`} x={x + pad} y={gridBottom + gap + i * capLineH * 1.8} w={(w - pad * 2) * (i === capLines - 1 ? 0.5 : 1)} h={capLineH} />
          ))}
        </g>
      );
    }

    case CardType.GRID_PLANNER: {
      // A 3-column planner grid — its signature look.
      const headH = h * 0.14;
      const gap = w * 0.03;
      const cellW = (w - pad * 2 - gap * 2) / 3;
      const rows = Math.max(1, Math.floor((h - headH - pad) / (cellW + gap)));
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill="#ffffff" stroke="rgba(255,215,83,0.6)" strokeWidth={ctx.vw * 0.0014} />
          {detailed && <Bar x={x + pad} y={y + headH * 0.35} w={w * 0.4} h={headH * 0.34} strong />}
          {Array.from({ length: rows * 3 }).map((_, i) => (
            <rect key={i}
                  x={x + pad + (i % 3) * (cellW + gap)}
                  y={y + headH + Math.floor(i / 3) * (cellW + gap)}
                  width={cellW} height={cellW} rx={cellW * 0.12}
                  fill="rgba(15,23,42,0.05)" />
          ))}
        </g>
      );
    }

    case CardType.DOC: {
      const c = content as DocCardContent;
      const body = stripHtml(c?.body);
      const lineH = h * 0.045;
      const lines = Math.min(8, Math.max(2, Math.round(body.length / 40)));
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill="#ffffff" stroke={CARD_STROKE} strokeWidth={ctx.vw * 0.0012} />
          {detailed && (
            <>
              <Bar x={x + pad} y={y + pad} w={w * 0.5} h={lineH * 1.7} strong />
              {Array.from({ length: lines }).map((_, i) => (
                <Bar key={i} x={x + pad} y={y + pad + lineH * 3.4 + i * lineH * 1.9} w={(w - pad * 2) * (i === lines - 1 ? 0.45 : 1)} h={lineH} />
              ))}
            </>
          )}
        </g>
      );
    }

    case CardType.LINK: {
      const headH = h * 0.14;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill="#ffffff" stroke={CARD_STROKE} strokeWidth={ctx.vw * 0.0012} />
          <Thumb id={uid} x={x} y={y + headH} w={w} h={h - headH} r={0} href={ctx.canImage ? assetUrl(assets[0]) : undefined} />
          {detailed && <Bar x={x + pad} y={y + headH * 0.35} w={w * 0.45} h={headH * 0.36} strong />}
        </g>
      );
    }

    default: {
      const f = typeFill(card);
      const lineH = h * 0.09;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={f.fill} stroke={f.stroke} strokeWidth={ctx.vw * 0.0012} />
          {detailed && (
            <>
              <Bar x={x + pad} y={y + pad} w={w * 0.45} h={lineH} strong />
              <Bar x={x + pad} y={y + pad + lineH * 2} w={w - pad * 2} h={lineH * 0.8} />
            </>
          )}
        </g>
      );
    }
  }
};

export const BoardThumbnail: React.FC<{ workspaces?: Workspace[] }> = ({ workspaces }) => {
  const model = useMemo(() => {
    const cards = thumbCards(pickWorkspace(workspaces));
    const frame = computeThumbFrame(cards);
    if (!frame) return null;
    // Zones are backgrounds — draw them first, then everything else by z-order.
    const zones = cards.filter(c => c.type === CardType.ZONE);
    const rest = cards
      .filter(c => c.type !== CardType.ZONE)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .slice(-60); // hard cap: a huge board still renders fast
    return { frame, ordered: [...zones, ...rest], budget: pickImageBudget(cards) };
  }, [workspaces]);

  if (!model) return null;
  const { frame, ordered, budget } = model;

  return (
    <svg
      viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* No canvas fill: the thumbnail is the same floating WHITE card as the
          empty-board state, with only the content differing. */}
      {ordered.map(c => (
        <CardMini key={c.id} card={c} ctx={{ vw: frame.w, canImage: budget.has(c.id) }} />
      ))}
    </svg>
  );
};
