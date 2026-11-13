/**
 * AI transaction parser backed by Google Gemini (Interactions API, @google/genai).
 *
 * Runs in the browser with the user's own Gemini API key. Same prompt, schema and validation
 * as the Claude parser (see aiShared.ts); the model only proposes, the user confirms.
 */
import { z } from 'zod';
import { AiEntrySchema, buildUserMessage, describeError, parseAiJson, providerErrorDetail, SYSTEM_PROMPT, toParseResult } from './aiShared';
import type { ParseContext, ParseResult, TransactionParser } from './types';

/** Gemini's current general-purpose model; has a free tier in Google AI Studio. */
export const GEMINI_MODEL = 'gemini-3.8-flash';

/** The slice of the GoogleGenAI client this parser uses (lets tests pass a fake). */
export interface GeminiClientLike {
  interactions: {
    create(params: Record<string, unknown>): Promise<{ status?: string; output_text?: string }>;
  };
}

export interface GeminiParserOptions {
  apiKey: string;
  client?: GeminiClientLike;
}

/** JSON Schema for the response, generated from the shared Zod schema. */
export const GEMINI_RESPONSE_SCHEMA: Record<string, unknown> = (() => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(AiEntrySchema) as Record<string, unknown>;
  return schema;
})();

export function buildGeminiRequest(text: string, ctx: ParseContext) {
  return {
    model: GEMINI_MODEL,
    system_instruction: SYSTEM_PROMPT,
    input: buildUserMessage(text, ctx),
    response_format: { type: 'text', mime_type: 'application/json', schema: GEMINI_RESPONSE_SCHEMA },
    // A short classification task: low thinking keeps it quick.
    generation_config: { thinking_level: 'low' },
    // Don't keep the sentence or chart of accounts on Google's side after answering.
    store: false,
  };
}

async function defaultClient(apiKey: string): Promise<GeminiClientLike> {
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey }) as unknown as GeminiClientLike;
}

export class GeminiParser implements TransactionParser {
  readonly name = 'ai';
  private client?: GeminiClientLike;
  constructor(private readonly opts: GeminiParserOptions) {
    this.client = opts.client;
  }

  async parse(text: string, ctx: ParseContext): Promise<ParseResult> {
    if (!text.trim()) return { status: 'unmatched', source: 'ai', reason: 'Type a transaction to get started.' };
    try {
      this.client ??= await defaultClient(this.opts.apiKey);
      const res = await this.client.interactions.create(buildGeminiRequest(text, ctx));
      if (res.status && res.status !== 'completed')
        return { status: 'unmatched', source: 'ai', reason: `Gemini didn't finish its answer (status: ${res.status}). Try again.` };
      const out = parseAiJson(res.output_text);
      if (!out) return { status: 'unmatched', source: 'ai', reason: "The AI's reply couldn't be read. Try rephrasing." };
      return toParseResult(out, text, ctx);
    } catch (err) {
      // An invalid key comes back as 400 API_KEY_INVALID; without any detail, a 400 is almost always the key.
      if ((err as { status?: number })?.status === 400 && !providerErrorDetail(err))
        return {
          status: 'unmatched',
          source: 'ai',
          reason: "Gemini rejected the request. Usually this means the API key isn't valid or isn't enabled for the Gemini API — check it in Settings.",
        };
      return { status: 'unmatched', source: 'ai', reason: describeError(err, 'Gemini') };
    }
  }
}
