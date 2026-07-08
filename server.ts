import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client to prevent crashing on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing. Please configure it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// AI Pixel Art generation route
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, width = 16, height = 16, style = 'Retro Game', background = 'transparent' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Please provide a descriptive prompt for the pixel art.' });
    }

    const size = width * height;
    const ai = getGeminiClient();

    const systemPrompt = `You are a legendary pixel artist specializing in retro game icons, items, and sprites.
You generate visual pixel art grids mapped row-by-row, from top-left to bottom-right of a ${width}x${height} canvas.
Your output must be a run-length encoded (RLE) sequence representing exactly ${size} pixels.`;

    const contents = `
Generate a pixel art masterpiece based on this prompt: "${prompt}"
Grid Size: ${width}x${height} (Total pixels: ${size})
Visual Theme/Style: "${style}"
Background Style: "${background}"

Rules:
1. Palette Selection:
   - Create a beautiful retro color palette of 3 to 12 colors.
   - The first color (index 0) MUST be the background color. Since background is "${background}", if background is 'transparent', palette[0] MUST be "transparent". If background is a color, palette[0] must be that exact hex color.
   - All other colors must be vibrant hexadecimal hex codes (e.g., "#ef4444", "#3b82f6", etc.).

2. Run-Length Encoding (RLE) Output:
   - The RLE represents the sequential grid of pixel indices.
   - Format: "count*index" separated by commas (e.g. "12*0,4*1,2*3,238*0").
   - The sum of all 'count' values MUST EXACTLY EQUAL ${size}. Please calculate the pixel grid row by row and double check your arithmetic!
   - Make the drawing centered, recognizable, and highly stylized. Use symmetry where relevant (e.g., characters, shields, swords).
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'A fitting retro name for this pixel art creation.'
            },
            palette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'The color palette. Index 0 is the background color ("transparent" or a hex color).'
            },
            rle: {
              type: Type.STRING,
              description: `Run-length encoded pixels. Comma-separated 'count*index' pairs that sum up to exactly ${size}.`
            },
            explanation: {
              type: Type.STRING,
              description: 'A short 1-2 sentence explanation of the design choices.'
            }
          },
          required: ['name', 'palette', 'rle', 'explanation']
        }
      }
    });

    if (!response.text) {
      throw new Error('Received an empty response from the Gemini model.');
    }

    const data = JSON.parse(response.text);
    return res.json(data);

  } catch (error: any) {
    console.error('API Generation Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during pixel art generation.',
      details: error.stack
    });
  }
});

// AI Next Animation Frame generation route
app.post('/api/generate-next-frame', async (req, res) => {
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

    const size = width * height;
    const ai = getGeminiClient();

    // Map grid colors to palette indices to create a compact and precise representation for Gemini
    const currentIndices = grid.map(color => {
      const idx = palette.indexOf(color);
      return idx >= 0 ? idx : 0;
    });

    // Structure the indices as a neat 2D grid/array for the model to clearly see column alignment
    const rowsOfIndices: number[][] = [];
    for (let i = 0; i < height; i++) {
      rowsOfIndices.push(currentIndices.slice(i * width, (i + 1) * width));
    }

    const systemPrompt = `You are a legendary retro game animator who specializes in creating seamless, frame-by-frame pixel art sprite animations.
Given the current frame's grid layout of size ${width}x${height} (represented as a 2D array of numerical color indices mapping to the provided palette) and an animation action, you will generate the NEXT sequential frame of the animation.
You MUST maintain extreme visual continuity and shape consistency. Keep outlines, shadows, and core structures intact unless they are directly morphing, and apply small, incremental pixel transformations (translation, rotation, scale shifts, or frame-specific motion streaks) to express the requested animation action beautifully.`;

    const contents = `
Current Animation Frame Configuration:
- Canvas Size: ${width}x${height}
- Color Palette: ${JSON.stringify(palette)}
- Current Frame Pixel Indices (Structured as a 2D array of rows, where each row has exactly ${width} elements):
  ${JSON.stringify(rowsOfIndices, null, 2)}

Target Animation Action/Change for Next Frame: "${prompt}"

Rules to follow:
1. Palette Selection & Continuity:
   - Use the existing color indices. Do NOT scramble or rearrange the meaning of the index numbers.
   - Index 0 MUST remain the background/transparent color.
   - If you absolutely must introduce a new color to portray the action (like a spark, glow, or sweat drop), append it to the end of the palette array. Otherwise, keep the palette identical.

