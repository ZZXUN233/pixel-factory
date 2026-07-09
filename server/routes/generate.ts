import { Router, Request, Response } from 'express';
import { getLLMProvider } from '../lib/llm';

const router = Router();

/**
 * Convert a flat grid of hex color strings to RLE using given palette indices.
 * Palette[0] is always the background/transparent color.
 */
function gridToRLE(grid: string[], palette: string[], width: number, height: number): string {
  const rleParts: string[] = [];
  let currentIndex = -1;
  let currentCount = 0;

  for (let i = 0; i < grid.length; i++) {
    const color = grid[i] || palette[0];
    const idx = palette.indexOf(color);
    const index = idx >= 0 ? idx : 0;

    if (index === currentIndex) {
      currentCount++;
    } else {
      if (currentCount > 0) {
        rleParts.push(`${currentCount}*${currentIndex}`);
      }
      currentIndex = index;
      currentCount = 1;
    }
  }
  if (currentCount > 0) {
    rleParts.push(`${currentCount}*${currentIndex}`);
  }

  // Verify total
  const total = rleParts.reduce((sum, part) => sum + parseInt(part.split('*')[0], 10), 0);
  if (total !== width * height) {
    // Pad or trim to fix counting errors (shouldn't happen with grid approach)
    console.warn(`[gridToRLE] count mismatch: got ${total}, expected ${width * height}`);
  }

  return rleParts.join(',');
}

/**
 * Extract palette from grid colors. Places background color at index 0.
 */
function extractPalette(grid: string[], bgColor: string): string[] {
  const colorSet = new Set<string>();
  colorSet.add(bgColor);
  for (const color of grid) {
    if (color && color !== bgColor) {
      colorSet.add(color);
    }
  }
  return Array.from(colorSet);
}

/**
 * Convert ASCII art rows + palette character map to flat hex grid.
 */
function asciiToGrid(rows: string[], charPalette: Record<string, string>, width: number, height: number): string[] {
  const grid: string[] = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y] || '';
    // Pad or trim to exact width
    const padded = row.padEnd(width, ' ').slice(0, width);
    for (let x = 0; x < width; x++) {
      const char = padded[x];
      const color = charPalette[char] || charPalette[' '] || 'transparent';
      grid.push(color);
    }
  }
  return grid;
}

