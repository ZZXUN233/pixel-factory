import React, { useState, useEffect } from 'react';
import { GridCanvas } from './components/GridCanvas';
import { PaletteSection } from './components/PaletteSection';
import { AIGenerator } from './components/AIGenerator';
import { ImportExport } from './components/ImportExport';
import { ProjectGallery } from './components/ProjectGallery';
import { ImagePixelator } from './components/ImagePixelator';
import { AnimationStudio } from './components/AnimationStudio';
import { ToolType } from './types';
import { PRESET_TEMPLATES, decodeRLE } from './utils';
import { 
  Sparkles, 
  Palette, 
  Terminal, 
  Layers, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  PaintBucket, 
  Info, 
  MonitorPlay,
  Image as ImageIcon,
  Film
} from 'lucide-react';

export default function App() {
  // 1. Core Editor State
  const [width, setWidth] = useState(16);
  const [height, setHeight] = useState(16);
  const [grid, setGrid] = useState<string[]>(() => Array(16 * 16).fill('transparent'));
  const [palette, setPalette] = useState<string[]>([
    'transparent', '#1e293b', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#facc15', '#a855f7'
  ]);
  const [selectedColor, setSelectedColor] = useState('#ef4444');
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [showGridLines, setShowGridLines] = useState(true);
  const [symmetryMode, setSymmetryMode] = useState<'none' | 'horizontal' | 'vertical' | 'both'>('none');
  const [projectName, setProjectName] = useState('新像素杰作');

  // 1.5 Animation Studio States
  const [frames, setFrames] = useState<string[][]>(() => [Array(16 * 16).fill('transparent')]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [enableOnionSkin, setEnableOnionSkin] = useState(true);

  // 2. Tab selection
  const [activeTab, setActiveTab] = useState<'ai' | 'image' | 'animation' | 'editor' | 'code' | 'gallery'>('ai');

  // 3. Undo/Redo State History Stack
  const [history, setHistory] = useState<string[][]>(() => [Array(16 * 16).fill('transparent')]);
  const [historyPointer, setHistoryPointer] = useState(0);

  // Sync canvas grid size changes
  const handleSizeChange = (newWidth: number, newHeight: number) => {
    setWidth(newWidth);
    setHeight(newHeight);
    const newGrid = Array(newWidth * newHeight).fill('transparent');
    setGrid(newGrid);
    setFrames([newGrid]);
    setCurrentFrameIndex(0);
    setHistory([newGrid]);
    setHistoryPointer(0);
  };

  // Push new state onto undo/redo history stack
  const pushToHistory = (newGrid: string[]) => {
    const nextHistory = history.slice(0, historyPointer + 1);
    nextHistory.push([...newGrid]);
    setHistory(nextHistory);
    setHistoryPointer(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyPointer > 0) {
      const prevPointer = historyPointer - 1;
      setHistoryPointer(prevPointer);
      setGrid([...history[prevPointer]]);
    }
  };

  const handleRedo = () => {
    if (historyPointer < history.length - 1) {
      const nextPointer = historyPointer + 1;
      setHistoryPointer(nextPointer);
      setGrid([...history[nextPointer]]);
    }
  };

  // 4. Paint Handlers
  const handlePixelChange = (index: number, color: string) => {
    const updated = [...grid];
    updated[index] = color;
    setGrid(updated);
    pushToHistory(updated);
  };

  const handleBulkPixelChange = (changes: { index: number; color: string }[]) => {
    const updated = [...grid];
    changes.forEach(({ index, color }) => {
      if (index >= 0 && index < updated.length) {
        updated[index] = color;
      }
    });
    setGrid(updated);
    pushToHistory(updated);
  };

  // Clear whole grid to transparent
  const handleClearCanvas = () => {
    const cleared = Array(width * height).fill('transparent');
    setGrid(cleared);
    pushToHistory(cleared);
  };

  // Fill canvas with current selected color
  const handleFillCanvas = () => {
    const filled = Array(width * height).fill(selectedColor);
    setGrid(filled);
    pushToHistory(filled);
  };

  // Load imported or preset project
  const handleLoadProject = (project: {
    width: number;
    height: number;
    palette: string[];
    grid: string[];
    name: string;
  }) => {
    setWidth(project.width);
    setHeight(project.height);
    setPalette(project.palette);
    setGrid(project.grid);
    setFrames([project.grid]);
    setCurrentFrameIndex(0);
    setProjectName(project.name);
    
    // Select first non-transparent color
    const firstSolidColor = project.palette.find(c => c !== 'transparent');
    if (firstSolidColor) {
      setSelectedColor(firstSolidColor);
    }

    setHistory([project.grid]);
    setHistoryPointer(0);
  };

  // Sync canvas modifications into the active animation frame
  useEffect(() => {
    setFrames(prev => {
      const next = [...prev];
      if (next[currentFrameIndex] && JSON.stringify(next[currentFrameIndex]) !== JSON.stringify(grid)) {
        next[currentFrameIndex] = [...grid];
        return next;
      }
      return prev;
    });
  }, [grid, currentFrameIndex]);

  // Frame management actions
  const handleSelectFrame = (index: number) => {
    setCurrentFrameIndex(index);
    setGrid([...frames[index]]);
  };

  const handleAddFrame = () => {
    const emptyFrame = Array(width * height).fill('transparent');
    const nextFrames = [...frames];
    nextFrames.splice(currentFrameIndex + 1, 0, emptyFrame);
    setFrames(nextFrames);
    setCurrentFrameIndex(currentFrameIndex + 1);
    setGrid(emptyFrame);
  };

  const handleDuplicateFrame = () => {
    const duplicate = [...grid];
    const nextFrames = [...frames];
    nextFrames.splice(currentFrameIndex + 1, 0, duplicate);
    setFrames(nextFrames);
    setCurrentFrameIndex(currentFrameIndex + 1);
    setGrid(duplicate);
  };

  const handleDeleteFrame = (index: number) => {
    if (frames.length <= 1) return;
    const nextFrames = frames.filter((_, idx) => idx !== index);
    setFrames(nextFrames);
    const nextIdx = Math.max(0, index - 1);
    setCurrentFrameIndex(nextIdx);
    setGrid([...nextFrames[nextIdx]]);
  };

  const handleClearAllFrames = () => {
    const firstFrame = frames[0] || Array(width * height).fill('transparent');
    setFrames([firstFrame]);
    setCurrentFrameIndex(0);
    setGrid([...firstFrame]);
  };

  const handleMoveFrame = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= frames.length) return;
    const nextFrames = [...frames];
    const [moved] = nextFrames.splice(fromIndex, 1);
    nextFrames.splice(toIndex, 0, moved);
    setFrames(nextFrames);
    setCurrentFrameIndex(toIndex);
    setGrid([...nextFrames[toIndex]]);
  };

  const handleAddAIFrame = (newGrids: string[][], newPalette?: string[]) => {
    if (newGrids.length === 0) return;
    const nextFrames = [...frames];
    nextFrames.splice(currentFrameIndex + 1, 0, ...newGrids);
    setFrames(nextFrames);
    const nextIdx = currentFrameIndex + newGrids.length;
    setCurrentFrameIndex(nextIdx);
    setGrid([...newGrids[newGrids.length - 1]]);
    if (newPalette) {
      setPalette(newPalette);
    }
  };

  // Load default preset on first load
  useEffect(() => {
    const mario = PRESET_TEMPLATES[0];
    const decoded = decodeRLE(mario.rle, mario.width, mario.height, mario.palette);
    handleLoadProject({
      width: mario.width,
      height: mario.height,
      palette: [...mario.palette],
      grid: decoded,
      name: mario.name,
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-800 flex flex-col font-sans selection:bg-blue-500/10 selection:text-blue-900">

      {/* Main App Bar / Header */}
      <header className="relative border-b border-slate-100 bg-white/90 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
              <div className="bg-white opacity-40"></div><div className="bg-white"></div>
              <div className="bg-white"></div><div className="bg-white opacity-60"></div>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              PIXEL FACTORY <span className="font-normal text-slate-400 ml-1">v1.0.4</span>
            </h1>
            <p className="text-xs text-slate-400">
              基于文本 RLE 矩阵协议的 AI 像素生成与可视化设计工坊
            </p>
          </div>
        </div>

        {/* Project info card */}
        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">当前作品:</span>
          <span className="text-blue-600 font-bold font-mono">{projectName}</span>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        
        {/* Left Column: Editor & Canvas Deck (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm min-h-[600px] items-center justify-center">
          
          {/* Quick Canvas Actions Deck */}
          <div className="flex flex-wrap justify-between items-center w-full gap-2 border-b border-slate-100 pb-4 mb-2">
            
            {/* Undo/Redo Group */}
            <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
              <button
                id="undo-btn"
                onClick={handleUndo}
                disabled={historyPointer === 0}
                className={`p-2 rounded-md transition-all cursor-pointer ${
                  historyPointer === 0
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 shadow-sm'
                }`}
                title="撤销 (Undo)"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                id="redo-btn"
                onClick={handleRedo}
                disabled={historyPointer === history.length - 1}
                className={`p-2 rounded-md transition-all cursor-pointer ${
                  historyPointer === history.length - 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 shadow-sm'
                }`}
                title="重做 (Redo)"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>

            {/* Symmetry & Toggles info tag */}
            {symmetryMode !== 'none' && (
              <div className="bg-blue-50 border border-blue-100 text-blue-600 rounded-lg px-2.5 py-1 text-[11px] font-mono flex items-center gap-1.5">
                <span>● 镜像对称绘制激活</span>
              </div>
            )}

            {/* Clear and Fill Actions */}
            <div className="flex gap-2">
              <button
                id="fill-canvas-btn"
                onClick={handleFillCanvas}
                className="bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="用选中的颜色填充整个画布"
              >
                <PaintBucket className="h-3.5 w-3.5 text-blue-500" />
                <span>全屏填充</span>
              </button>
              <button
                id="clear-canvas-btn"
                onClick={handleClearCanvas}
                className="bg-rose-50 hover:bg-rose-100/80 border border-rose-100 text-rose-600 hover:text-rose-700 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="清空整块画布为透明"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>一键清空</span>
              </button>
            </div>

          </div>

          {/* Core Interactive Canvas Component */}
          <div className="flex-1 flex items-center justify-center py-6 w-full">
            <GridCanvas
              grid={grid}
              width={width}
              height={height}
              selectedColor={selectedColor}
              activeTool={activeTool}
              showGridLines={showGridLines}
              symmetryMode={symmetryMode}
              onPixelChange={handlePixelChange}
              onBulkPixelChange={handleBulkPixelChange}
              onPickColor={(color) => {
                setSelectedColor(color);
                setActiveTool('pen'); // switch tool back to draw automatically
              }}
              onionSkinPrev={enableOnionSkin && currentFrameIndex > 0 ? frames[currentFrameIndex - 1] : undefined}
              onionSkinNext={enableOnionSkin && currentFrameIndex < frames.length - 1 ? frames[currentFrameIndex + 1] : undefined}
            />
          </div>

          {/* Quick Help Tip */}
          <div className="w-full flex items-center gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100 mt-2 text-slate-500 leading-normal">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p className="text-[11px]">
              <strong className="text-slate-700">设计小贴士：</strong>
              支持拖动绘制！您可以切换<strong>画笔/橡皮/油漆桶</strong>在画布上拖拽鼠标，使用<strong>镜像对称</strong>更高效地绘制对称的游戏角色或徽标护盾。
            </p>
          </div>

        </section>

        {/* Right Column: Control tabs (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Bento navigation deck */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 shadow-sm">
            {[
              { id: 'ai', icon: Sparkles, label: 'AI 生成' },
              { id: 'image', icon: ImageIcon, label: '图片像素化' },
              { id: 'animation', icon: Film, label: '精灵动图' },
              { id: 'editor', icon: Palette, label: '色板绘制' },
              { id: 'code', icon: Terminal, label: '导入导出' },
              { id: 'gallery', icon: Layers, label: '作品库' },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  id={`tab-btn-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-col items-center py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 border border-slate-200/40 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                  }`}
                >
                  <IconComp className={`h-4 w-4 mb-1 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive tab outputs */}
          <div className="transition-all duration-300">
            
            {activeTab === 'ai' && (
              <AIGenerator
                currentSize={{ width, height }}
                onSizeChange={handleSizeChange}
                onGenerateSuccess={(res) => {
                  handleLoadProject({
                    width: res.width,
                    height: res.height,
                    palette: res.palette,
                    grid: decodeRLE(res.rle, res.width, res.height, res.palette),
                    name: res.name,
                  });
                }}
              />
            )}

            {activeTab === 'image' && (
              <ImagePixelator
                currentPalette={palette}
                onImport={(imported) => {
                  handleLoadProject({
                    width: imported.width,
                    height: imported.height,
                    palette: imported.palette,
                    grid: imported.grid,
                    name: imported.name,
                  });
                  // Switch tab to editor so user can edit the imported pixel art immediately
                  setActiveTab('editor');
                }}
              />
            )}

            {activeTab === 'animation' && (
              <AnimationStudio
                frames={frames}
                currentFrameIndex={currentFrameIndex}
                width={width}
                height={height}
                palette={palette}
                onSelectFrame={handleSelectFrame}
                onAddFrame={handleAddFrame}
                onDuplicateFrame={handleDuplicateFrame}
                onDeleteFrame={handleDeleteFrame}
                onClearAllFrames={handleClearAllFrames}
                onMoveFrame={handleMoveFrame}
                enableOnionSkin={enableOnionSkin}
                onToggleOnionSkin={() => setEnableOnionSkin(!enableOnionSkin)}
                onAddAIFrame={handleAddAIFrame}
              />
            )}

            {activeTab === 'editor' && (
              <PaletteSection
                palette={palette}
                selectedColor={selectedColor}
                activeTool={activeTool}
                showGridLines={showGridLines}
                symmetryMode={symmetryMode}
                onSelectColor={setSelectedColor}
                onAddColor={(color) => {
                  const updated = [...palette, color];
                  setPalette(updated);
                  setSelectedColor(color);
                }}
                onRemoveColor={(index) => {
                  const updated = palette.filter((_, i) => i !== index);
                  setPalette(updated);
                  // Ensure selected color is safe
                  if (selectedColor === palette[index]) {
                    setSelectedColor(updated[updated.length - 1] || 'transparent');
                  }
                }}
                onSelectTool={setActiveTool}
                onToggleGridLines={() => setShowGridLines(!showGridLines)}
                onSelectSymmetry={setSymmetryMode}
                onUpdatePalette={(newPalette) => {
                  setPalette(newPalette);
                  const firstSolid = newPalette.find(c => c !== 'transparent');
                  if (firstSolid) setSelectedColor(firstSolid);
                }}
              />
            )}

            {activeTab === 'code' && (
              <ImportExport
                grid={grid}
                width={width}
                height={height}
                palette={palette}
                name={projectName}
                onImport={(imported) => {
                  handleLoadProject({
                    width: imported.width,
                    height: imported.height,
                    palette: imported.palette,
                    grid: imported.grid,
                    name: imported.name,
                  });
                }}
              />
            )}

            {activeTab === 'gallery' && (
              <ProjectGallery
                currentGrid={grid}
                currentWidth={width}
                currentHeight={height}
                currentPalette={palette}
                currentProjectName={projectName}
                onSaveNameChange={setProjectName}
                onLoadProject={(loaded) => {
                  handleLoadProject(loaded);
                }}
              />
            )}

          </div>

        </section>

      </main>

      {/* Humble Footer */}
      <footer className="border-t border-slate-100 bg-white py-4 text-center text-[10px] text-slate-400 font-mono z-10">
        PIXEL FACTORY © 2026 | 基于文本 RLE 矩阵传输协议 | 极速无损渲染
      </footer>

    </div>
  );
}
