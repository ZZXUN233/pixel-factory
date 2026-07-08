import React, { useState, useEffect } from 'react';
import { Sparkles, HelpCircle, Loader2 } from 'lucide-react';

interface AIGeneratorProps {
  onGenerateSuccess: (result: {
    name: string;
    palette: string[];
    rle: string;
    explanation: string;
    width: number;
    height: number;
  }) => void;
  currentSize: { width: number; height: number };
  onSizeChange: (width: number, height: number) => void;
}

const ART_STYLES = [
  { name: '经典红白机 (Retro NES)', value: 'Retro Game / NES' },
  { name: '赛博霓虹 (Cyberpunk)', value: 'Cyberpunk Neon / Glowing' },
  { name: '奇幻魔法 (Fantasy)', value: 'Fantasy Quest / RPG Item' },
  { name: '治愈萌系 (Cozy Cute)', value: 'Cozy Cute / Chibi Sprite' },
  { name: '极简徽章 (Minimal Icon)', value: 'Minimalist Icon / Symbol' }
];

const BACKGROUND_OPTIONS = [
  { name: '透明背景', value: 'transparent' },
  { name: '深色墨空', value: '#0f172a' },
  { name: '幽星紫夜', value: '#1e1b4b' },
  { name: '岩烧熔岩', value: '#1a0c00' },
];

const GRID_SIZES = [
  { label: '8 × 8 (极简)', width: 8, height: 8 },
  { label: '16 × 16 (推荐)', width: 16, height: 16 },
  { label: '32 × 32 (精细)', width: 32, height: 32 },
  { label: '64 × 64 (巨制)', width: 64, height: 64 },
];

export const AIGenerator: React.FC<AIGeneratorProps> = ({
  onGenerateSuccess,
  currentSize,
  onSizeChange,
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(ART_STYLES[0].value);
  const [selectedBg, setSelectedBg] = useState(BACKGROUND_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');

  // Retro assembly simulation texts
  const LOADING_STEPS = [
    '正在连线复古图像服务器...',
    '分析图形结构与视觉轴对称...',
    '计算最优紧凑色板方案 (3-12色)...',
    '正在逐行拟合 RLE 坐标矩阵...',
    '解压文本特征信息，渲染像素画布...',
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMessage('请输入图片描述，例如：“一把燃烧着火焰的魔法之剑”');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setAiExplanation('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          width: currentSize.width,
          height: currentSize.height,
          style: selectedStyle,
          background: selectedBg,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `请求出错 (代码 ${response.status})`);
      }

      const data = await response.json();
      
      onGenerateSuccess({
        name: data.name || 'AI 像素画',
        palette: data.palette,
        rle: data.rle,
        explanation: data.explanation,
        width: currentSize.width,
        height: currentSize.height,
      });

      setAiExplanation(data.explanation);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '生成失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Sparkles className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-bold text-slate-800">AI 像素生成引擎</h2>
      </div>

      {/* 1. Prompt Input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>灵感创意描述 (Prompt)</span>
          <span className="text-[10px] text-blue-600 lowercase font-mono">Powered by Gemini 3.5</span>
        </label>
        <textarea
          id="ai-prompt-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要的像素画（支持中文/英文），例如：&#10;“一个粉红色的复古心形，带白色高光和黑色阴影”&#10;“一个戴着红帽子的像素小马里奥”&#10;“一把散发绿色幽光的骷髅法杖”"
          className="w-full h-24 bg-slate-50 border border-slate-200 text-slate-800 p-3 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 resize-none placeholder:text-slate-400 leading-relaxed"
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 2. Grid Size Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">画布尺寸</label>
          <div className="grid grid-cols-1 gap-1">
            {GRID_SIZES.map((size) => {
              const isSelected = currentSize.width === size.width && currentSize.height === size.height;
              return (
                <button
                  id={`generator-size-btn-${size.width}`}
                  key={size.label}
                  onClick={() => onSizeChange(size.width, size.height)}
                  className={`py-1.5 px-3 rounded-lg border text-[11px] font-medium text-left transition-all flex justify-between items-center cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-600 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-100/50'
                  }`}
                  disabled={loading}
                >
                  <span>{size.label}</span>
                  <span className="text-[9px] opacity-60 font-mono">{size.width * size.height} 像素</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Style & BG Selection */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">艺术风格</label>
            <select
              id="ai-style-select"
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              disabled={loading}
            >
              {ART_STYLES.map((style) => (
                <option key={style.value} value={style.value}>{style.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">背景填充</label>
            <select
              id="ai-bg-select"
              value={selectedBg}
              onChange={(e) => setSelectedBg(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              disabled={loading}
            >
              {BACKGROUND_OPTIONS.map((bg) => (
                <option key={bg.value} value={bg.value}>{bg.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Error Message */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-lg text-xs leading-relaxed">
          {errorMessage}
        </div>
      )}

      {/* 5. Assembly Loader */}
      {loading && (
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg flex flex-col items-center justify-center text-center gap-3">
          <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-slate-800 animate-pulse font-mono">{LOADING_STEPS[loadingStep]}</p>
            <p className="text-[10px] text-slate-500">正在与神经网络绘制微缩矩阵，通常需要 5-10 秒...</p>
          </div>
          {/* Animated Pixel-styled progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div 
              className="h-full bg-blue-600 transition-all duration-1000 ease-out"
              style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 6. AI Explanation Output */}
      {aiExplanation && !loading && (
        <div className="bg-blue-50/50 border border-blue-100/60 p-3.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>AI 艺术家说</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed italic">
            "{aiExplanation}"
          </p>
        </div>
      )}

      {/* 7. Action Button */}
      {!loading && (
        <button
          id="ai-generate-btn"
          onClick={handleGenerate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          开始生成像素图像 (AI Cast)
        </button>
      )}
    </div>
  );
};
