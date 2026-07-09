/**
 * LLM Provider Abstraction
 *
 * Supports Gemini (via @google/genai) and DeepSeek (via OpenAI-compatible API).
 * Provider selected at runtime via LLM_PROVIDER env var.
 */

// ─── Types ───────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  model?: string;
}

export interface LLMProvider {
  readonly name: string;
  generateText(req: LLMRequest): Promise<string>;
}

// ─── Gemini Provider ─────────────────────────────

let geminiClient: any | null = null;

function getGeminiClient(): any {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing. Set it in .env or environment.');
    }
    // Dynamic import to avoid crash if @google/genai is not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenAI } = require('@google/genai');
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'pixel-factory' },
      },
    });
  }
  return geminiClient;
}

class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';

  async generateText(req: LLMRequest): Promise<string> {
    const client = getGeminiClient();
    const model = req.model || 'gemini-3.5-flash';

    // Combine messages into a single content string (Gemini SDK style)
    const userContent = req.messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    const response = await client.models.generateContent({
      model,
      contents: userContent,
      config: {
        systemInstruction: req.system,
        responseMimeType: 'application/json',
      },
    });

    if (!response.text) {
      throw new Error('Gemini returned an empty response.');
    }
    return response.text;
  }
}

// ─── DeepSeek Provider ───────────────────────────

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1/chat/completions';

class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek';

  async generateText(req: LLMRequest): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is missing. Set it in .env or environment.');
    }

    const model = req.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: req.system },
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch(DEEPSEEK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`DeepSeek API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('DeepSeek returned an empty response.');
    }
    return text;
  }
}

// ─── Factory ─────────────────────────────────────

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  switch (providerName) {
    case 'deepseek':
      cachedProvider = new DeepSeekProvider();
      break;
    case 'gemini':
    default:
      cachedProvider = new GeminiProvider();
      break;
  }

  console.log(`[llm] Using provider: ${cachedProvider.name}`);
  return cachedProvider;
}

/** Reset cached provider (useful for testing) */
export function resetProvider(): void {
  cachedProvider = null;
}