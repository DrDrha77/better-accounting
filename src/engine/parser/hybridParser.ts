import type { ParseContext, ParseResult, TransactionParser } from './types';

/**
 * - off:      rules only
 * - fallback: rules first (instant, free); ask the AI only when the rules can't tell
 * - always:   AI first; if the AI fails, use the rules' answer when they have one
 */
export type AiMode = 'off' | 'fallback' | 'always';

export class HybridParser implements TransactionParser {
  readonly name = 'hybrid';
  constructor(
    private readonly rules: TransactionParser,
    private readonly ai: TransactionParser | null,
    private readonly mode: AiMode,
  ) {}

  async parse(text: string, ctx: ParseContext): Promise<ParseResult> {
    if (!this.ai || this.mode === 'off') return this.rules.parse(text, ctx);

    if (this.mode === 'always') {
      const ai = await this.ai.parse(text, ctx);
      if (ai.status === 'matched') return ai;
      const rules = await this.rules.parse(text, ctx);
      return rules.status === 'matched' ? rules : ai;
    }

    const rules = await this.rules.parse(text, ctx);
    if (rules.status === 'matched') return rules;
    const ai = await this.ai.parse(text, ctx);
    return ai.status === 'matched' ? ai : { ...ai, candidates: rules.candidates };
  }
}
