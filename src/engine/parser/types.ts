import type { Account, Cents, ISODate, JournalLine } from '../types';

export interface ParseContext {
  accounts: Account[];
  /** Default date when the sentence doesn't mention one. */
  today: ISODate;
}

export interface ParsedEntry {
  status: 'matched';
  templateId: string;
  templateLabel: string;
  date: ISODate;
  description: string;
  amount: Cents;
  lines: JournalLine[];
}

export interface ParseFailure {
  status: 'unmatched';
  reason: string;
  /** Template labels that tied, when the sentence was ambiguous. */
  candidates?: string[];
}

export type ParseResult = ParsedEntry | ParseFailure;

/**
 * Any strategy that turns a sentence into a proposed journal entry.
 * Async so an LLM-backed parser can implement the same interface later.
 * Results are always proposals: the UI shows a confirm step before anything is saved.
 */
export interface TransactionParser {
  readonly name: string;
  parse(text: string, ctx: ParseContext): Promise<ParseResult>;
}
