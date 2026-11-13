/**
 * AI transaction parser backed by Google Gemini (Interactions API, @google/genai).
 *
 * Runs in the browser with the user's own Gemini API key. Same prompt, schema and validation
 * as the Claude parser (see aiShared.ts); the model only proposes, the user confirms.
 */
import { z } from 'zod';
import { AiEntrySchema, buildUserMessage, describeError, parseAiJson, providerErrorDetail, SYSTEM_PROMPT, toParseResult } from './aiShared';
import { buildScanText, SCAN_PROMPT, ScanSchema } from '../scan';
import type { Account } from '../types';
import type { ParseContext, ParseResult, ScanImage, ScanOutcome, TransactionParser } from './types';

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

async function defaultClient(apiKey: string, apiVersion?: string): Promise<GeminiClientLike> {
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey, ...(apiVersion ? { apiVersion } : {}) }) as unknown as GeminiClientLike;
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
      return { status: 'unmatched', source: 'ai', reason: geminiFailure(err) };
    }
  }
}

// ---------------------------------------------------------------- scanning a page

/** Why a Gemini call failed, in plain words. */
function geminiFailure(err: unknown): string {
  // An invalid key comes back as 400 API_KEY_INVALID; without any detail, a 400 is almost always the key.
  if ((err as { status?: number })?.status === 400 && !providerErrorDetail(err))
    return "Gemini rejected the request. Usually this means the API key isn't valid or isn't enabled for the Gemini API — check it in Settings.";
  return describeError(err, 'Gemini');
}

/**
 * Image input on the Interactions API is only available in v1beta (v1 answers 400 "The value
 * 'image' is not supported for 'input[1].type' in v1"), so page scans use v1beta.
 */
export const GEMINI_SCAN_API_VERSION = 'v1beta';

export const GEMINI_SCAN_SCHEMA: Record<string, unknown> = (() => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(ScanSchema) as Record<string, unknown>;
  return schema;
})();

export function buildGeminiScanRequest(image: ScanImage, accounts: Account[], today: string) {
  return {
    model: GEMINI_MODEL,
    system_instruction: SCAN_PROMPT,
    input: [
      { type: 'text', text: buildScanText(accounts, today) },
      { type: 'image', data: image.data, mime_type: image.mimeType },
    ],
    response_format: { type: 'text', mime_type: 'application/json', schema: GEMINI_SCAN_SCHEMA },
    // Journalizing a whole page is real work: give it more thinking and room for a long answer.
    generation_config: { thinking_level: 'medium', max_output_tokens: 32000 },
    store: false,
  };
}

/** Read a photo of an exercise/worksheet with Gemini. */
export async function scanWithGemini(apiKey: string, image: ScanImage, accounts: Account[], today: string, client?: GeminiClientLike): Promise<ScanOutcome> {
  try {
    const c = client ?? (await defaultClient(apiKey, GEMINI_SCAN_API_VERSION));
    const res = await c.interactions.create(buildGeminiScanRequest(image, accounts, today));
    if (res.status && res.status !== 'completed') return { ok: false, reason: `Gemini didn't finish reading the page (status: ${res.status}). Try again.` };
    try {
      const parsed = ScanSchema.safeParse(JSON.parse(res.output_text ?? ''));
      if (parsed.success) return { ok: true, scan: parsed.data };
    } catch {
      // fall through
    }
    return { ok: false, reason: "The AI's answer couldn't be read. Try again, or use a clearer photo." };
  } catch (err) {
    return { ok: false, reason: geminiFailure(err) };
  }
}
