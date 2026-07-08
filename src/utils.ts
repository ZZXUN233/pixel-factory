import { PresetTemplate } from './types';

// Helper to run-length encode a flat array of numbers (color indices)
export function encodeRLEFromIndices(indices: number[]): string {
  if (indices.length === 0) return '';
  const runs: string[] = [];
  let currentVal = indices[0];
  let count = 1;

  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === currentVal) {
      count++;
    } else {
      runs.push(`${count}*${currentVal}`);
      currentVal = indices[i];
      count = 1;
    }
  }
  runs.push(`${count}*${currentVal}`);
  return runs.join(',');
}

// Full encoder from grid colors and a palette
export function encodeRLE(grid: string[], palette: string[]): string {
  const indices = grid.map(color => {
    const idx = palette.indexOf(color);
    return idx >= 0 ? idx : 0; // fallback to index 0 (which should be transparent/background)
  });
  return encodeRLEFromIndices(indices);
}

// Full decoder from RLE text to grid colors (supports single 1D string or row-by-row string[])
export function decodeRLE(rle: string | string[], width: number, height: number, palette: string[]): string[] {
  const total = width * height;
  const result: string[] = [];

  if (!rle) {
    return Array(total).fill(palette[0] || 'transparent');
  }

  if (Array.isArray(rle)) {
    // Decode row by row to prevent wrapping shifts completely!
    for (let r = 0; r < height; r++) {
      const rowRle = rle[r] || '';
      const rowResult: string[] = [];
      const cleanRle = rowRle.replace(/\s+/g, '');
      const parts = cleanRle.split(',');

      for (const part of parts) {
        if (!part) continue;
        const separator = part.includes('*') ? '*' : 'x';
        const splitIndex = part.indexOf(separator);
        let countStr = '';
        let indexStr = '';

        if (splitIndex >= 0) {
          countStr = part.slice(0, splitIndex);
          indexStr = part.slice(splitIndex + 1);
        } else {
          countStr = '1';
          indexStr = part;
        }

        const count = parseInt(countStr, 10);
        const index = parseInt(indexStr, 10);
        if (isNaN(count) || isNaN(index)) continue;

        const color = palette[index] !== undefined ? palette[index] : (palette[0] || 'transparent');
        for (let i = 0; i < count; i++) {
          rowResult.push(color);
        }
      }

      // Safeguard for this row: pad or truncate to exactly 'width'
      if (rowResult.length < width) {
        const diff = width - rowResult.length;
        const defaultColor = palette[0] || 'transparent';
        for (let i = 0; i < diff; i++) {
          rowResult.push(defaultColor);
        }
      } else if (rowResult.length > width) {
        rowResult.length = width; // truncate
      }

      result.push(...rowResult);
    }
  } else {
    // Fallback: decode as a single continuous 1D RLE string
    const cleanRle = rle.replace(/\s+/g, '');
    const parts = cleanRle.split(',');

    for (const part of parts) {
      if (!part) continue;
      const separator = part.includes('*') ? '*' : 'x';
      const splitIndex = part.indexOf(separator);
      let countStr = '';
      let indexStr = '';

      if (splitIndex >= 0) {
        countStr = part.slice(0, splitIndex);
        indexStr = part.slice(splitIndex + 1);
      } else {
        countStr = '1';
        indexStr = part;
      }

      const count = parseInt(countStr, 10);
      const index = parseInt(indexStr, 10);
      if (isNaN(count) || isNaN(index)) continue;

      const color = palette[index] !== undefined ? palette[index] : (palette[0] || 'transparent');
      for (let i = 0; i < count; i++) {
        result.push(color);
      }
    }
  }

  // Graceful padding or truncation to prevent app crashes if LLM size is off
  if (result.length < total) {
    const diff = total - result.length;
    const defaultColor = palette[0] || 'transparent';
    for (let i = 0; i < diff; i++) {
      result.push(defaultColor);
    }
  } else if (result.length > total) {
    return result.slice(0, total);
  }

  return result;
}

// ASCII string parser to easily create presets
export function parseAsciiPreset(
  ascii: string,
  mapping: Record<string, string>
): { palette: string[]; rle: string; width: number; height: number } {
  const rows = ascii.trim().split('\n').map(r => r.trim().split(/\s+/));
  const height = rows.length;
  const width = rows[0].length;

  const paletteMap = new Map<string, number>();
  // Index 0 is always transparent
  paletteMap.set('transparent', 0);
  const palette = ['transparent'];

  for (const row of rows) {
    for (const char of row) {
      const color = mapping[char] || 'transparent';
      if (!paletteMap.has(color)) {
        paletteMap.set(color, palette.length);
        palette.push(color);
      }
    }
  }

  const indices: number[] = [];
  for (const row of rows) {
    for (const char of row) {
      const color = mapping[char] || 'transparent';
      indices.push(paletteMap.get(color)!);
    }
  }

  const rle = encodeRLEFromIndices(indices);
  return { palette, rle, width, height };
}

// Generate CSS box shadow for rendering pixel art on the web
export function generateCSSBoxShadow(grid: string[], width: number, height: number, pixelSize: number = 8): string {
  const shadows: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = grid[y * width + x];
      if (color && color !== 'transparent') {
        shadows.push(`${x * pixelSize}px ${y * pixelSize}px ${color}`);
      }
    }
  }
  return `/* CSS Code */
.pixel-art {
  display: inline-block;
  width: ${pixelSize}px;
  height: ${pixelSize}px;
  background: transparent;
  box-shadow:
    ${shadows.join(',\n    ')};
}`;
}

