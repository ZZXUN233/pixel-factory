import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  SlidersHorizontal, 
  Check, 
  CheckCircle2, 
  Grid, 
  Image as ImageIcon,
  RefreshCw,
  Info
} from 'lucide-react';

interface ImagePixelatorProps {
  currentPalette: string[];
  onImport: (project: {
    width: number;
    height: number;
    palette: string[];
    grid: string[];
    name: string;
  }) => void;
}

export function ImagePixelator({ currentPalette, onImport }: ImagePixelatorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(32);
  const [targetHeight, setTargetHeight] = useState<number>(32);
  const [brightness, setBrightness] = useState<number>(0); // -100 to 100
  const [contrast, setContrast] = useState<number>(0);     // -100 to 100
  const [saturation, setSaturation] = useState<number>(0); // -100 to 100
  const [colorMode, setColorMode] = useState<'adaptive' | 'current'>('adaptive');
  const [maxColors, setMaxColors] = useState<number>(16);
  const [enableDither, setEnableDither] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [previewGrid, setPreviewGrid] = useState<string[]>([]);
  const [previewPalette, setPreviewPalette] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper: RGB to Hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
    const rh = clamp(r).toString(16).padStart(2, '0');
    const gh = clamp(g).toString(16).padStart(2, '0');
    const bh = clamp(b).toString(16).padStart(2, '0');
    return `#${rh}${gh}${bh}`;
  };

  // Helper: Hex to RGB
  const hexToRgb = (hex: string) => {
    if (hex === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 255
    } : { r: 0, g: 0, b: 0, a: 0 };
  };

  // Helper: Euclidean color distance
  const findNearestColor = (r: number, g: number, b: number, paletteList: string[]): string => {
    let minDistance = Infinity;
    let nearestColor = 'transparent';
    
    for (const hex of paletteList) {
      if (hex === 'transparent') continue;
      const pRgb = hexToRgb(hex);
      const d = Math.sqrt(
        Math.pow(r - pRgb.r, 2) +
        Math.pow(g - pRgb.g, 2) +
        Math.pow(b - pRgb.b, 2)
      );
      if (d < minDistance) {
        minDistance = d;
        nearestColor = hex;
      }
    }
    return nearestColor;
  };

  // Process the image locally
  const processImage = () => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      // Create offscreen canvas
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw and downscale using normal canvas rendering
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imgData.data;

      // 1. Color/Brightness/Contrast/Saturation filter adjustments
      // Contrast factor calculation
      const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      // Saturation factor calculation
      const sFactor = (saturation + 100) / 100;

      const adjustedPixels: { r: number; g: number; b: number; a: number }[] = [];

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i+1];
        let b = data[i+2];
        const a = data[i+3];

        // Apply Brightness
        r += brightness;
        g += brightness;
        b += brightness;

        // Apply Contrast
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        b = cFactor * (b - 128) + 128;

        // Apply Saturation (Luminance conversion first)
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
        r = gray + (r - gray) * sFactor;
        g = gray + (g - gray) * sFactor;
        b = gray + (b - gray) * sFactor;

        // Clamp values
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        adjustedPixels.push({ r, g, b, a });
      }

      // 2. Select or generate palette
      let finalPalette: string[] = [];

      if (colorMode === 'current') {
        finalPalette = [...currentPalette];
      } else {
        // Simple adaptive palette generation using popularity algorithm
        const colorCounts: { [hex: string]: number } = {};
        adjustedPixels.forEach(p => {
          if (p.a < 50) return; // Ignore fully transparent/semi-transparent
          // Reduce color bits slightly to group similar shades (quantize to multiples of 16)
          const qr = Math.round(p.r / 16) * 16;
          const qg = Math.round(p.g / 16) * 16;
          const qb = Math.round(p.b / 16) * 16;
          const hex = rgbToHex(qr, qg, qb);
          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        });

        // Sort colors by occurrence frequency
        const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
        
        // Take top maxColors
        const adaptiveColors = sortedColors.slice(0, maxColors);
        finalPalette = ['transparent', ...adaptiveColors];
        
        // Ensure there are some colors
        if (finalPalette.length <= 1) {
          finalPalette = ['transparent', '#1e293b', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#facc15', '#a855f7'];
        }
      }

      setPreviewPalette(finalPalette);

      // 3. Map pixels to palette with optional Floyd-Steinberg dithering
      const gridResult: string[] = Array(targetWidth * targetHeight).fill('transparent');

      if (enableDither) {
        // Floyd-Steinberg requires a 2D buffer of raw adjusted RGB floats to distribute error
        const floatBuffer = adjustedPixels.map(p => ({
          r: p.r,
          g: p.g,
          b: p.b,
          a: p.a
        }));

        for (let y = 0; y < targetHeight; y++) {
          for (let x = 0; x < targetWidth; x++) {
            const idx = y * targetWidth + x;
            const p = floatBuffer[idx];

            if (p.a < 50) {
              gridResult[idx] = 'transparent';
              continue;
            }

            // Find closest palette color
            const closestHex = findNearestColor(p.r, p.g, p.b, finalPalette);
            gridResult[idx] = closestHex;

            const cRgb = hexToRgb(closestHex);

            // Compute error
            const errR = p.r - cRgb.r;
            const errG = p.g - cRgb.g;
            const errB = p.b - cRgb.b;

            // Distribute error to neighbors
            // x + 1, y
            if (x + 1 < targetWidth) {
              const nIdx = y * targetWidth + (x + 1);
              floatBuffer[nIdx].r += errR * 7/16;
              floatBuffer[nIdx].g += errG * 7/16;
              floatBuffer[nIdx].b += errB * 7/16;
            }
            // x - 1, y + 1
            if (x - 1 >= 0 && y + 1 < targetHeight) {
              const nIdx = (y + 1) * targetWidth + (x - 1);
              floatBuffer[nIdx].r += errR * 3/16;
              floatBuffer[nIdx].g += errG * 3/16;
              floatBuffer[nIdx].b += errB * 3/16;
            }
            // x, y + 1
            if (y + 1 < targetHeight) {
              const nIdx = (y + 1) * targetWidth + x;
              floatBuffer[nIdx].r += errR * 5/16;
              floatBuffer[nIdx].g += errG * 5/16;
              floatBuffer[nIdx].b += errB * 5/16;
            }
            // x + 1, y + 1
            if (x + 1 < targetWidth && y + 1 < targetHeight) {
              const nIdx = (y + 1) * targetWidth + (x + 1);
              floatBuffer[nIdx].r += errR * 1/16;
              floatBuffer[nIdx].g += errG * 1/16;
              floatBuffer[nIdx].b += errB * 1/16;
            }
          }
        }
      } else {
        // Direct nearest color mapping without dithering
        for (let i = 0; i < adjustedPixels.length; i++) {
          const p = adjustedPixels[i];
          if (p.a < 50) {
            gridResult[i] = 'transparent';
          } else {
            gridResult[i] = findNearestColor(p.r, p.g, p.b, finalPalette);
          }
        }
      }

      setPreviewGrid(gridResult);
    };
  };

  // Re-run processing when inputs change
  useEffect(() => {
    if (imageSrc) {
      processImage();
    }
  }, [imageSrc, targetWidth, targetHeight, brightness, contrast, saturation, colorMode, maxColors, enableDither]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  const applyPixelation = () => {
    if (previewGrid.length === 0) return;
    
    // Clean name for the imported work
    const cleanName = fileName ? `像素化 - ${fileName.split('.')[0]}` : '像素化导入作品';

    onImport({
      width: targetWidth,
      height: targetHeight,
      palette: previewPalette,
      grid: previewGrid,
      name: cleanName
    });
  };

  const resetAll = () => {
    setImageSrc(null);
    setFileName('');
    setPreviewGrid([]);
    setPreviewPalette([]);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
  };

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
      {/* Visual Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">图像本地像素化</h2>
        </div>
        {imageSrc && (
          <button 
            id="pixelator-reset-btn"
            onClick={resetAll}
            className="text-slate-400 hover:text-slate-700 text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            重置
          </button>
        )}
      </div>

      {!imageSrc ? (
        /* Upload Area */
        <div 
          id="pixelator-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerSelectFile}
          className={`h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
            isDragging 
              ? 'border-blue-500 bg-blue-50/50' 
              : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/30'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
            <Upload className="h-6 w-6 text-blue-600" />
          </div>
          <p className="text-xs font-bold text-slate-700 mb-1">
            拖拽图片到这里，或点击选择文件
          </p>
          <p className="text-[10px] text-slate-400">
            支持 JPG, PNG, WEBP 等格式，本地纯浏览器处理，保护隐私
          </p>
        </div>
      ) : (
        /* Adjustments & Preview Area */
        <div className="flex flex-col gap-4">
          {/* Target Dimensions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              目标画布尺寸
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[16, 32, 48, 64].map((size) => {
                const isSelected = targetWidth === size && targetHeight === size;
                return (
                  <button
                    id={`pixelator-size-btn-${size}`}
                    key={size}
                    onClick={() => {
                      setTargetWidth(size);
                      setTargetHeight(size);
                    }}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-600 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {size} × {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Mapping Mode Selection */}
          <div className="grid grid-cols-2 gap-2 border-t border-b border-slate-100 py-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">颜色压缩模式</label>
              <select
                id="pixelator-color-mode"
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="adaptive">自适应全新色板</option>
                <option value="current">匹配当前编辑器色板</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">辅助选项</label>
              <div className="flex items-center h-[34px] pl-1">
                <label className="relative flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer select-none">
                  <input
                    id="pixelator-dither-checkbox"
                    type="checkbox"
                    checked={enableDither}
                    onChange={(e) => setEnableDither(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                  />
                  <span>开启抖动处理 (Dither)</span>
                </label>
              </div>
            </div>
          </div>

          {colorMode === 'adaptive' && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>最大自适应颜色数</span>
                <span className="font-mono text-blue-600">{maxColors} 种</span>
              </div>
              <input
                id="pixelator-colors-slider"
                type="range"
                min="4"
                max="32"
                step="4"
                value={maxColors}
                onChange={(e) => setMaxColors(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          )}

          {/* Slider parameters */}
          <div className="flex flex-col gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200/50 pb-1.5 mb-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>图像微调参数</span>
            </div>

            {/* Brightness */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>亮度 (Brightness)</span>
                <span>{brightness > 0 ? `+${brightness}` : brightness}</span>
              </div>
              <input
                id="pixelator-brightness-slider"
                type="range"
                min="-60"
                max="60"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Contrast */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>对比度 (Contrast)</span>
                <span>{contrast > 0 ? `+${contrast}` : contrast}</span>
              </div>
              <input
                id="pixelator-contrast-slider"
                type="range"
                min="-60"
                max="60"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Saturation */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>饱和度 (Saturation)</span>
                <span>{saturation > 0 ? `+${saturation}` : saturation}</span>
              </div>
              <input
                id="pixelator-saturation-slider"
                type="range"
                min="-60"
                max="60"
                value={saturation}
                onChange={(e) => setSaturation(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          {/* Micro Preview Box */}
          {previewGrid.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>像素化实时效果预览</span>
                <span className="font-mono text-slate-500">缩放网格 ({targetWidth}x{targetHeight})</span>
              </label>

              <div className="flex justify-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div 
                  className="grid border border-slate-200 bg-white p-0.5 overflow-hidden shadow-sm"
                  style={{
                    gridTemplateColumns: `repeat(${targetWidth}, 1fr)`,
                    width: '180px',
                    height: '180px'
                  }}
                >
                  {previewGrid.map((color, idx) => (
                    <div 
                      key={idx} 
                      style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                      className="aspect-square"
                    />
                  ))}
                </div>
              </div>

              {/* Show extracted palette preview */}
              {colorMode === 'adaptive' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">自适应色板预览</span>
                  <div className="flex flex-wrap gap-1">
                    {previewPalette.map((col, index) => {
                      if (col === 'transparent') return null;
                      return (
                        <div 
                          key={index} 
                          className="w-4 h-4 rounded-sm border border-slate-200 shadow-sm"
                          style={{ backgroundColor: col }}
                          title={col}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Banner */}
          <div className="flex gap-2 bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-[11px] text-slate-500 leading-normal">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-700">说明:</strong> 点击下方按钮将加载此像素图到主画布。这将替换您当前绘制的画作，并在自适应模式下为您同步一套全新的定制色板。
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            id="pixelator-apply-btn"
            onClick={applyPixelation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            应用并导入到主编辑器
          </button>
        </div>
      )}
    </div>
  );
}
