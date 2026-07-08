# 0002 — 全量提升状态至 App.tsx（Lifted State）

编辑器核心状态（grid, palette, frames, history, tool, tab）全部集中在 App.tsx 中，通过 props 向下传递给所有子组件。

## 背景

AI Studio 构建环境下的应用以单文件快速迭代为主，且组件树深度有限（7 个直接子组件）。选择 lifted state 而非全局状态管理（Redux/Zustand）或 Context，是为了最小化抽象层数，让数据和数据流向一目了然。

## 替代考虑

- **Context API**：可减少中间组件的不必要重渲染，但需要额外 Provider 包装和处理 memoization。
- **zustand**：更简洁的选择，但引入额外依赖。
- **每个组件独立管理状态**：会导致帧同步、调色板同步等跨组件状态一致性问题。

## 影响

- props drilling 深度 6-7 层（App → PaletteSection → ...），小尺寸尚可，随着组件增多会成为维护负担。
- 每次 grid 或 palette 变化触发整个 App 重渲染。当前 16x16 网格（256 个 div）下性能可接受，64x64 时需关注。
- 迁移方案：中期引入 zustand，将 grid/palette/frames/history 抽取为独立 store。