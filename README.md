# Pixel Factory

基于文本 RLE 矩阵协议的 AI 像素生成与可视化设计工坊。拥有完整的像素画布编辑器、AI 精灵生成（Gemini / DeepSeek）、图片像素化、动画帧编辑器、社区画廊等功能。

## 功能特性

- **🎨 像素画布编辑器** — 画笔 / 橡皮 / 油漆桶 / 取色器，支持撤销/重做、网格线、镜像对称绘制
- **🤖 AI 像素生成** — 文字描述即可生成像素画，支持 Gemini 和 DeepSeek 双引擎，通过 `LLM_PROVIDER` 环境变量切换
- **🖼️ 图片像素化** — 上传图片自动降采样为像素风格，可调节亮度/对比度/饱和度/抖动
- **🎬 动画工作室** — 多帧动画时间线、洋葱皮、GIF / Spritesheet 导出（支持 AI 生成帧序列）
- **📦 PXE 协议导入/导出** — 基于 RLE 压缩文本协议的跨平台像素数据交换格式
- **🏛️ 作品画廊** — 本地 localStorage 保存 + 社区云画廊（需登录）
- **🔐 OAuth2 认证** — 通过 auth.zzxun.cn 的授权登录

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19, Vite 6, Tailwind CSS 4, Lucide Icons, Motion |
| 后端 | Express 4, Prisma ORM, MySQL |
| AI | Google Gemini API (`@google/genai`), DeepSeek API (兼容 OpenAI 格式) |
| 其他 | JWT 认证, gifenc (浏览器端 GIF 编码) |

## 快速开始

### 前置条件

- Node.js >= 18
- MySQL 数据库
- Gemini API Key 或 DeepSeek API Key

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填写 API Key 和数据库连接

# 3. 初始化数据库 (Prisma)
npm run db:generate
npm run db:push

# 4. 启动开发服务器 (端口 3000)
npm run dev
```

### AI Provider 切换

通过 `LLM_PROVIDER` 环境变量选择后端引擎：

```env
# 使用 Gemini (默认)
LLM_PROVIDER=gemini
GEMINI_API_KEY="your-gemini-key"

# 使用 DeepSeek
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY="sk-your-deepseek-key"
DEEPSEEK_MODEL="deepseek-chat"
```

前端自动检测当前 Provider 并显示在 UI 标题栏。

## 项目结构

```
pixel-factory/
├── server/                  # Express 后端
│   ├── index.ts             # 服务入口，路由挂载
│   ├── lib/
│   │   ├── llm.ts           # LLM Provider 抽象层 (Gemini / DeepSeek)
│   │   ├── prisma.ts        # Prisma 客户端
│   │   ├── jwt.ts           # JWT 工具
│   │   ├── auth-center.ts   # OAuth2 认证中心客户端
│   │   └── serialize.ts     # 序列化工具
│   ├── routes/
│   │   ├── generate.ts      # AI 生成接口 (3 个端点)
│   │   ├── auth.ts          # OAuth 回调与登录状态
│   │   ├── projects.ts      # 作品 CRUD
│   │   └── gallery.ts       # 社区画廊
│   └── middleware/
│       └── auth.ts          # JWT 验证中间件
├── src/                     # React 前端
│   ├── App.tsx              # 根组件，所有状态管理
│   ├── components/
│   │   ├── GridCanvas.tsx   # 核心像素画布
│   │   ├── AIGenerator.tsx  # AI 生成面板
│   │   ├── AnimationStudio.tsx
│   │   ├── ImagePixelator.tsx
│   │   ├── ImportExport.tsx
│   │   ├── PaletteSection.tsx
│   │   ├── ProjectGallery.tsx
│   │   ├── CommunityGallery.tsx
│   │   └── AuthButton.tsx
│   ├── hooks/useAuth.ts     # 认证 Hook
│   ├── lib/auth.ts          # 认证 API 调用
│   └── ...
├── prisma/
│   └── schema.prisma        # 数据库模型
├── sql/
│   └── init.sql             # 初始化 SQL (预设数据)
└── package.json
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/generate` | 从文字生成像素画 |
| POST | `/api/generate-next-frame` | 生成下一帧动画 |
| POST | `/api/generate-frame-sequence` | 生成多帧动画序列 |
| GET | `/api/llm-provider` | 获取当前 AI Provider 名称 |
| GET | `/api/auth/login` | OAuth2 登录跳转 |
| GET | `/api/auth/callback` | OAuth2 回调 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/projects` | 获取用户作品列表 |
| POST | `/api/projects` | 保存作品 |
| DELETE | `/api/projects/:id` | 删除作品 |
| GET | `/api/gallery` | 获取社区画廊作品 |
| POST | `/api/gallery` | 发布到社区画廊 |

## 构建部署

```bash
npm run build    # 构建前端 + 后端
npm start        # 启动生产服务器 (dist/)
```
