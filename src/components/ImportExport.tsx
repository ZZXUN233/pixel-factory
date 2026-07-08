import React, { useState } from 'react';
import { Copy, Check, Download, Code, FileCode, Terminal, Upload } from 'lucide-react';
import { generateCSSBoxShadow, generateSVG, encodeRLE, decodeRLE } from '../utils';

interface ImportExportProps {
  grid: string[];
  width: number;
  height: number;
  palette: string[];
  name: string;
  onImport: (imported: {
    width: number;
    height: number;
    palette: string[];
    grid: string[];
    name: string;
  }) => void;
}

export const ImportExport: React.FC<ImportExportProps> = ({
  grid,
  width,
  height,
  palette,
  name,
  onImport,
}) => {
  const [pastedCode, setPastedCode] = useState('');
  const [importError, setImportError] = useState('');
  const [copiedType, setCopiedType] = useState<'pxe' | 'css' | 'svg' | null>(null);

  // Serialize to the custom PXE coding protocol
  const rleString = encodeRLE(grid, palette);
  const paletteClean = palette.map(c => c.replace('#', '%')); // escape hex '#' so code contains no spaces/weird symbols
  const pxeCode = `PXE:${width}:${height}:[${paletteClean.join(';')}]}:${rleString}`;

  const triggerCopy = (text: string, type: 'pxe' | 'css' | 'svg') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Import custom PXE code handler
  const handleImport = () => {
    setImportError('');
    const code = pastedCode.trim();

    if (!code) {
      setImportError('请输入或粘贴合法的 PXE 协议编码。');
      return;
    }

    try {
      if (!code.startsWith('PXE:')) {
        throw new Error('协议头部不匹配，必须以 "PXE:" 开头。');
      }

      const parts = code.split(':');
      if (parts.length < 5) {
        throw new Error('协议格式错误，缺少必要的段落参数。');
      }

      const importedWidth = parseInt(parts[1], 10);
      const importedHeight = parseInt(parts[2], 10);
      
      if (isNaN(importedWidth) || isNaN(importedHeight)) {
        throw new Error('画布宽高必须是合法的数字。');
      }

      // Reconstruct palette
      const palettePart = parts[3];
      if (!palettePart.startsWith('[') || !palettePart.endsWith(']}')) {
        throw new Error('色板段格式错误。');
      }
      
      const paletteRaw = palettePart.slice(1, -2).split(';');
      const importedPalette = paletteRaw.map(c => c.replace('%', '#'));

      // Reconstruct RLE
      const importedRle = parts.slice(4).join(':'); // join remaining just in case
      
      const decodedGrid = decodeRLE(importedRle, importedWidth, importedHeight, importedPalette);

      onImport({
        width: importedWidth,
        height: importedHeight,
        palette: importedPalette,
        grid: decodedGrid,
        name: `导入的创作 (${importedWidth}x${importedHeight})`
      });

      setPastedCode('');
      
    } catch (err: any) {
      setImportError(err.message || '解析失败，请检查 PXE 编码格式。');
    }
  };

  // High quality upscaled PNG download handler (preserving crisp pixels)
  const downloadPNG = () => {
    const scale = Math.max(1, Math.floor(512 / Math.max(width, height)));
    const canvasWidth = width * scale;
    const canvasHeight = height * scale;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set image smoothing to false to keep pixel borders extremely sharp
    ctx.imageSmoothingEnabled = false;
    (ctx as any).mozImageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    (ctx as any).msImageSmoothingEnabled = false;

    // Draw grid to canvas
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = grid[y * width + x];
        if (color !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    // Trigger programmatic download link
    const link = document.createElement('a');
    link.download = `${name.replace(/\s+/g, '_') || 'pixel_art'}_${width}x${height}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const cssShadowCode = generateCSSBoxShadow(grid, width, height, 8);
  const svgVectorCode = generateSVG(grid, width, height);

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-5">
      
      {/* Visual Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Terminal className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-bold text-slate-800">编码协议与图像导出</h2>
      </div>

      {/* RLE Protocol Display */}
      <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-blue-600 font-mono">PXE 紧凑矩阵编码协议</span>
          <button
            id="copy-pxe-btn"
            onClick={() => triggerCopy(pxeCode, 'pxe')}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[10px] bg-white px-2 py-1 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-sm"
          >
            {copiedType === 'pxe' ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>复制协议码</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-normal">
          通过特定 Run-Length Encoding (RLE) 压缩的纯文本协议表示图像。可用于大型语言模型进行无图条件下的精准生成与传输。
        </p>
        <div className="bg-slate-100/50 p-2.5 rounded-lg border border-slate-200/60 font-mono text-[10px] text-slate-600 break-all select-all">
          {pxeCode}
        </div>
      </div>

      {/* Main Export Deck */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">导出静态文件</h3>
        <div className="grid grid-cols-3 gap-2">
          
          <button
            id="export-png-btn"
            onClick={downloadPNG}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-700 cursor-pointer text-center gap-1.5 shadow-sm"
          >
            <Download className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-bold">超清 PNG</span>
            <span className="text-[9px] text-slate-400 font-mono">无损像素边缘</span>
          </button>

          <button
            id="export-svg-btn"
            onClick={() => triggerCopy(svgVectorCode, 'svg')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-700 cursor-pointer text-center gap-1.5 shadow-sm"
          >
            <FileCode className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-bold">
              {copiedType === 'svg' ? '已复制 SVG!' : '复制 SVG'}
            </span>
            <span className="text-[9px] text-slate-400 font-mono">无限矢量缩放</span>
          </button>

          <button
            id="export-css-btn"
            onClick={() => triggerCopy(cssShadowCode, 'css')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-700 cursor-pointer text-center gap-1.5 shadow-sm"
          >
            <Code className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-bold">
              {copiedType === 'css' ? '已复制 CSS!' : '复制 CSS'}
            </span>
            <span className="text-[9px] text-slate-400 font-mono">单 DIV 盒阴影渲染</span>
          </button>

        </div>
      </div>

      {/* Protocol Import Panel */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">通过协议码导入 (Import PXE)</h3>
        <div className="flex gap-2">
          <input
            id="import-pxe-input"
            type="text"
            value={pastedCode}
            onChange={(e) => {
              setPastedCode(e.target.value);
              setImportError('');
            }}
            placeholder="粘贴 PXE:16:16:[...] 格式的像素协议串..."
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 text-xs rounded-xl font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            id="import-pxe-submit-btn"
            onClick={handleImport}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>导入并渲染</span>
          </button>
        </div>
        {importError && (
          <p className="mt-2 text-[10px] text-rose-600 font-semibold">{importError}</p>
        )}
      </div>

    </div>
  );
};
