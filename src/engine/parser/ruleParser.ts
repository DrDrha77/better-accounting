import { findBySystemKey } from '../accounts';
import { creditLine, debitLine, isValidISODate } from '../journal';
import { parseAmount } from '../money';
import type { Cents, ISODate } from '../types';
import { TEMPLATES, type TransactionTemplate } from './templates';
import type { ParseContext, ParseResult, TransactionParser } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Find an explicit date in the sentence. Returns the date and the text with the date removed. */
export function extractDate(text: string, today: ISODate): { date: ISODate | null; rest: string; invalid?: boolean } {
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const d = `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
    return { date: isValidISODate(d) ? d : null, invalid: !isValidISODate(d), rest: text.replace(iso[0], ' ') };
  }
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (us) {
    let year = us[3] ? +us[3] : +today.slice(0, 4);
    if (us[3] && us[3].length === 2) year += 2000;
    const d = `${year}-${pad(+us[1])}-${pad(+us[2])}`;
    return { date: isValidISODate(d) ? d : null, invalid: !isValidISODate(d), rest: text.replace(us[0], ' ') };
  }
  if (/\byesterday\b/i.test(text)) {
    const t = new Date(today + 'T00:00:00Z');
    t.setUTCDate(t.getUTCDate() - 1);
    return { date: t.toISOString().slice(0, 10), rest: text.replace(/\byesterday\b/i, ' ') };
  }
  if (/\btoday\b/i.test(text)) return { date: today, rest: text.replace(/\btoday\b/i, ' ') };
  return { date: null, rest: text };
}

const AMOUNT_RE = /\$?\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?:\s?(?:k|thousand|m|million)\b)?/gi;

/** All distinct amounts mentioned in the text, in cents. */
export function extractAmounts(text: string): Cents[] {
  const found = new Set<Cents>();
  for (const m of text.matchAll(AMOUNT_RE)) {
    const cents = parseAmount(m[0].replace(/\s+/g, ' ').replace(/^\$ /, '$').replace(/ (k|thousand|m|million)$/i, '$1'));
    if (cents !== null && cents > 0) found.add(cents);
  }
  return [...found];
}

export function scoreTemplate(t: TransactionTemplate, lower: string): number {
  if (t.exclude?.some((r) => r.test(lower))) return 0;
  if (!t.match.every((r) => r.test(lower))) return 0;
  return t.match.length + (t.boost?.filter((r) => r.test(lower)).length ?? 0);
}

function cleanDescription(text: string): string {
  const s = text.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Synchronous core of the rule-based parser (used directly by sample data and tests). */
export function parseWithRules(text: string, ctx: ParseContext, templates: TransactionTemplate[] = TEMPLATES): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { status: 'unmatched', reason: 'Type a transaction to get started.' };

  const { date, rest, invalid } = extractDate(trimmed, ctx.today);
  if (invalid) return { status: 'unmatched', reason: "The date in the sentence isn't a valid date." };

  const amounts = extractAmounts(rest);
  if (amounts.length === 0) return { status: 'unmatched', reason: "Couldn't find an amount in the sentence." };
  if (amounts.length > 1)
    return { status: 'unmatched', reason: 'The sentence mentions more than one amount, so the split is unclear. Enter it manually.' };
  const amount = amounts[0];

  const lower = rest.toLowerCase();
  const scored = templates.map((t) => ({ t, score: scoreTemplate(t, lower) })).filter((x) => x.score > 0);
  if (scored.length === 0) return { status: 'unmatched', reason: "Didn't recognise this kind of transaction." };
  const best = Math.max(...scored.map((x) => x.score));
  const top = scored.filter((x) => x.score === best);
  if (top.length > 1)
    return {
      status: 'unmatched',
      reason: 'The sentence could mean more than one kind of transaction.',
      candidates: top.map((x) => x.t.label),
    };

  const template = top[0].t;
  const dr = findBySystemKey(ctx.accounts, template.debit);
  const cr = findBySystemKey(ctx.accounts, template.credit);
  if (!dr || !cr)
    return { status: 'unmatched', reason: `Matched "${template.label}" but a required account is missing from the chart of accounts.` };

  return {
    status: 'matched',
    templateId: template.id,
    templateLabel: template.label,
    date: date ?? ctx.today,
    description: cleanDescription(trimmed),
    amount,
    lines: [debitLine(dr.id, amount), creditLine(cr.id, amount)],
  };
}

export class RuleBasedParser implements TransactionParser {
  readonly name = 'rules';
  constructor(private readonly templates: TransactionTemplate[] = TEMPLATES) {}
  async parse(text: string, ctx: ParseContext): Promise<ParseResult> {
    return parseWithRules(text, ctx, this.templates);
  }
}
