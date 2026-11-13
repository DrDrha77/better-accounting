import { findBySystemKey, SYSTEM_KEYS as K } from '../accounts';
import { emptyBooks } from '../books';
import { ledgerFor } from '../ledger';
import { buildClaudeScanRequest, scanWithClaude, type ClaudeClientLike } from '../parser/claudeParser';
import { buildGeminiScanRequest, GEMINI_SCAN_API_VERSION, GEMINI_SCAN_SCHEMA, scanWithGemini, type GeminiClientLike } from '../parser/geminiParser';
import { incomeStatement, openingStatement, trialBalance } from '../reports';
import { applyScan, planScan, type ScanResult } from '../scan';

type L = [string, 'debit' | 'credit', string];
const t = (date: string, description: string, ...lines: L[]) => ({
  date,
  description,
  lines: lines.map(([account, side, amount]) => ({ account, side, amount })),
});

/** What a correct bookkeeper would produce for the Ridgeview Motel exercise (Exercises Part A, #10). */
const RIDGEVIEW: ScanResult = {
  companyName: 'Ridgeview Motel',
  newAccounts: [
    { name: 'Office Equipment', type: 'asset', contra: false },
    { name: 'Building', type: 'asset', contra: false },
    { name: 'Furniture', type: 'asset', contra: false },
    { name: 'Automobile', type: 'asset', contra: false },
    { name: 'Bank Loan', type: 'liability', contra: false },
    { name: 'Mortgage Payable', type: 'liability', contra: false },
    { name: 'Kelly Motors', type: 'liability', contra: false },
    { name: 'Room Rentals', type: 'revenue', contra: false },
    { name: 'General Expense', type: 'expense', contra: false },
    { name: 'Salaries Expense', type: 'expense', contra: false },
    { name: 'Telephone Expense', type: 'expense', contra: false },
    { name: 'Automobile Expense', type: 'expense', contra: false },
    // Already in the chart: should be ignored, not duplicated.
    { name: 'Advertising Expense', type: 'expense', contra: false },
  ],
  opening: {
    present: true,
    date: '2026-11-30',
    balances: [
      { account: 'Cash', amount: '3000.00' },
      { account: 'Supplies', amount: '2000.00' },
      { account: 'Office Equipment', amount: '2000.00' },
      { account: 'Building', amount: '150000.00' },
      { account: 'Furniture', amount: '20000.00' },
      { account: 'Automobile', amount: '6000.00' },
      { account: 'Accounts Payable', amount: '3000.00' },
      { account: 'Bank Loan', amount: '25000.00' },
      { account: 'Mortgage Payable', amount: '60000.00' },
      { account: "Owner's Capital", amount: '95000.00' },
    ],
  },
  transactions: [
    t('2026-12-01', 'Automobile repairs, Cheque 125', ['Automobile Expense', 'debit', '50'], ['Cash', 'credit', '50']),
    t('2026-12-02', 'B. Fenato withdrew cash, Cheque 126', ["Owner's Drawings", 'debit', '150'], ['Cash', 'credit', '150']),
    t('2026-12-03', 'Paid Acme Supply on account, Cheque 127', ['Accounts Payable', 'debit', '1000'], ['Cash', 'credit', '1000']),
    t('2026-12-04', 'Telephone bill, Bell Canada, Cheque 128', ['Telephone Expense', 'debit', '175'], ['Cash', 'credit', '175']),
    t('2026-12-05', 'Room rentals, Sales Slips 246-269', ['Cash', 'debit', '900'], ['Room Rentals', 'credit', '900']),
    t('2026-12-08', 'Cleaning supplies from Acme Supply, Invoice 742', ['Supplies', 'debit', '120'], ['Accounts Payable', 'credit', '120']),
    t('2026-12-10', 'Repairs to owner’s personal car, Cheque 129', ["Owner's Drawings", 'debit', '125'], ['Cash', 'credit', '125']),
    t('2026-12-11', 'Electronic printing calculator, Cheque 130', ['Office Equipment', 'debit', '200'], ['Cash', 'credit', '200']),
    t('2026-12-12', 'Room rentals, Sales Slips 270-289', ['Cash', 'debit', '1100'], ['Room Rentals', 'credit', '1100']),
    t('2026-12-12', 'Postage stamps, Cheque 131', ['General Expense', 'debit', '12'], ['Cash', 'credit', '12']),
    t('2026-12-12', 'Hydro and water bills, Cheques 132-133', ['Utilities Expense', 'debit', '465'], ['Cash', 'credit', '465']),
    t('2026-12-15', 'Advertising brochure, Ace Printing, Cheque 134', ['Advertising Expense', 'debit', '75'], ['Cash', 'credit', '75']),
    t('2026-12-15', 'Advertisement in The Bugle, Cheque 135', ['Advertising Expense', 'debit', '45'], ['Cash', 'credit', '45']),
    t('2026-12-16', 'B. Fenato withdrew cash, Cheque 136', ["Owner's Drawings", 'debit', '250'], ['Cash', 'credit', '250']),
    t('2026-12-16', 'Salaries, first half of month, Cheque 137', ['Salaries Expense', 'debit', '750'], ['Cash', 'credit', '750']),
    t('2026-12-18', 'Bank loan interest, bank memo', ['Interest Expense', 'debit', '350'], ['Cash', 'credit', '350']),
    t('2026-12-19', 'Room rentals, Sales Slips 290-317', ['Cash', 'debit', '1750'], ['Room Rentals', 'credit', '1750']),
    t('2026-12-22', 'Linen and towels from Acme Supply, Invoice 3264', ['Supplies', 'debit', '225'], ['Accounts Payable', 'credit', '225']),
    t('2026-12-23', 'Gas and oil, Kelly Motors, Invoice 684', ['Automobile Expense', 'debit', '85'], ['Kelly Motors', 'credit', '85']),
    t('2026-12-25', 'Paid Acme Supply on account, Cheque 138', ['Accounts Payable', 'debit', '350'], ['Cash', 'credit', '350']),
    t('2026-12-26', 'Room rentals, Sales Slips 318-340', ['Cash', 'debit', '1525'], ['Room Rentals', 'credit', '1525']),
    t('2026-12-31', 'Salaries, rest of month, Cheque 139', ['Salaries Expense', 'debit', '1365'], ['Cash', 'credit', '1365']),
  ],
  notes: '',
};

