import React, { useMemo } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, StrokeCardContent, StrokePoint } from '../../types';

interface StrokeCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

// Simple Catmull-Rom spline or basic smoother can be used here.
// For performance and simplicity in MVP, we'll use a basic polyline or quadratic curve approximation.
const getSvgPathFromPoints = (points: StrokePoint[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  // Simple quadratic bezier smoothing
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    
    // Midpoint between p0 and p1 is the control point? No, standard Quad Bezier uses points as controls
    // Better strategy for smooth drawing:
    // Connect midpoints of segments.
    const midX = (points[i].x + points[i+1].x) / 2;
    const midY = (points[i].y + points[i+1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y}, ${midX} ${midY}`;
  }
  
  // Connect last point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  
  return path;
};

export const StrokeCard: React.FC<StrokeCardProps> = (props) => {
  const { card } = props;
  const content = card.content as StrokeCardContent;
  
  const pathData = useMemo(() => getSvgPathFromPoints(content.points), [content.points]);

  // Determine bounding box logic relative to the card's x/y
  // The points are stored relative to the Card's origin (0,0) conceptually?
  // In our Canvas logic, we'll likely store points in "World Space" but normalize them to Card Space if we want valid Bounding Boxes.
  // HOWEVER, for simplicity in an infinite canvas, often strokes are stored with world coordinates, and the "Card x/y" is the top-left of the bounding box.
  // We will assume `content.points` are relative to `card.x` and `card.y`. 
  // i.e. Point (10, 10) inside the card means World (card.x + 10, card.y + 10).
  
  return (
    <BaseCard {...props} variant="minimal">
      <svg 
        width={card.width} 
        height={card.height} 
        className="overflow-visible pointer-events-none" // Allow clicks to pass through transparent areas
        style={{ opacity: content.isHighlighter ? 0.5 : 1 }}
      >
        <path
          d={pathData}
          stroke={content.color}
          strokeWidth={content.width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </BaseCard>
  );
};