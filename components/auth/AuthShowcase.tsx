import React, { useEffect, useRef } from 'react';
import strategyData from './strategy.json';

export const AuthShowcase: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { dimensions, pixelSize, tiles } = strategyData as any;
    
    // Set canvas internal dimensions to match the pixel art exactly
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each tile
    tiles.forEach((tile: any) => {
      ctx.fillStyle = tile.color;
      ctx.fillRect(tile.x, tile.y, pixelSize, pixelSize);
    });
  }, []);

  return (
    <div 
      className="hidden lg:flex h-[100vh] relative overflow-hidden bg-[#F9E6D1] items-center justify-center shrink-0"
      style={{ aspectRatio: '800 / 1064' }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
};
