# Pixel Factory — 领域语言 (Domain Glossary)

像素工厂是一个基于文本 RLE 矩阵协议的 AI 像素艺术生成器与可视化编辑器，支持绘制、动画、AI 生成、图片像素化和游戏引擎导出。

## Language

### 核心概念

**像素画 (Pixel Art)**:
以网格为单位的数字图像，每个格子（像素）填充单一颜色。
_Avoid_: 点阵图、位图

**像素网格 (Grid)**:
扁平的 `string[]` 数组，每个元素是十六进制颜色值或 `'transparent'`。

**游程编码 (RLE — Run-Length Encoding)**:
像素矩阵的压缩文本表示，格式为 `"count*index"` 逗号分隔序列（如 `"12*0,4*1,2*3,238*0"`）。支持一维连续字符串和按行数组两种格式。

**PXE 协议**:
自定义文本传输协议，格式为 `PXE:{width}:{height}:[{palette}]}:{rle}`。用于在无图像条件下通过纯文本精确传输像素画。

**调色板 (Palette)**:
颜色数组，索引 0 始终为透明/背景色。AI 生成时约束为 3-12 色。

### 编辑工具

**工具 (Tool)** — 画笔 (Pen)、橡皮 (Eraser)、油漆桶 (Bucket)、吸色器 (Picker):
四种绘制工具。油漆桶实现为四方向 BFS 泛洪填充算法。吸色器点击像素自动选中颜色并将工具切回画笔。

**镜像对称 (Symmetry Mode)**:
水平、垂直、田字四种对称模式，通过像素坐标变换实现多位置同时绘制。

**历史栈 (History Stack)**:
撤销/重做实现，`history[]` + `historyPointer`，每次新操作截断指针之后的历史。

### 动画

**动画帧 (Frame)**:
动画序列中的单帧图像，存储在 `frames[][]` 数组中。

**葱皮视图 (Onion Skin)**:
前后相邻帧的半透明叠加显示（前一帧不透明度 0.35，后一帧 0.18），辅助帧间对齐与连贯绘制。

**精灵图 (Spritesheet — 精灵图)**:
所有帧水平排列的条形图，支持 1x 游戏分辨率导出和 HD 放大导出。附带 Unity/Phaser 兼容的 JSON 帧元数据。

### AI 生成

**AI 像素生成**:
通过 `POST /api/generate` 调用 Gemini 3.5 Flash，输入文字描述、风格、背景，输出 RLE + 调色板的 JSON 结构化结果。

**AI 动画续写**:
`POST /api/generate-next-frame`（单帧微调）和 `POST /api/generate-frame-sequence`（批量序列生成）。以当前帧的像素索引矩阵为输入，推演后续运动帧。

### 图片像素化

**像素化 (Pixelation)**:
将上传图片下采样到目标网格尺寸，支持自适应调色板提取（基于颜色流行度排序）或匹配当前编辑器色板。

**抖动处理 (Dither)**:
Floyd-Steinberg 误差扩散算法（7/16, 3/16, 5/16, 1/16 分布），在颜色数受限时模拟渐变效果。