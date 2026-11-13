/**
 * AI transaction parser backed by Anthropic's Claude.
 *
 * Runs entirely in the browser with the user's own Anthropic API key (there is no backend).
 * The model only *proposes* an entry; it is validated here and the user still confirms it.
 */
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AiEntrySchema, buildUserMessage, describeError, SYSTEM_PROMPT, toParseResult, type AiEntry } from './aiShared';
import { buildScanText, SCAN_PROMPT, ScanSchema } from '../scan';
import type { Account } from '../types';
import type { ParseContext, ParseResult, ScanImage, ScanOutcome, TransactionParser } from './types';

export type { AiEntry } from './aiShared';
export { toParseResult } from './aiShared';

export const CLAUDE_MODEL = 'claude-opus-5-5';

/** The slice of the Anthropic client this parser uses (lets tests pass a fake). */
export interface ClaudeClientLike {
  beta: {
    messages: {
      parse(params: Record<string, unknown>): Promise<{
        stop_reason: string | null;
        parsed_output?: AiEntry | null;
      }>;
    };
  };
}

export interface ClaudeParserOptions {
  apiKey: string;
  /** Injected in tests; by default the Anthropic SDK is loaded on first use. */
  client?: ClaudeClientLike;
}

export function buildRequest(text: string, ctx: ParseContext) {
  return {
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    // Routes a safety-classifier decline to another model instead of failing the request.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    // A short classification task: low effort keeps it quick and cheap.
    output_config: { effort: 'low' as const, format: betaZodOutputFormat(AiEntrySchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: buildUserMessage(text, ctx) }],
  };
}

async function defaultClient(apiKey: string): Promise<ClaudeClientLike> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // The key belongs to the person using this browser; it goes only to api.anthropic.com.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 }) as unknown as ClaudeClientLike;
}

export class ClaudeParser implements TransactionParser {
  readonly name = 'ai';
  private client?: ClaudeClientLike;
  constructor(private readonly opts: ClaudeParserOptions) {
    this.client = opts.client;
  }

  async parse(text: string, ctx: ParseContext): Promise<ParseResult> {
    if (!text.trim()) return { status: 'unmatched', source: 'ai', reason: 'Type a transaction to get started.' };
    try {
      this.client ??= await defaultClient(this.opts.apiKey);
      const res = await this.client.beta.messages.parse(buildRequest(text, ctx));
      if (res.stop_reason === 'refusal') return { status: 'unmatched', source: 'ai', reason: 'The AI declined to process this sentence.' };
      if (!res.parsed_output) return { status: 'unmatched', source: 'ai', reason: "The AI's reply couldn't be read. Try rephrasing." };
      return toParseResult(res.parsed_output, text, ctx);
    } catch (err) {
      return { status: 'unmatched', source: 'ai', reason: describeError(err, 'Anthropic') };
    }
  }
}

// ---------------------------------------------------------------- scanning a page

export function buildClaudeScanRequest(image: ScanImage, accounts: Account[], today: string) {
  return {
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    // Journalizing a whole page is real work: medium effort.
    output_config: { effort: 'medium' as const, format: betaZodOutputFormat(ScanSchema) },
    system: SCAN_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: image.mimeType, data: image.data } },
          { type: 'text' as const, text: buildScanText(accounts, today) },
        ],
      },
    ],
  };
}

/** Read a photo of an exercise/worksheet with Claude. */
export async function scanWithClaude(apiKey: string, image: ScanImage, accounts: Account[], today: string, client?: ClaudeClientLike): Promise<ScanOutcome> {
  try {
    const c = client ?? (await defaultClient(apiKey));
    const res = (await c.beta.messages.parse(buildClaudeScanRequest(image, accounts, today))) as { stop_reason: string | null; parsed_output?: unknown };
    if (res.stop_reason === 'refusal') return { ok: false, reason: 'The AI declined to read this page.' };
    if (res.stop_reason === 'max_tokens') return { ok: false, reason: 'The page has too much on it to read in one go. Try a photo of fewer transactions.' };
    const parsed = ScanSchema.safeParse(res.parsed_output);
    if (parsed.success) return { ok: true, scan: parsed.data };
    return { ok: false, reason: "The AI's answer couldn't be read. Try again, or use a clearer photo." };
  } catch (err) {
    return { ok: false, reason: describeError(err, 'Anthropic') };
  }
}
