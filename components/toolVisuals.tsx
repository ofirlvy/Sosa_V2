import React from 'react';
import { CardType } from '../types';
import {
  Image as ImageIcon, LayoutGrid, CirclePlay, Video, FileText, Mail, Sparkles,
  BarChart2, CalendarRange, Beaker, ImagePlay, ClipboardList, Users, Package, Link as LinkIcon, Film,
} from 'lucide-react';

// Single source of truth for an addable card tool's icon + brand color combo
// (bg + icon foreground), mirroring App.tsx `toolsData`. Used by the canvas
// right-click quick-tools row; the drawer can adopt this later.
const P = { PEACH: '#F9E6D1', YELLOW: '#FFD753', GREEN: '#3A5C34', PINK: '#FCCAE2', BURGUNDY: '#5F2427' };

export interface ToolVisual { label: string; Icon: React.FC<any>; bg: string; fg: string; }

export const TOOL_VISUALS: Partial<Record<CardType, ToolVisual>> = {
  [CardType.POST]:          { label: 'Post Card',   Icon: ImageIcon,     bg: P.GREEN,    fg: P.YELLOW },
  [CardType.DOC]:           { label: 'Document',     Icon: FileText,      bg: P.PEACH,    fg: P.BURGUNDY },
  [CardType.GRID_PLANNER]:  { label: 'Feed Planner', Icon: LayoutGrid,    bg: P.PEACH,    fg: P.BURGUNDY },
  [CardType.STORY]:         { label: 'Story Beat',   Icon: CirclePlay,    bg: P.BURGUNDY, fg: P.PEACH },
  [CardType.REELS]:         { label: 'Reel / TikTok',Icon: Video,         bg: P.PINK,     fg: P.BURGUNDY },
  [CardType.NEWSLETTER]:    { label: 'Newsletter',   Icon: Mail,          bg: P.BURGUNDY, fg: P.PINK },
  [CardType.STRATEGY_AI]:   { label: 'Oracle AI',    Icon: Sparkles,      bg: P.PINK,     fg: P.BURGUNDY },
  [CardType.ANALYTICS]:     { label: 'Analytics',    Icon: BarChart2,     bg: P.GREEN,    fg: P.PEACH },
  [CardType.GANTT]:         { label: 'Timeline',     Icon: CalendarRange, bg: P.YELLOW,   fg: P.BURGUNDY },
  [CardType.ADS_TEST]:      { label: 'The Lab',      Icon: Beaker,        bg: P.BURGUNDY, fg: P.YELLOW },
  [CardType.REFERENCE]:     { label: 'Reference',    Icon: ImagePlay,     bg: P.PEACH,    fg: P.GREEN },
  [CardType.CALL_SHEET]:    { label: 'Call Sheet',   Icon: ClipboardList, bg: P.GREEN,    fg: P.PINK },
  [CardType.CASTING_BOARD]: { label: 'Casting',      Icon: Users,         bg: P.YELLOW,   fg: P.GREEN },
  [CardType.PROP_TABLE]:    { label: 'Props',        Icon: Package,       bg: P.BURGUNDY, fg: P.PEACH },
  [CardType.PINTEREST]:     { label: 'Pinterest',    Icon: LinkIcon,      bg: P.PINK,     fg: P.BURGUNDY },
  [CardType.FILMSTRIP]:     { label: 'Storyboard',   Icon: Film,          bg: P.PEACH,    fg: P.GREEN },
};

// Default-size map for quick-adding a card at a point (mirrors toolsData props).
export const TOOL_DEFAULT_SIZE: Partial<Record<CardType, { w: number; h: number }>> = {
  [CardType.STORY]: { w: 456, h: 476 },
  [CardType.REELS]: { w: 440, h: 480 },
  [CardType.DOC]:   { w: 680, h: 800 },
};

// Seed for a brand-new user's "recent tools" row.
export const DEFAULT_RECENT_TOOLS: CardType[] = [CardType.POST, CardType.DOC, CardType.REELS, CardType.GRID_PLANNER];
