import React, { useRef, useEffect } from 'react';
import { ToolType } from '../types';

interface GridCanvasProps {
  grid: string[];
  width: number;
  height: number;
  selectedColor: string;
  activeTool: ToolType;
  showGridLines: boolean;
  symmetryMode: 'none' | 'horizontal' | 'vertical' | 'both';
  onPixelChange: (index: number, color: string) => void;
  onBulkPixelChange: (changes: { index: number; color: string }[]) => void;
  onPickColor: (color: string) => void;
  onionSkinPrev?: string[];
  onionSkinNext?: string[];
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  grid,
  width,
  height,
  selectedColor,
  activeTool,
  showGridLines,
  symmetryMode,
  onPixelChange,
  onBulkPixelChange,
  onPickColor,
  onionSkinPrev,
  onionSkinNext,
}) => {
  const isDrawingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stop drawing when mouse is released anywhere on screen
  useEffect(() => {
    const handleMouseUp = () => {
      isDrawingRef.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Get symmetric indices for mirror drawing
  const getSymmetricIndices = (x: number, y: number): number[] => {
    const indices: number[] = [];
    const currentIdx = y * width + x;
    indices.push(currentIdx);

    const midX = (width - 1) / 2;
    const midY = (height - 1) / 2;

    const symX = width - 1 - x;
    const symY = height - 1 - y;

    if (symmetryMode === 'horizontal' || symmetryMode === 'both') {
      const hIdx = y * width + symX;
      if (!indices.includes(hIdx)) indices.push(hIdx);
    }
    if (symmetryMode === 'vertical' || symmetryMode === 'both') {
      const vIdx = symY * width + x;
      if (!indices.includes(vIdx)) indices.push(vIdx);
    }
    if (symmetryMode === 'both') {
      const dIdx = symY * width + symX;
      if (!indices.includes(dIdx)) indices.push(dIdx);
    }

    return indices;
  };

  // Flood fill (bucket tool) implementation
  const floodFill = (startX: number, startY: number, targetColor: string, replacementColor: string) => {
    if (targetColor === replacementColor) return;
    
    const queue: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();
    const changes: { index: number; color: string }[] = [];

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      const key = `${cx},${cy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const idx = cy * width + cx;
      if (grid[idx] === targetColor) {
        changes.push({ index: idx, color: replacementColor });

        // Add neighbors
        if (cx > 0) queue.push([cx - 1, cy]);
        if (cx < width - 1) queue.push([cx + 1, cy]);
        if (cy > 0) queue.push([cx, cy - 1]);
        if (cy < height - 1) queue.push([cx, cy + 1]);
      }
    }

    if (changes.length > 0) {
      onBulkPixelChange(changes);
    }
  };

  // Core cell interaction logic
  const handleCellAction = (x: number, y: number) => {
    const idx = y * width + x;
    const targetColor = grid[idx];

    if (activeTool === 'picker') {
      if (targetColor !== 'transparent') {
        onPickColor(targetColor);
      }
      return;
    }

    if (activeTool === 'bucket') {
      const replacementColor = selectedColor;
      floodFill(x, y, targetColor, replacementColor);
      return;
    }

    // Pen or Eraser
    const drawColor = activeTool === 'eraser' ? 'transparent' : selectedColor;
    const drawIndices = getSymmetricIndices(x, y);
    
    const changes = drawIndices.map(index => ({ index, color: drawColor }));
    onBulkPixelChange(changes);
  };

  const handleMouseDown = (x: number, y: number, e: React.MouseEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    handleCellAction(x, y);
  };

  const handleMouseEnter = (x: number, y: number) => {
    if (isDrawingRef.current && (activeTool === 'pen' || activeTool === 'eraser')) {
      handleCellAction(x, y);
    }
  };

  // Determine ideal pixel size for display (max container size of 512px)
  const maxContainerSize = 480;
  const cellSize = Math.floor(maxContainerSize / Math.max(width, height));

  return (
    <div className="flex flex-col items-center">
      {/* Canvas Wrapper with custom transparent checkerboard background */}
      <div 
        ref={containerRef}
        className="relative select-none border-4 border-slate-200/80 rounded-lg shadow-lg overflow-hidden bg-white"
        style={{
          width: `${width * cellSize}px`,
          height: `${height * cellSize}px`,
        }}
      >
        {/* Transparent Checkerboard Grid */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-100"
          style={{
            backgroundImage: `conic-gradient(#f8fafc 0.25turn, #ffffff 0.25turn 0.5turn, #f8fafc 0.5turn 0.75turn, #ffffff 0.75turn)`,
            backgroundSize: `${cellSize * 2}px ${cellSize * 2}px`,
          }}
        />

        {/* Pixel Cells Grid */}
        <div 
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${width}, 1fr)`,
            gridTemplateRows: `repeat(${height}, 1fr)`,
          }}
        >
          {Array.from({ length: height }).map((_, y) => (
            <React.Fragment key={y}>
              {Array.from({ length: width }).map((_, x) => {
                const idx = y * width + x;
                const cellColor = grid[idx];
                const isTransparent = cellColor === 'transparent';

                return (
                  <div
                    id={`pixel-${idx}`}
                    key={x}
                    onMouseDown={(e) => handleMouseDown(x, y, e)}
                    onMouseEnter={() => handleMouseEnter(x, y)}
                    className="cursor-crosshair transition-colors duration-75 relative overflow-hidden"
                    style={{
                      backgroundColor: isTransparent ? 'transparent' : cellColor,
                      borderRight: showGridLines ? '1px solid rgba(148, 163, 184, 0.15)' : 'none',
                      borderBottom: showGridLines ? '1px solid rgba(148, 163, 184, 0.15)' : 'none',
                    }}
                    title={`Pixel (${x}, ${y}) - ${isTransparent ? 'Transparent' : cellColor}`}
                  >
                    {/* Onion skinning overlays */}
                    {isTransparent && onionSkinPrev && onionSkinPrev[idx] && onionSkinPrev[idx] !== 'transparent' && (
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundColor: onionSkinPrev[idx], opacity: 0.35 }}
                        title="上一个帧的葱皮投影"
                      />
                    )}
                    {isTransparent && onionSkinNext && onionSkinNext[idx] && onionSkinNext[idx] !== 'transparent' && (
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundColor: onionSkinNext[idx], opacity: 0.18 }}
                        title="下一个帧的葱皮投影"
                      />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-slate-500 font-mono">
        画布尺寸: {width} × {height} | 像素总数: {width * height}
      </div>
    </div>
  );
};