describe('scan a page: plan and post', () => {
  const start = emptyBooks();
  const plan = planScan(RIDGEVIEW, start.accounts, '2026-12-31');

  it('plans new accounts once, reusing ones already in the chart', () => {
    expect(plan.companyName).toBe('Ridgeview Motel');
    expect(plan.newAccounts.map((a) => a.name)).toContain('Kelly Motors');
    expect(plan.newAccounts.map((a) => a.name)).not.toContain('Advertising Expense');
    expect(plan.entries.every((e) => e.problems.length === 0)).toBe(true);
    expect(plan.opening?.problems).toEqual([]);
  });

  it('posts the whole exercise: balanced books, right cash and net income', () => {
    const r = applyScan(start, plan, { startFresh: false });
    expect(r.skipped).toEqual([]);
    expect(r.openingPosted).toBe(true);
    expect(r.entriesPosted).toBe(22);
    expect(r.accountsAdded).toBe(12);

    const b = r.books;
    expect(trialBalance(b.accounts, b.entries).balanced).toBe(true);
    const os = openingStatement(b.accounts, b.entries)!;
    expect(os.totalAssets).toBe(18_300_000);
    expect(os.totalLiabilities).toBe(8_800_000);
    expect(os.balanced).toBe(true);
    expect(ledgerFor(findBySystemKey(b.accounts, K.cash)!, b.entries).balance).toBe(291_300);
    expect(incomeStatement(b.accounts, b.entries, '2026-12-01', '2026-12-31').netIncome).toBe(190_300);
    expect(ledgerFor(findBySystemKey(b.accounts, K.ownersDrawings)!, b.entries).balance).toBe(52_500);
  });

  it('flags entries it cannot post instead of guessing', () => {
    const bad: ScanResult = {
      ...RIDGEVIEW,
      transactions: [
        t('2026-12-01', 'Mystery account', ['Spaceship', 'debit', '10'], ['Cash', 'credit', '10']),
        t('2026-12-02', 'Unbalanced', ['Cash', 'debit', '10'], ['Room Rentals', 'credit', '9']),
        t('Dec 3', 'Bad date', ['Cash', 'debit', '10'], ['Room Rentals', 'credit', '10']),
      ],
    };
    const p = planScan(bad, start.accounts, '2026-12-31');
    expect(p.entries.map((e) => e.problems[0])).toEqual(['Unknown account “Spaceship”.', 'Debits don’t equal credits.', 'Unreadable date “Dec 3”.']);
    const r = applyScan(start, p, { startFresh: false });
    expect(r.entriesPosted).toBe(0);
    expect(r.skipped).toHaveLength(3);
  });

  it('can start fresh, clearing existing entries and opening balances', () => {
    const first = applyScan(start, plan, { startFresh: false }).books;
    const again = applyScan(first, plan, { startFresh: true });
    expect(again.books.entries.filter((e) => e.kind !== 'opening')).toHaveLength(22);
    expect(again.books.entries.filter((e) => e.kind === 'opening')).toHaveLength(1);
  });
});

describe('scan a page: provider requests', () => {
  const image = { data: 'BASE64DATA', mimeType: 'image/jpeg' };
  const accounts = emptyBooks().accounts;

  it('sends the photo and chart to Gemini with the scan schema', async () => {
    const req = buildGeminiScanRequest(image, accounts, '2026-11-13') as Record<string, any>;
    expect(req.input[1]).toEqual({ type: 'image', data: 'BASE64DATA', mime_type: 'image/jpeg' });
    expect(req.input[0].text).toContain('Current year: 2026');
    expect(req.input[0].text).toContain("Owner's Drawings (Equity, contra)");
    expect(req.response_format.schema).toBe(GEMINI_SCAN_SCHEMA);
    expect(req.store).toBe(false);
    // Google only accepts image input on the v1beta Interactions API.
    expect(GEMINI_SCAN_API_VERSION).toBe('v1beta');

    const client: GeminiClientLike = { interactions: { create: async () => ({ status: 'completed', output_text: JSON.stringify(RIDGEVIEW) }) } };
    const out = await scanWithGemini('k', image, accounts, '2026-11-13', client);
    expect(out.ok && out.scan.transactions).toHaveLength(22);
  });

  it('sends the photo to Claude as a base64 image block', async () => {
    const req = buildClaudeScanRequest(image, accounts, '2026-11-13');
    expect(req.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'BASE64DATA' } });
    const client: ClaudeClientLike = { beta: { messages: { parse: async () => ({ stop_reason: 'end_turn', parsed_output: RIDGEVIEW as never }) } } };
    const out = await scanWithClaude('k', image, accounts, '2026-11-13', client);
    expect(out.ok && out.scan.companyName).toBe('Ridgeview Motel');
    const tooLong: ClaudeClientLike = { beta: { messages: { parse: async () => ({ stop_reason: 'max_tokens', parsed_output: null }) } } };
    expect(await scanWithClaude('k', image, accounts, '2026-11-13', tooLong)).toMatchObject({ ok: false });
  });
});