2. Run-Length Encoding (RLE) Output:
   - Your generated next frame must be represented as an array of exactly ${height} strings, where each string represents the Run-Length Encoding (RLE) of a single row.
   - For each row, the format is a comma-separated list of "count*index" pairs (e.g., "4*0,8*1,4*0").
   - Crucial: The sum of 'count' values in EACH row's string MUST EXACTLY EQUAL ${width}. Count carefully for every single row!
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'A brief description of this new frame (e.g. Frame 2: Jumping up).'
            },
            palette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'The updated color palette (usually identical, but can append new colors if needed).'
            },
            rle: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: `An array of exactly ${height} strings. Each string represents the RLE representation ('count*index' pairs) for that specific row. The counts in each row MUST sum to exactly ${width}.`
            },
            explanation: {
              type: Type.STRING,
              description: 'A 1-sentence technical note of how you transformed the previous pixels to express the action.'
            }
          },
          required: ['name', 'palette', 'rle', 'explanation']
        }
      }
    });

    if (!response.text) {
      throw new Error('Received an empty response from the Gemini model.');
    }

    const data = JSON.parse(response.text);
    return res.json(data);

  } catch (error: any) {
    console.error('API Generate Next Frame Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during next animation frame generation.',
      details: error.stack
    });
  }
});

// AI Multi-Frame Animation Sequence generation route
app.post('/api/generate-frame-sequence', async (req, res) => {
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

    const numFrames = Math.min(Math.max(parseInt(count) || 5, 2), 8);
    const size = width * height;
    const ai = getGeminiClient();

    // Map starting grid colors to palette indices
    const startIndices = grid.map(color => {
      const idx = palette.indexOf(color);
      return idx >= 0 ? idx : 0;
    });

    // Structure the indices as a neat 2D grid/array for the model to clearly see column alignment
    const rowsOfIndices: number[][] = [];
    for (let i = 0; i < height; i++) {
      rowsOfIndices.push(startIndices.slice(i * width, (i + 1) * width));
    }

    const systemPrompt = `You are an elite retro game animator who designs extremely fluid, seamless multi-frame pixel art sprite animation sequences.
Given a starting frame of size ${width}x${height} (represented as a 2D array of color indices mapping to the provided palette), and a sequence action prompt, you will generate a series of ${numFrames} sequential frames that form a complete, fluid, beautifully paced animation.
Each successive frame MUST evolve incrementally from the previous one. Ensure absolute shape continuity, outline consistency, and shadow matching. Avoid sudden jumps or visual noise. Make the motion feel natural (squash and stretch, acceleration, or trailing motion/wind/sparks).`;

    const contents = `
Animation Sequence Configuration:
- Canvas Size: ${width}x${height}
- Color Palette: ${JSON.stringify(palette)}
- Starting Frame Pixel Indices (Structured as a 2D array of rows, where each row has exactly ${width} elements):
  ${JSON.stringify(rowsOfIndices, null, 2)}

Target Animation Action/Sequence to generate: "${prompt}"
Number of animation frames to generate: ${numFrames}

Instructions to follow:
1. Frame Progression:
   - Frame 1 is the next step immediately following the starting frame.
   - Frame 2 is the next step after Frame 1.
   - Frame 3 is the next step after Frame 2, and so on up to Frame ${numFrames}.
   - The final frame (${numFrames}) should complete or loop back gracefully towards the starting frame if appropriate, or finish the action beautifully.

2. Palette & Continuity:
   - Use the existing color indices. Index 0 MUST remain the background/transparent color.
   - If you absolutely must introduce a new color to portray the action (like a spark, fire particle, or sweat drop), append it to the end of the palette array. Otherwise, keep the palette identical.

3. Run-Length Encoding (RLE) Output:
   - For every generated frame, the pixels must be represented as an array of exactly ${height} strings, where each string is the Run-Length Encoding (RLE) of a single row.
   - For each row, the format is a comma-separated list of "count*index" pairs (e.g., "4*0,8*1,4*0").
   - Crucial: The sum of 'count' values in EACH row's string MUST EXACTLY EQUAL ${width}. Count carefully for every single row in every frame!
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            palette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'The updated color palette (usually identical, but can append new colors if needed).'
            },
            frames: {
              type: Type.ARRAY,
              description: `A sequence of exactly ${numFrames} progressive animation frames.`,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: 'A brief description of this frame action (e.g. Frame 2: Squash and crouching).'
                  },
                  rle: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: `An array of exactly ${height} strings. Each string represents the RLE representation ('count*index' pairs) for that specific row of the frame grid. The counts in each row MUST sum to exactly ${width}.`
                  },
                  explanation: {
                    type: Type.STRING,
                    description: '1-sentence note of the specific physical movement or pixel transition made.'
                  }
                },
                required: ['name', 'rle', 'explanation']
              }
            }
          },
          required: ['palette', 'frames']
        }
      }
    });

    if (!response.text) {
      throw new Error('Received an empty response from the Gemini model.');
    }

    const data = JSON.parse(response.text);
    return res.json(data);

  } catch (error: any) {
    console.error('API Generate Frame Sequence Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during animation sequence generation.',
      details: error.stack
    });
  }
});

// Setup development or production build static file serving
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
