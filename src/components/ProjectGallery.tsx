import React, { useState, useEffect } from 'react';
import { PixelArtProject } from '../types';
import { PRESET_TEMPLATES, decodeRLE, encodeRLE } from '../utils';
import { Save, Sparkles, FolderOpen, Trash2, CheckCircle2 } from 'lucide-react';

interface ProjectGalleryProps {
  currentGrid: string[];
  currentWidth: number;
  currentHeight: number;
  currentPalette: string[];
  currentProjectName: string;
  onLoadProject: (project: {
    width: number;
    height: number;
    palette: string[];
    grid: string[];
    name: string;
  }) => void;
  onSaveNameChange: (name: string) => void;
}

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({
  currentGrid,
  currentWidth,
  currentHeight,
  currentPalette,
  currentProjectName,
  onLoadProject,
  onSaveNameChange,
}) => {
  const [localProjects, setLocalProjects] = useState<PixelArtProject[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load saved projects from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pixel_factory_saved_projects');
    if (saved) {
      try {
        setLocalProjects(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse local projects:', err);
      }
    }
  }, []);

  // Save current project to LocalStorage
  const handleSaveProject = () => {
    const name = currentProjectName.trim() || '我的未命名像素画';
    const rleString = encodeRLE(currentGrid, currentPalette);

    const newProject: PixelArtProject = {
      id: Math.random().toString(36).substring(2, 9),
      name: name,
      width: currentWidth,
      height: currentHeight,
      palette: [...currentPalette],
      rle: rleString,
      createdAt: new Date().toLocaleDateString(),
      category: '我的作品',
    };

    const updated = [newProject, ...localProjects];
    setLocalProjects(updated);
    localStorage.setItem('pixel_factory_saved_projects', JSON.stringify(updated));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = localProjects.filter((p) => p.id !== id);
    setLocalProjects(updated);
    localStorage.setItem('pixel_factory_saved_projects', JSON.stringify(updated));
  };

  const handleLoadPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    const decoded = decodeRLE(preset.rle, preset.width, preset.height, preset.palette);
    onLoadProject({
      width: preset.width,
      height: preset.height,
      palette: [...preset.palette],
      grid: decoded,
      name: preset.name,
    });
  };

  const handleLoadSaved = (proj: PixelArtProject) => {
    const decoded = decodeRLE(proj.rle, proj.width, proj.height, proj.palette);
    onLoadProject({
      width: proj.width,
      height: proj.height,
      palette: [...proj.palette],
      grid: decoded,
      name: proj.name,
    });
  };

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-5">
      
      {/* Save Project Control Deck */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
          保存当前画作
        </h3>
        <div className="flex flex-col gap-2.5">
          <input
            id="gallery-project-name-input"
            type="text"
            value={currentProjectName}
            onChange={(e) => onSaveNameChange(e.target.value)}
            placeholder="为您的像素杰作命名..."
            className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          <button
            id="save-current-project-btn"
            onClick={handleSaveProject}
            className={`w-full font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 animate-bounce" />
                <span>已成功保存至下方作品库！</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>保存至本地作品库</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preset Library (Built-in) */}
      <div>
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">复古经典预设库</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_TEMPLATES.map((preset) => {
            const decoded = decodeRLE(preset.rle, preset.width, preset.height, preset.palette);
            return (
              <button
                id={`preset-item-${preset.name}`}
                key={preset.name}
                onClick={() => handleLoadPreset(preset)}
                className="bg-slate-50 border border-slate-200 hover:border-slate-350 p-2 rounded-xl flex items-center gap-2 text-left transition-all group cursor-pointer"
              >
                {/* Micro pixel preview thumbnail */}
                <div 
                  className="grid rounded border border-slate-200 bg-white p-0.5 overflow-hidden flex-shrink-0" 
                  style={{ 
                    gridTemplateColumns: `repeat(${preset.width}, 1fr)`, 
                    width: '36px', 
                    height: '36px',
                    gap: '0px'
                  }}
                >
                  {decoded.map((color, idx) => (
                    <div 
                      key={idx} 
                      className="w-full h-full"
                      style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }} 
                    />
                  ))}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-blue-600">{preset.name}</span>
                  <span className="text-[9px] text-slate-400 font-mono">{preset.category} | {preset.width}x{preset.height}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Library (Local Storage) */}
      <div className="border-t border-slate-100 pt-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">我的作品存档</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{localProjects.length} 个作品</span>
        </div>

        {localProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex-1">
            <p className="text-xs text-slate-500">暂时没有本地存档</p>
            <p className="text-[10px] text-slate-400 mt-1">在上方输入名称并点击保存，即可开始记录您的灵感！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {localProjects.map((proj) => {
              const decoded = decodeRLE(proj.rle, proj.width, proj.height, proj.palette);
              return (
                <div
                  id={`saved-item-${proj.id}`}
                  key={proj.id}
                  onClick={() => handleLoadSaved(proj)}
                  className="bg-slate-50 border border-slate-200 hover:border-slate-350 p-2 rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {/* Micro pixel preview thumbnail */}
                    <div 
                      className="grid rounded border border-slate-200 bg-white p-0.5 overflow-hidden flex-shrink-0" 
                      style={{ 
                        gridTemplateColumns: `repeat(${proj.width}, 1fr)`, 
                        width: '36px', 
                        height: '36px',
                        gap: '0px'
                      }}
                    >
                      {decoded.map((color, idx) => (
                        <div 
                          key={idx} 
                          className="w-full h-full"
                          style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }} 
                        />
                      ))}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-blue-600">{proj.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{proj.createdAt} | {proj.width}x{proj.height}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteProject(proj.id, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-all cursor-pointer"
                    title="删除作品"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