// Generate vector SVG representation
export function generateSVG(grid: string[], width: number, height: number): string {
  const rects: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = grid[y * width + x];
      if (color && color !== 'transparent') {
        rects.push(`  <rect x="${x}" y="${y}" width="1" height="1" fill="${color}" />`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 16}" height="${height * 16}">
  <!-- Generated by Pixel Factory -->
${rects.join('\n')}
</svg>`;
}

// Gorgeous default templates
const MARIO_MUSHROOM = parseAsciiPreset(
  `
  . . . . K K K K K K . . . . .
  . . . K R R R R R R K . . . .
  . . K R R W W R R W W K . . .
  . K R R W W W W R W W W K . .
  . K R W W W W W R W W W K . .
  K R R W W W W R R W W R R K .
  K R R R R R R R R R R R R K .
  K R R K K R R R R K K R R K .
  . K K W W K K K K W W K K . .
  . . K W W W W W W W W K . . .
  . K S S S S S S S S S S K . .
  . K S S K S S S S K S S K . .
  . K S S S S S S S S S S K . .
  . . K S S S S S S S S K . . .
  . . . K K K K K K K K . . . .
  . . . . . . . . . . . . . . .
  `,
  {
    '.': 'transparent',
    'K': '#1e293b',
    'R': '#ef4444',
    'W': '#ffffff',
    'S': '#fbcfe8'
  }
);

const SPACE_INVADER = parseAsciiPreset(
  `
  . . . . . . . . . . . . . . . .
  . . . P . . . . . . . P . . . .
  . . . . P . . . . . P . . . . .
  . . . P P P P P P P P . . . . .
  . . P P . P P P P . P P . . . .
  . P P P P P P P P P P P P . . .
  . P . P P P P P P P P . P . . .
  . P . P . . . . . . P . P . . .
  . . . . P P . . P P . . . . . .
  . . . . . . . . . . . . . . . .
  . . . G G G G G G G G . . . . .
  . . G G W G G G G W G G . . . .
  . . G G G G G G G G G G . . . .
  . . G G . G G G G . G G . . . .
  . . . . G G . . G G . . . . . .
  . . . . . . . . . . . . . . . .
  `,
  {
    '.': 'transparent',
    'P': '#a855f7',
    'G': '#22c55e',
    'W': '#ffffff'
  }
);

const GOLDEN_COIN = parseAsciiPreset(
  `
  . . . . K K K K K K . . . . .
  . . . K Y Y Y Y Y Y K . . . .
  . . K Y Y Y Y Y Y Y Y K . . .
  . K Y Y Y O O O O Y Y Y K . .
  . K Y Y O Y Y Y Y O Y Y K . .
  K Y Y O Y Y Y Y Y Y O Y Y K .
  K Y Y O Y Y Y Y Y Y O Y Y K .
  K Y Y O Y Y Y Y Y Y O Y Y K .
  K Y Y O Y Y Y Y Y Y O Y Y K .
  K Y Y O Y Y Y Y Y Y O Y Y K .
  . K Y Y O Y Y Y Y O Y Y K . .
  . K Y Y Y O O O O Y Y Y K . .
  . . K Y Y Y Y Y Y Y Y K . . .
  . . . K Y Y Y Y Y Y K . . . .
  . . . . K K K K K K . . . . .
  . . . . . . . . . . . . . . .
  `,
  {
    '.': 'transparent',
    'K': '#78350f',
    'Y': '#facc15',
    'O': '#d97706'
  }
);

const CUTE_CACTUS = parseAsciiPreset(
  `
  . . . . . . . F . . . . . . . .
  . . . . . . G G G . . . . . . .
  . . . G . . G L G . . G . . . .
  . . G L G . G L G . G L G . . .
  . . G L G . G L G . G L G . . .
  . . G L G G G L G G G L G . . .
  . . G L L L L L L L L L G . . .
  . . . G G G G L G G G G . . . .
  . . . . . . G L G . . . . . . .
  . . . . . . G L G . . . . . . .
  . . . . B B B B B B . . . . . .
  . . . . B B B B B B . . . . . .
  . . . . . B B B B . . . . . . .
  . . . . . B B B B . . . . . . .
  . . . . . . . . . . . . . . . .
  . . . . . . . . . . . . . . . .
  `,
  {
    '.': 'transparent',
    'G': '#166534',
    'L': '#4ade80',
    'B': '#92400e',
    'F': '#f43f5e'
  }
);

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: '经典蘑菇 (Super Mushroom)',
    category: '游戏/角色',
    width: MARIO_MUSHROOM.width,
    height: MARIO_MUSHROOM.height,
    palette: MARIO_MUSHROOM.palette,
    rle: MARIO_MUSHROOM.rle,
    description: '经典的像素红蘑菇，红白帽子和粉嫩小脸，带黑色轮廓。'
  },
  {
    name: '太空侵略者 (Space Invader)',
    category: '游戏/角色',
    width: SPACE_INVADER.width,
    height: SPACE_INVADER.height,
    palette: SPACE_INVADER.palette,
    rle: SPACE_INVADER.rle,
    description: '复古街机风格的经典太空小怪物，双足站立且带有绿色荧光护盾。'
  },
  {
    name: '金币 (Golden Coin)',
    category: '道具/物品',
    width: GOLDEN_COIN.width,
    height: GOLDEN_COIN.height,
    palette: GOLDEN_COIN.palette,
    rle: GOLDEN_COIN.rle,
    description: '带有黄色和深橙色高光的复古发光像素金币。'
  },
  {
    name: '盆栽仙人掌 (Cute Cactus)',
    category: '自然/植物',
    width: CUTE_CACTUS.width,
    height: CUTE_CACTUS.height,
    palette: CUTE_CACTUS.palette,
    rle: CUTE_CACTUS.rle,
    description: '一个在泥土盆里生长的小仙人掌，顶端开着一朵粉红色小花。'
  }
];
