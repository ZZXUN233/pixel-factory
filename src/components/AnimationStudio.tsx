import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Plus, 
  Copy, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Film, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Info,
  Layers,
  ArrowRightLeft,
  Settings,
  Grid,
  Loader2
} from 'lucide-react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { decodeRLE } from '../utils';

interface AnimationStudioProps {
  frames: string[][];
  currentFrameIndex: number;
  width: number;
  height: number;
  palette: string[];
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: (index: number) => void;
  onClearAllFrames: () => void;
  onMoveFrame: (fromIndex: number, toIndex: number) => void;
  enableOnionSkin: boolean;
  onToggleOnionSkin: () => void;
  onAddAIFrame?: (newGrids: string[][], newPalette?: string[]) => void;
}

export function AnimationStudio({
  frames,
  currentFrameIndex,
  width,
  height,
  palette,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onClearAllFrames,
  onMoveFrame,
  enableOnionSkin,
  onToggleOnionSkin,
  onAddAIFrame
}: AnimationStudioProps) {
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFrame, setPlaybackFrame] = useState(0);
  const [fps, setFps] = useState(8); // 1 to 24 FPS
  const [spritesheetScale, setSpritesheetScale] = useState<number>(10); // for HD download

  // 1. Save Animation as GIF using gifenc
  const downloadGIF = (scale: number = 10) => {
    try {
      const gif = GIFEncoder();
      const format = 'rgb565';

      frames.forEach((frameGrid) => {
        // Create an offscreen canvas to render the frame at high-res scale
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw pixel elements
        frameGrid.forEach((color, idx) => {
          if (!color || color === 'transparent') return;
          const px = idx % width;
          const py = Math.floor(idx / width);

          ctx.fillStyle = color;
          ctx.fillRect(px * scale, py * scale, scale, scale);
        });

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imgData;

        // Use gifenc to quantize color palette & apply palette to get index values
        const framePalette = quantize(data, 256, { format, clearAlpha: true });
        const indexData = applyPalette(data, framePalette, format);

        // Find transparency color index in quantized palette (where alpha channel is 0)
        const transparentIndex = framePalette.findIndex(c => c[3] === 0);

        gif.writeFrame(indexData, canvas.width, canvas.height, {
          palette: framePalette,
          delay: Math.round(1000 / fps),
          transparent: transparentIndex !== -1,
          transparentIndex: transparentIndex !== -1 ? transparentIndex : 0
        });
      });

      gif.finish();
      const buffer = gif.bytesView();

      const blob = new Blob([buffer], { type: 'image/gif' });
      const link = document.createElement('a');
      link.download = `pixel_animation_${width}x${height}_${frames.length}f.gif`;
      link.href = URL.createObjectURL(blob);
      link.click();
    } catch (err) {
      console.error('Error exporting GIF:', err);
      alert('导出 GIF 动画失败: ' + (err as Error).message);
    }
  };

  // 2. AI Sequence Frame Generator States
  const [aiMode, setAiMode] = useState<'single' | 'batch'>('batch');
  const [aiFrameCount, setAiFrameCount] = useState<number>(5);
  const [aiNextPrompt, setAiNextPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingStep, setAiLoadingStep] = useState(0);
  const [aiError, setAiError] = useState('');

  const ANIME_LOADING_STEPS = [
    '正在连线 AI 物理引擎，分析前一帧的形态结构...',
    '计算帧间运动向量，维持形态与颜色比例一致性...',
    '逐个像素偏移描边和阴影线，拟合极简运动轨迹...',
    '正在拼装过渡像素矩阵，压缩 Run-Length 数据...',
    '生成完毕！正在将新帧注入轨道并对齐葱皮视图...'
  ];

  useEffect(() => {
    let interval: any;
    if (aiLoading) {
      setAiLoadingStep(0);
      interval = setInterval(() => {
        setAiLoadingStep((prev) => (prev < ANIME_LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [aiLoading]);

  const handleAIGenerateNextFrame = async () => {
    if (!aiNextPrompt.trim()) {
      setAiError(aiMode === 'single' ? '请输入你想要续写的下一帧变化动作描述。' : '请输入你想让角色完成的一连串动作描述。');
      return;
    }
    if (!onAddAIFrame) {
      alert('系统错误: 未配置帧注入接口。');
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      if (aiMode === 'single') {
        const response = await fetch('/api/generate-next-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grid: frames[currentFrameIndex],
            palette: palette,
            width: width,
            height: height,
            prompt: aiNextPrompt,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `请求失败 (${response.status})`);
        }

        const data = await response.json();
        const decodedGrid = decodeRLE(data.rle, width, height, data.palette);

        onAddAIFrame([decodedGrid], data.palette);
        setAiNextPrompt(''); // clear prompt on success
      } else {
        const response = await fetch('/api/generate-frame-sequence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grid: frames[currentFrameIndex],
            palette: palette,
            width: width,
            height: height,
            prompt: aiNextPrompt,
            count: aiFrameCount,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `请求失败 (${response.status})`);
        }

        const data = await response.json();
        if (!data.frames || !Array.isArray(data.frames)) {
          throw new Error('AI 返回的序列帧格式不正确。');
        }

        const decodedGrids = data.frames.map((f: any) => decodeRLE(f.rle, width, height, data.palette));
        onAddAIFrame(decodedGrids, data.palette);
        setAiNextPrompt(''); // clear prompt on success
      }

    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'AI 续写帧失败，请检查网络连接。');
    } finally {
      setAiLoading(false);
    }
  };

  // HTML Canvas references for generating spritesheets
  const playbackCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync playback frame index with current active frame when not playing
  useEffect(() => {
    if (!isPlaying) {
      setPlaybackFrame(currentFrameIndex);
    }
  }, [currentFrameIndex, isPlaying]);

  // Animation Playback Interval Loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackFrame((prev) => (prev + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [isPlaying, fps, frames.length]);

  // Render the animated preview onto the local playback canvas
  useEffect(() => {
    const canvas = playbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw active preview frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const activeFrameData = frames[playbackFrame] || frames[0] || [];

    const pSize = Math.floor(canvas.width / width);

    // Draw transparent checkerboard background
    const bgSize = pSize * 2;
    for (let bgY = 0; bgY < canvas.height; bgY += bgSize) {
      for (let bgX = 0; bgX < canvas.width; bgX += bgSize) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(bgX, bgY, bgSize / 2, bgSize / 2);
        ctx.fillRect(bgX + bgSize / 2, bgY + bgSize / 2, bgSize / 2, bgSize / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bgX + bgSize / 2, bgY, bgSize / 2, bgSize / 2);
        ctx.fillRect(bgX, bgY + bgSize / 2, bgSize / 2, bgSize / 2);
      }
    }

    // Draw pixel elements
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const color = activeFrameData[idx];
        if (color && color !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect(x * pSize, y * pSize, pSize, pSize);
        }
      }
    }
  }, [playbackFrame, frames, width, height]);

  // Render a tiny miniature canvas helper to draw frame thumbnails
  const renderThumbnailSvg = (frameGrid: string[]) => {
    const cellWidth = 100 / width;
    const cellHeight = 100 / height;
    
    return (
      <svg className="w-full h-full bg-slate-50" viewBox="0 0 100 100">
        {frameGrid.map((color, idx) => {
          if (!color || color === 'transparent') return null;
          const x = (idx % width) * cellWidth;
          const y = Math.floor(idx / width) * cellHeight;
          return (
            <rect 
              key={idx} 
              x={x} 
              y={y} 
              width={cellWidth + 0.1} 
              height={cellHeight + 0.1} 
              fill={color} 
            />
          );
        })}
      </svg>
    );
  };

  // Compile and trigger PNG download for spritesheet (either 1x game ready or high-res display strip)
  const downloadSpritesheet = (isHD: boolean) => {
    const scale = isHD ? spritesheetScale : 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * frames.length * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Loop and draw all frames side-by-side
    frames.forEach((frameGrid, frameIdx) => {
      const startX = frameIdx * width * scale;
      
      frameGrid.forEach((color, idx) => {
        if (!color || color === 'transparent') return;
        const px = idx % width;
        const py = Math.floor(idx / width);
        
        ctx.fillStyle = color;
        ctx.fillRect(startX + px * scale, py * scale, scale, scale);
      });
    });

    // Download action
    const link = document.createElement('a');
    link.download = `spritesheet_${width}x${height}_${frames.length}f_${isHD ? 'HD' : '1x'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Generate Phaser/Unity compatible Spritesheet JSON metadata
  const getJsonMetadata = () => {
    const meta = {
      frames: frames.map((_, index) => ({
        filename: `frame_${index}.png`,
        frame: { x: index * width, y: 0, w: width, h: height },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: width, h: height },
        sourceSize: { w: width, h: height },
        duration: Math.round(1000 / fps)
      })),
      meta: {
        app: "Pixel Factory Game Studio",
        version: "1.0",
        size: { w: width * frames.length, h: height },
        scale: "1"
      }
    };
    return JSON.stringify(meta, null, 2);
  };

  const copyMetadataToClipboard = () => {
    const code = getJsonMetadata();
    navigator.clipboard.writeText(code);
    alert('引擎帧 JSON 描述已复制到剪贴板！');
  };

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-5">
      
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-blue-600 animate-pulse" />
          <h2 className="text-base font-bold text-slate-800">游戏动画 & 精灵图工作室</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="toggle-onion-skin-btn"
            onClick={onToggleOnionSkin}
            className={`py-1 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all ${
              enableOnionSkin
                ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
            title="开启/关闭葱皮功能（在当前画布上以半透明形式投射前后帧，便于对齐与连贯绘制）"
          >
            {enableOnionSkin ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            葱皮投影 (Onion Skin)
          </button>
        </div>
      </div>

      {/* Grid Layout: Playback on Left, Timeline on Right / Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        
        {/* Playback Box (5 cols) */}
        <div className="md:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between gap-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center mb-1">
            <span>实时动画渲染预览</span>
            <span className="font-mono text-[10px] text-blue-600">帧: {playbackFrame + 1} / {frames.length}</span>
          </div>

          {/* Core loop animation stage */}
          <div className="flex items-center justify-center p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-inner">
            <canvas 
              ref={playbackCanvasRef} 
              width={160} 
              height={160}
              className="image-render-pixelated border border-slate-100 rounded"
              style={{ width: '160px', height: '160px' }}
            />
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center bg-white border border-slate-100 p-1.5 rounded-xl shadow-sm">
              <button
                id="anim-play-pause-btn"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    暂停动画
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    播放循环
                  </>
                )}
              </button>
            </div>

            {/* Speed Control Slider */}
            <div className="flex flex-col gap-1 px-1">
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                <span>播放速度 (FPS)</span>
                <span className="text-blue-600">{fps} 帧/秒</span>
              </div>
              <input
                id="anim-fps-slider"
                type="range"
                min="1"
                max="20"
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Action Controls & Presets (7 cols) */}
        <div className="md:col-span-7 flex flex-col justify-between gap-3.5">
          {/* Quick Operations on Active Frame */}
          <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col gap-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1.5">
              帧编排操作面板
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="anim-add-frame-btn"
                onClick={onAddFrame}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4 text-emerald-500" />
                新增空白帧
              </button>
              <button
                id="anim-duplicate-frame-btn"
                onClick={onDuplicateFrame}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Copy className="h-4 w-4 text-blue-500" />
                克隆当前帧
              </button>
            </div>

            <div className="flex gap-2">
              <button
                id="anim-move-left-btn"
                disabled={currentFrameIndex === 0}
                onClick={() => onMoveFrame(currentFrameIndex, currentFrameIndex - 1)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  currentFrameIndex === 0
                    ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                前移当前帧
              </button>
              <button
                id="anim-move-right-btn"
                disabled={currentFrameIndex === frames.length - 1}
                onClick={() => onMoveFrame(currentFrameIndex, currentFrameIndex + 1)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  currentFrameIndex === frames.length - 1
                    ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                }`}
              >
                后移当前帧
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                id="anim-delete-frame-btn"
                disabled={frames.length <= 1}
                onClick={() => onDeleteFrame(currentFrameIndex)}
                className={`py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  frames.length <= 1
                    ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                    : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100/60'
                }`}
                title="删除当前选中的动画帧"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Spritesheet and Meta Assets Exporters */}
          <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex justify-between">
              <span>精灵图与动画资源打包</span>
              <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">支持游戏引擎</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                id="anim-download-spritesheet-game"
                onClick={() => downloadSpritesheet(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm text-center"
                title="导出游戏开发标准的 1x 像素颗粒度精灵图，无损不模糊"
              >
                <Download className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-bold">1x 精灵精灵图</p>
                  <p className="text-[9px] font-normal opacity-85">适合 Unity / Phaser 开发</p>
                </div>
              </button>

              <button
                id="anim-download-spritesheet-hd"
                onClick={() => downloadSpritesheet(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm text-center"
                title="导出高分辨放大的动画帧平铺图，适合直接展示或做网页设计"
              >
                <Download className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-bold">HD 动图帧拼图</p>
                  <p className="text-[9px] font-normal opacity-85">放大 {spritesheetScale}x 分辨率导出</p>
                </div>
              </button>

              <button
                id="anim-download-gif"
                onClick={() => downloadGIF(10)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm text-center"
                title="导出高清晰度的 GIF 动画格式文件"
              >
                <Film className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-bold">保存动画 GIF</p>
                  <p className="text-[9px] font-normal opacity-85">无损导出 GIF 动画文件</p>
                </div>
              </button>
            </div>

            <div className="flex gap-2 items-center">
              <button
                id="anim-copy-json-meta"
                onClick={copyMetadataToClipboard}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                复制帧 JSON 元数据 (坐标)
              </button>
              
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono">HD放大:</span>
                <select
                  id="anim-hd-scale-select"
                  value={spritesheetScale}
                  onChange={(e) => setSpritesheetScale(parseInt(e.target.value))}
                  className="bg-white border border-slate-200 text-slate-700 rounded py-1 px-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                  <option value={20}>20x</option>
                  <option value={32}>32x</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI-powered Sequence Frame Animator */}
          {onAddAIFrame && (
            <div className="bg-blue-50/30 p-3.5 rounded-xl border border-blue-100 flex flex-col gap-2.5">
              <div className="text-xs font-bold text-blue-800 uppercase tracking-widest border-b border-blue-100/50 pb-1.5 flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
                  AI 智能像素动画生成器 (AI Animator)
                </span>
                <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">大模型物理引擎</span>
              </div>

              {/* Selection for Generation Mode */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 text-[11px] font-medium">
                  <button
                    id="ai-mode-btn-batch"
                    onClick={() => {
                      setAiMode('batch');
                      setAiError('');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      aiMode === 'batch'
                        ? 'bg-blue-600 text-white shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    🚀 批量动作生成
                  </button>
                  <button
                    id="ai-mode-btn-single"
                    onClick={() => {
                      setAiMode('single');
                      setAiError('');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      aiMode === 'single'
                        ? 'bg-blue-600 text-white shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    ✏️ 单帧微调
                  </button>
                </div>

                {aiMode === 'batch' && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-mono">帧数:</span>
                    <select
                      id="ai-frame-count-select"
                      value={aiFrameCount}
                      onChange={(e) => setAiFrameCount(parseInt(e.target.value))}
                      className="bg-white border border-slate-200 text-slate-700 rounded py-0.5 px-1.5 focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
                    >
                      <option value={3}>3 帧 (轻量)</option>
                      <option value={5}>5 帧 (推荐)</option>
                      <option value={8}>8 帧 (细腻)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 leading-normal">
                {aiMode === 'batch' ? (
                  <>
                    AI 将以当前第 <span className="font-bold text-blue-600">{(currentFrameIndex + 1)}</span> 帧为起始，在其后自动推演并追加 <span className="font-bold text-blue-600">{aiFrameCount}</span> 帧，一次性拼装出连贯的运动套图！
                  </>
                ) : (
                  <>
                    AI 将观察当前第 <span className="font-bold text-blue-600">{(currentFrameIndex + 1)}</span> 帧的布局与配色，在其后自动微调衍生出 <span className="font-bold text-blue-600">1</span> 个后续运动帧。
                  </>
                )}
              </div>

              {!aiLoading ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      id="ai-next-frame-prompt"
                      type="text"
                      value={aiNextPrompt}
                      onChange={(e) => setAiNextPrompt(e.target.value)}
                      placeholder={aiMode === 'batch' 
                        ? "描述一串连续动作，例如：'蓄力然后跳到半空中'、'火焰熊熊燃起并消散'、'跑步循环'..." 
                        : "描述下一帧的变化，例如：'向右平移一像素'、'火花向上飘散'、'小恐龙眨眼'..."
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-700 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      id="ai-next-frame-submit"
                      onClick={handleAIGenerateNextFrame}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      {aiMode === 'batch' ? `生成动作 (${aiFrameCount}帧)` : '生成下一帧'}
                    </button>
                  </div>
                  {aiError && (
                    <p className="text-[10px] text-rose-500 font-medium">{aiError}</p>
                  )}
                </div>
              ) : (
                <div className="bg-white/80 border border-blue-100/60 p-3.5 rounded-lg flex flex-col items-center justify-center text-center gap-2">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[11px] font-bold text-slate-800 font-mono animate-pulse">{ANIME_LOADING_STEPS[aiLoadingStep]}</p>
                    <p className="text-[9px] text-slate-400">
                      {aiMode === 'batch' 
                        ? `正在利用神经网络连续推演 ${aiFrameCount} 帧微缩像素序列，由于是多帧连续解算可能耗时稍长，请保持耐心...` 
                        : '正在利用神经网络推演单帧像素变动，请稍候...'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Frame Timeline Strip / Scroller */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-blue-500" />
            动画序列帧轨 (Timeline)
          </span>
          <button
            id="anim-clear-all-frames"
            onClick={() => {
              if (confirm('确定要清空除第一帧外的所有动画帧吗？')) {
                onClearAllFrames();
              }
            }}
            className="text-[10px] text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
          >
            清空所有动画帧
          </button>
        </div>

        {/* Frames Row Strip */}
        <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 px-1 max-w-full scrollbar-thin scrollbar-thumb-slate-200">
          {frames.map((frameGrid, idx) => {
            const isSelected = idx === currentFrameIndex;
            return (
              <div 
                key={idx}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <button
                  id={`timeline-frame-item-${idx}`}
                  onClick={() => onSelectFrame(idx)}
                  className={`w-14 h-14 rounded-lg border-2 overflow-hidden transition-all relative flex-shrink-0 shadow-sm cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 scale-105 ring-2 ring-blue-600/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {renderThumbnailSvg(frameGrid)}
                  
                  {/* Frame Counter Badge */}
                  <span className={`absolute bottom-0.5 right-0.5 text-[8px] font-mono font-bold px-1 rounded ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-700/80 text-slate-100'
                  }`}>
                    {idx + 1}
                  </span>
                </button>
              </div>
            );
          })}

          {/* Quick add frame shortcut card */}
          <button
            id="timeline-quick-add-btn"
            onClick={onAddFrame}
            className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/10 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition-all flex-shrink-0 cursor-pointer"
            title="追加一个新的空白帧"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[8px] font-bold mt-0.5">加帧</span>
          </button>
        </div>
      </div>

      {/* Info Tip Block */}
      <div className="flex gap-2.5 bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-xs text-slate-600 leading-normal">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800">游戏动画开发技巧:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1 text-[11px] text-slate-500">
            <li><strong>葱皮功能 (Onion Skin)</strong> 可以让您看清前后相邻帧的轮廓，极其方便您微调走、跑、跳、攻击等连贯动作。</li>
            <li>在主画布绘制像素点时，会自动同步保存至您当前选中的帧中，您可以像编辑单图一样直接使用撤销、重做和多色色板。</li>
            <li>导出的 <strong>1x 精灵图 (Spritesheet)</strong> 专为 Unity、Unreal、Phaser、GameMaker 等游戏引擎设计，可在引擎内设置 Slice 网格。</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
