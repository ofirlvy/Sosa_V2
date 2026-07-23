import React, { useRef, useState, useLayoutEffect } from 'react';
import { CardData, ZoneCardContent } from '../../types';
import { BaseCard } from './BaseCard';

interface ZoneCardProps {
    card: CardData;
    isSelected: boolean;
    isMultiSelect?: boolean;
    onSelect: (id: string, options?: { toggle?: boolean; keepOthers?: boolean }) => void;
    onMove: (id: string, x: number, y: number) => void;
    onDelete: (id: string) => void;
    onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
    zoomScale: number;
    onUpdateContent: (id: string, content: any) => void;
}

// App brand palette (matches the Group picker in SelectionToolbar).
const ZONE_COLORS = ['#FCCAE2', '#FFD753', '#3A5C34', '#5F2427', '#F9E6D1', '#007AFF', '#8E8E93'];

export const ZoneCard: React.FC<ZoneCardProps> = (props) => {
    const { card, isSelected, isMultiSelect, onUpdateContent } = props;
    const content = card.content as ZoneCardContent;

    // Measure the actual text width so the pill keeps equal left/right padding.
    const sizerRef = useRef<HTMLSpanElement>(null);
    const [pillWidth, setPillWidth] = useState(96);
    const pillText = content.title || 'Untitled Group';
    useLayoutEffect(() => {
        if (sizerRef.current) setPillWidth(sizerRef.current.offsetWidth + 24 + 2); // 24 = px-3 both sides, +2 caret
    }, [pillText]);

    // Counter-scale the name pill against the canvas zoom (Figma-section style):
    // zoomed out, the tag grows back up so board areas stay scannable at a glance.
    const pillScale = Math.min(Math.max(1 / (props.zoomScale || 1), 1), 4);

    // Light brand colors need dark text for contrast; dark ones get white.
    const LIGHT_COLORS = ['#FFD753', '#FCCAE2', '#F9E6D1'];
    const textColor = LIGHT_COLORS.includes(content.color) ? 'text-gray-900' : 'text-white';

    return (
        <BaseCard {...props} variant="minimal">
            <div
                className="absolute inset-0 rounded-2xl border-2 border-dashed transition-colors"
                style={{
                    borderColor: content.color,
                    backgroundColor: `${content.color}26`, // 15% opacity (hex 26 is ~15%)
                }}
            >
                {/* Name Label Pill */}
                <div
                    className="absolute -top-3 left-4 pointer-events-auto"
                    style={{ transform: `scale(${pillScale})`, transformOrigin: 'bottom left' }}
                >
                    {/* Hidden sizer to measure text width for symmetric padding */}
                    <span
                        ref={sizerRef}
                        aria-hidden
                        className="absolute opacity-0 pointer-events-none whitespace-pre text-[12px] font-bold"
                        style={{ left: -9999, top: -9999 }}
                    >
                        {pillText}
                    </span>
                    <input
                        value={content.title ?? ''}
                        dir="auto"
                        onChange={(e) => onUpdateContent(card.id, { ...content, title: e.target.value })}
                        className={`px-3 py-1 text-[12px] font-bold rounded-full border-none focus:ring-2 focus:ring-white/50 outline-none text-center placeholder:text-inherit placeholder:opacity-60 ${textColor}`}
                        style={{ backgroundColor: content.color, width: pillWidth }}
                        placeholder="Untitled Group"
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                </div>
                {/* Recolor moved to the right-click context menu (no always-on picker). */}
            </div>
        </BaseCard>
    );
};