/** Generate pixel art: AI outputs an ASCII art text grid with palette, backend converts to RLE */
async function generatePixelArt(params: {
  prompt: string;
  width: number;
  height: number;
  style: string;
  background: string;
}): Promise<{ name: string; palette: string[]; rle: string; explanation: string; fullPrompt: string }> {
  const { prompt, width, height, style, background } = params;

  const systemPrompt = 'You are a pixel art designer. Output only valid JSON.';

  const userContent = `Create pixel art of: "${prompt}"
Canvas: ${width} columns x ${height} rows
Style: ${style}

Step 1 — Define a COLOR PALETTE as single characters mapping to hex colors.
Use different characters for different colors. Example:
  " " = "${background}" (background/empty)
  "w" = "#ffffff" (white)
  "r" = "#ff4444" (red)
  "b" = "#4444ff" (blue)
  "y" = "#ffff44" (yellow)
You choose the characters and colors based on the subject.

Step 2 — Draw the pixel art as a ${height}-LINE text grid using ONLY the palette characters.
- Each line must be exactly ${width} characters wide.
- ${width}x${height} = ${width * height} total characters.
- The subject should be centered, surrounded by background characters (" ").
- Every character in the grid must be one of your palette keys.
- Make the subject look recognisable — its shape/silhouette matters most.

Step 3 — Encode the artwork into PXE (Pixel Exchange Encoding) protocol format.
PXE format is: PXE:{width}:{height}:[{palette_hex_with_percent_instead_of_hash}]}:{rle}
RLE is run-length encoding of the flat grid using palette indices (0 = first color in palette array).
Example: for a 16x16 canvas, palette ["#0f172a","#ff4444","#ffffff"], the PXE string would be:
PXE:16:16:[%0f172a;%ff4444;%ffffff]}:10*0,4*1,2*2,...
Count total RLE entries = width * height = ${width * height}.

Output ONLY valid JSON:
{
  "name": "title",
  "palette": { "char1": "#hex", "char2": "#hex", ... },
  "grid": ["row0...", "row1...", ...],
  "pxe": "PXE:${width}:${height}:[...]}:...",
  "explanation": "design notes"
}

Where grid has exactly ${height} strings, each exactly ${width} characters.
Remember: " " (space) = background color = "${background}" .`;

  const fullPrompt = `[System]\n${systemPrompt}\n\n[User]\n${userContent}`;

  const provider = getLLMProvider();
  const text = await provider.generateText({
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  // Strip markdown fences if present
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const data = JSON.parse(cleaned);

  const charPalette: Record<string, string> = data.palette;
  const gridRows: string[] = data.grid;

  if (!Array.isArray(gridRows) || gridRows.length !== height) {
    throw new Error(`AI returned ${gridRows?.length} rows, expected ${height}`);
  }

  // Ensure background char exists
  if (!charPalette[' ']) {
    charPalette[' '] = background;
  }

  const flatGrid = asciiToGrid(gridRows, charPalette, width, height);
  const palette = extractPalette(flatGrid, background);
  const rle = gridToRLE(flatGrid, palette, width, height);

  return {
    name: data.name || 'AI 像素画',
    palette,
    rle,
    explanation: data.explanation || '',
    fullPrompt,
  };
}

/** Generate next animation frame from current grid state */
async function generateNextFrame(params: {
  grid: string[];
  palette: string[];
  width: number;
  height: number;
  prompt: string;
}): Promise<{ name: string; palette: string[]; rle: string[]; explanation: string }> {
  const { grid, palette, width, height, prompt } = params;

  // Build a 2D view of the current frame
  const rows: string[][] = [];
  for (let i = 0; i < height; i++) {
    rows.push(grid.slice(i * width, (i + 1) * width));
  }

  const systemPrompt = `You are a retro game animator. Given a current frame as a 2D color grid, generate the NEXT frame.
Modify pixels incrementally to create smooth animation.
Respond in valid JSON only.`;

  const userContent = `Current frame (${width}x${height}):
${JSON.stringify(rows)}

Animation action: "${prompt}"
Palette: ${JSON.stringify(palette)}

Output the next frame as a 2D array of hex color strings.
Use ONLY colors from the palette above.
Make minimal, smooth changes from the current frame.

Output JSON: { "name": string, "grid": string[][], "explanation": string }`;

  const provider = getLLMProvider();
  const text = await provider.generateText({
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const data = JSON.parse(cleaned);

  const grid2D: string[][] = data.grid;
  const flatGrid: string[] = grid2D.flat();

  // Convert each row to per-row RLE
  const rleRows: string[] = [];
  for (let y = 0; y < height; y++) {
    const rowRle: string[] = [];
    let currIdx = -1;
    let currCnt = 0;
    for (let x = 0; x < width; x++) {
      const color = flatGrid[y * width + x] || palette[0];
      const idx = palette.indexOf(color);
      const index = idx >= 0 ? idx : 0;
      if (index === currIdx) {
        currCnt++;
      } else {
        if (currCnt > 0) rowRle.push(`${currCnt}*${currIdx}`);
        currIdx = index;
        currCnt = 1;
      }
    }
    if (currCnt > 0) rowRle.push(`${currCnt}*${currIdx}`);
    rleRows.push(rowRle.join(','));
  }

  return {
    name: data.name || 'AI 帧',
    palette,
    rle: rleRows,
    explanation: data.explanation || '',
  };
}

/** Generate multi-frame animation sequence */
async function generateFrameSequence(params: {
  grid: string[];
  palette: string[];
  width: number;
  height: number;
  prompt: string;
  count: number;
}): Promise<{ palette: string[]; frames: Array<{ name: string; rle: string[]; explanation: string }> }> {
  const { grid, palette, width, height, prompt } = params;
  const numFrames = Math.min(Math.max(parseInt(String(params.count)) || 5, 2), 8);

  // Build 2D view of the starting frame
  const startRows: string[][] = [];
  for (let i = 0; i < height; i++) {
    startRows.push(grid.slice(i * width, (i + 1) * width));
  }

  const systemPrompt = `You are a retro game animator. Given a starting frame, generate ${numFrames} animation frames.
Each frame evolves incrementally from the previous one.
Respond in valid JSON only.`;

  const userContent = `Starting frame (${width}x${height}):
${JSON.stringify(startRows)}

Animation action: "${prompt}"
Palette: ${JSON.stringify(palette)}
Number of frames to generate: ${numFrames}

Output frames as an array of 2D color grids.
Frame 0 follows the starting frame, Frame 1 follows Frame 0, etc.
Use ONLY colors from the palette above.

Output JSON: { "palette": string[], "frames": [{ "name": string, "grid": string[][], "explanation": string }] }`;

  const provider = getLLMProvider();
  const text = await provider.generateText({
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const data = JSON.parse(cleaned);

  const frames = (data.frames || []).map((frame: any) => {
    const fGrid: string[] = frame.grid.flat();
    const rleRows: string[] = [];
    for (let y = 0; y < height; y++) {
      const rowRle: string[] = [];
      let currIdx = -1;
      let currCnt = 0;
      for (let x = 0; x < width; x++) {
        const color = fGrid[y * width + x] || palette[0];
        const idx = palette.indexOf(color);
        const index = idx >= 0 ? idx : 0;
        if (index === currIdx) {
          currCnt++;
        } else {
          if (currCnt > 0) rowRle.push(`${currCnt}*${currIdx}`);
          currIdx = index;
          currCnt = 1;
        }
      }
      if (currCnt > 0) rowRle.push(`${currCnt}*${currIdx}`);
      rleRows.push(rowRle.join(','));
    }
    return { name: frame.name || '帧', rle: rleRows, explanation: frame.explanation || '' };
  });

  return { palette, frames };
}

// ─── Routes ──────────────────────────────────────

/**
 * POST /api/generate — AI Pixel Art generation
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, width = 16, height = 16, style = 'Retro Game', background = 'transparent' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Please provide a descriptive prompt for the pixel art.' });
    }

    const result = await generatePixelArt({ prompt, width, height, style, background });
    return res.json(result);
  } catch (error: any) {
    console.error('API Generation Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during pixel art generation.',
      details: error.stack,
    });
  }
});

/**
 * POST /api/generate-next-frame — AI single animation frame
 */
router.post('/generate-next-frame', async (req: Request, res: Response) => {
  try {
    const { grid, palette, width = 16, height = 16, prompt } = req.body;

    if (!grid || !Array.isArray(grid)) {
      return res.status(400).json({ error: 'Please provide the current frame grid.' });
    }
    if (!palette || !Array.isArray(palette)) {
      return res.status(400).json({ error: 'Please provide the current color palette.' });
    }
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Please specify the action prompt for the next animation frame.' });
    }

    const result = await generateNextFrame({ grid, palette, width, height, prompt });
    return res.json(result);
  } catch (error: any) {
    console.error('API Generate Next Frame Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during next animation frame generation.',
      details: error.stack,
    });
  }
});

/**
 * POST /api/generate-frame-sequence — AI multi-frame animation sequence
 */
router.post('/generate-frame-sequence', async (req: Request, res: Response) => {
  try {
    const { grid, palette, width = 16, height = 16, prompt, count = 5 } = req.body;

    if (!grid || !Array.isArray(grid)) {
      return res.status(400).json({ error: 'Please provide the starting frame grid.' });
    }
    if (!palette || !Array.isArray(palette)) {
      return res.status(400).json({ error: 'Please provide the current color palette.' });
    }
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Please specify the sequence action prompt.' });
    }

    const result = await generateFrameSequence({ grid, palette, width, height, prompt, count });
    return res.json(result);
  } catch (error: any) {
    console.error('API Generate Frame Sequence Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during animation sequence generation.',
      details: error.stack,
    });
  }
});

export default router;