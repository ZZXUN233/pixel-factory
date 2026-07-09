import { Router, Request, Response } from 'express';
import { getLLMProvider } from '../lib/llm';

const router = Router();

/** Shared: build system prompt + user message for single image generation */
async function generatePixelArt(params: {
  prompt: string;
  width: number;
  height: number;
  style: string;
  background: string;
}): Promise<string> {
  const { prompt, width, height, style, background } = params;
  const size = width * height;

  const systemPrompt = `You are a legendary pixel artist specializing in retro game icons, items, and sprites.
You generate visual pixel art grids mapped row-by-row, from top-left to bottom-right of a ${width}x${height} canvas.
Your output must be a run-length encoded (RLE) sequence representing exactly ${size} pixels.
Respond in valid JSON.`;

  const userContent = `Generate a pixel art masterpiece based on this prompt: "${prompt}"
Grid Size: ${width}x${height} (Total pixels: ${size})
Visual Theme/Style: "${style}"
Background Style: "${background}"

Rules:
1. Palette Selection:
   - Create 3 to 12 colors.
   - Index 0 is the background: "${background}". If 'transparent' use "transparent".
   - Other colors are hex codes (e.g. "#ef4444").

2. Run-Length Encoding (RLE):
   - Format: "count*index" separated by commas (e.g. "12*0,4*1,2*3,238*0").
   - The sum of all 'count' values must equal exactly ${size}.
   - Center the drawing, use symmetry.

3. Return JSON: { "name": string, "palette": string[], "rle": string, "explanation": string }`;

  const provider = getLLMProvider();
  return provider.generateText({
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
}

/** Build prompt for next-frame generation */
async function generateNextFrame(params: {
  grid: string[];
  palette: string[];
  width: number;
  height: number;
  prompt: string;
}): Promise<string> {
  const { grid, palette, width, height, prompt } = params;

  const currentIndices = grid.map((color: string) => {
    const idx = palette.indexOf(color);
    return idx >= 0 ? idx : 0;
  });

  const rowsOfIndices: number[][] = [];
  for (let i = 0; i < height; i++) {
    rowsOfIndices.push(currentIndices.slice(i * width, (i + 1) * width));
  }

  const systemPrompt = `You are a retro game animator. Given the current frame (size ${width}x${height}) as a 2D index array and an animation action, generate the NEXT sequential frame.
Maintain visual continuity, outlines, shadows, and shape consistency.
Respond in valid JSON.`;

  const userContent = `Current Frame Configuration:
- Canvas: ${width}x${height}
- Palette: ${JSON.stringify(palette)}
- Current Frame (2D index array):
  ${JSON.stringify(rowsOfIndices, null, 2)}

Target Action: "${prompt}"

Rules:
1. Use existing palette indices. Index 0 remains background/transparent.
2. Output RLE as an array of exactly ${height} strings.
3. Each row's RLE: comma-separated "count*index" pairs summing to ${width}.
4. Return JSON: { "name": string, "palette": string[], "rle": string[], "explanation": string }`;

  const provider = getLLMProvider();
  return provider.generateText({
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
}

/** Build prompt for multi-frame sequence */
async function generateFrameSequence(params: {
  grid: string[];
  palette: string[];
  width: number;
  height: number;
  prompt: string;
  count: number;
}): Promise<string> {
  const { grid, palette, width, height, prompt } = params;
  const numFrames = Math.min(Math.max(parseInt(String(params.count)) || 5, 2), 8);

  const startIndices = grid.map((color: string) => {
    const idx = palette.indexOf(color);
    return idx >= 0 ? idx : 0;
  });

  const rowsOfIndices: number[][] = [];
  for (let i = 0; i < height; i++) {
    rowsOfIndices.push(startIndices.slice(i * width, (i + 1) * width));
  }

  const systemPrompt = `You are an elite retro game animator designing fluid multi-frame pixel art sequences.
Given a starting frame (size ${width}x${height}) you will generate ${numFrames} sequential frames.
Each frame evolves incrementally from the previous one.
Respond in valid JSON.`;

  const userContent = `Animation Sequence:
- Canvas: ${width}x${height}
- Palette: ${JSON.stringify(palette)}
- Starting Frame (2D index array):
  ${JSON.stringify(rowsOfIndices, null, 2)}

Target Action: "${prompt}"
Number of frames: ${numFrames}

Rules:
1. Frame 1 follows the starting frame, Frame 2 follows Frame 1, etc.
2. Use existing palette indices. Index 0 remains background/transparent.
3. Each frame's RLE is an array of exactly ${height} strings.
4. Each row: "count*index" pairs summing to ${width}.
5. Return JSON: { "palette": string[], "frames": [{ "name": string, "rle": string[], "explanation": string }] }`;

  const provider = getLLMProvider();
  return provider.generateText({
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
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

    const text = await generatePixelArt({ prompt, width, height, style, background });
    const data = JSON.parse(text);
    return res.json(data);
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

    const text = await generateNextFrame({ grid, palette, width, height, prompt });
    const data = JSON.parse(text);
    return res.json(data);
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

    const text = await generateFrameSequence({ grid, palette, width, height, prompt, count });
    const data = JSON.parse(text);
    return res.json(data);
  } catch (error: any) {
    console.error('API Generate Frame Sequence Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during animation sequence generation.',
      details: error.stack,
    });
  }
});

export default router;