import type { Account, Cents, ISODate, JournalLine } from '../types';

export interface ParseContext {
  accounts: Account[];
  /** Default date when the sentence doesn't mention one. */
  today: ISODate;
}

export type ParserSource = 'rules' | 'ai';

export interface ParsedEntry {
  status: 'matched';
  source: ParserSource;
  templateId: string;
  templateLabel: string;
  date: ISODate;
  description: string;
  /** Total of the debit lines. */
  amount: Cents;
  lines: JournalLine[];
  /** Assumptions the parser made that the user should check (AI only). */
  notes?: string;
}

export interface ParseFailure {
  status: 'unmatched';
  source?: ParserSource;
  reason: string;
  /** Template labels that tied, when the sentence was ambiguous. */
  candidates?: string[];
}

export type ParseResult = ParsedEntry | ParseFailure;

/**
 * Any strategy that turns a sentence into a proposed journal entry.
 * Async so an LLM-backed parser can implement the same interface.
 * Results are always proposals: the UI shows a confirm step before anything is saved.
 */
export interface TransactionParser {
  readonly name: string;
  parse(text: string, ctx: ParseContext): Promise<ParseResult>;
}
