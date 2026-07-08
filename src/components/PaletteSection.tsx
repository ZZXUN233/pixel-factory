import React from 'react';
import { ToolType } from '../types';
import { Paintbrush, Eraser, PaintBucket, Pipette, Plus, Trash2, Grid3X3, RefreshCw } from 'lucide-react';

interface PaletteSectionProps {
  palette: string[];
  selectedColor: string;
  activeTool: ToolType;
  showGridLines: boolean;
  symmetryMode: 'none' | 'horizontal' | 'vertical' | 'both';
  onSelectColor: (color: string) => void;
  onAddColor: (color: string) => void;
  onRemoveColor: (index: number) => void;
  onSelectTool: (tool: ToolType) => void;
  onToggleGridLines: () => void;
  onSelectSymmetry: (mode: 'none' | 'horizontal' | 'vertical' | 'both') => void;
  onUpdatePalette: (newPalette: string[]) => void;
}

// 4 iconic retro palettes to quickly swap
const PALETTE_PRESETS = [
  {
    name: 'PICO-8 经典',
    colors: ['transparent', '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA']
  },
  {
    name: 'NES 复古',
    colors: ['transparent', '#000000', '#ffffff', '#e60012', '#00a0e9', '#fff100', '#009944', '#f5b041', '#a569bd', '#1abc9c']
  },
  {
    name: '赛博霓虹',
    colors: ['transparent', '#030712', '#ffffff', '#06b6d4', '#ec4899', '#a855f7', '#10b981', '#facc15', '#f97316', '#ef4444']
  },
  {
    name: '甜美马卡龙',
    colors: ['transparent', '#2d3748', '#ffffff', '#fbcfe8', '#fecdd3', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe']
  }
];

export const PaletteSection: React.FC<PaletteSectionProps> = ({
  palette,
  selectedColor,
  activeTool,
  showGridLines,
  symmetryMode,
  onSelectColor,
  onAddColor,
  onRemoveColor,
  onSelectTool,
  onToggleGridLines,
  onSelectSymmetry,
  onUpdatePalette,
}) => {
  const [customColor, setCustomColor] = React.useState('#ff0000');

  const handleAddCustomColor = () => {
    // Only add if not already in palette
    if (!palette.includes(customColor)) {
      onAddColor(customColor);
    } else {
      onSelectColor(customColor);
    }
  };

  return (
    <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col gap-5 h-full shadow-sm">
      
      {/* 1. Tool Selection Deck */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">工具箱</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'pen', icon: Paintbrush, label: '画笔' },
            { id: 'eraser', icon: Eraser, label: '橡皮' },
            { id: 'bucket', icon: PaintBucket, label: '油漆桶' },
            { id: 'picker', icon: Pipette, label: '吸色器' },
          ].map((tool) => {
            const IconComponent = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                id={`tool-btn-${tool.id}`}
                key={tool.id}
                onClick={() => onSelectTool(tool.id as ToolType)}
                title={tool.label}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 border-blue-500 text-blue-600 font-bold'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-500'
                }`}
              >
                <IconComponent className="h-5 w-5 mb-1" />
                <span className="text-[10px]">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Advanced Drawing Configuration */}
      <div className="grid grid-cols-2 gap-3 border-t border-b border-slate-100 py-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">辅助网格</label>
          <button
            id="toggle-grid-lines-btn"
            onClick={onToggleGridLines}
            className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              showGridLines
                ? 'bg-slate-100 border-slate-250 text-slate-700 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
            {showGridLines ? '网格: 开启' : '网格: 关闭'}
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">镜像对称</label>
          <select
            id="symmetry-select"
            value={symmetryMode}
            onChange={(e) => onSelectSymmetry(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="none">无对称</option>
            <option value="horizontal">左右镜像 (H)</option>
            <option value="vertical">上下镜像 (V)</option>
            <option value="both">田字对称 (HV)</option>
          </select>
        </div>
      </div>

      {/* 3. Palette Color Swatches */}
      <div className="flex-1 min-h-[140px] flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">当前色板</h3>
          <span className="text-[10px] text-slate-500">{palette.length} 色</span>
        </div>
        
        {/* Swatches Scrollable Area */}
        <div className="grid grid-cols-6 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 max-h-[180px] overflow-y-auto">
          {palette.map((color, index) => {
            const isTransparent = color === 'transparent';
            const isSelected = selectedColor === color;
            return (
              <div key={`${color}-${index}`} className="relative group">
                <button
                  id={`palette-color-${index}`}
                  onClick={() => onSelectColor(color)}
                  className={`w-8 h-8 rounded-md border-2 transition-transform duration-100 relative overflow-hidden cursor-pointer ${
                    isSelected ? 'scale-110 ring-2 ring-blue-500 border-white' : 'border-slate-200 hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: isTransparent ? 'transparent' : color,
                  }}
                  title={isTransparent ? '透明色' : color}
                >
                  {isTransparent && (
                    <div 
                      className="absolute inset-0 opacity-60 pointer-events-none"
                      style={{
                        backgroundImage: `conic-gradient(#cbd5e1 0.25turn, #ffffff 0.25turn 0.5turn, #cbd5e1 0.5turn 0.75turn, #ffffff 0.75turn)`,
                        backgroundSize: '10px 10px'
                      }}
                    />
                  )}
                </button>

                {/* Delete color option (cannot delete index 0, i.e., transparent) */}
                {index > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveColor(index);
                    }}
                    className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-700 cursor-pointer shadow"
                    title="删除此色"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Color Picker & Custom Addition */}
        <div className="mt-3 flex gap-2 items-center">
          <div className="relative w-8 h-8 rounded-md overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
            <input
              id="color-picker-input"
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
            <div 
              className="w-full h-full border-2 border-slate-100"
              style={{ backgroundColor: customColor }}
            />
          </div>
          <input
            id="color-hex-input"
            type="text"
            value={customColor.toUpperCase()}
            onChange={(e) => setCustomColor(e.target.value)}
            placeholder="#HEX"
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 text-xs rounded-lg font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            id="add-custom-color-btn"
            onClick={handleAddCustomColor}
            className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors cursor-pointer"
            title="添加至色板"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 4. Color Presets Panel */}
      <div className="border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
          <RefreshCw className="h-3 w-3 text-blue-500" />
          快捷色板预设
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {PALETTE_PRESETS.map((preset) => (
            <button
              id={`preset-palette-btn-${preset.name}`}
              key={preset.name}
              onClick={() => onUpdatePalette(preset.colors)}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-600 py-1.5 px-2 rounded-lg text-left text-[11px] font-medium transition-all flex flex-col gap-1 cursor-pointer"
            >
              <span>{preset.name}</span>
              <div className="flex gap-0.5 h-1.5 w-full rounded overflow-hidden">
                {preset.colors.slice(1, 7).map((c, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
