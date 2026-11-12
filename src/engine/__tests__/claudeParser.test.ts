import { DEFAULT_ACCOUNTS, SYSTEM_KEYS as K } from '../accounts';
import { ClaudeParser, CLAUDE_MODEL, type AiEntry, type ClaudeClientLike } from '../parser/claudeParser';
import { HybridParser } from '../parser/hybridParser';
import { RuleBasedParser } from '../parser/ruleParser';
import type { ParseResult, TransactionParser } from '../parser/types';

const ctx = { accounts: DEFAULT_ACCOUNTS, today: '2026-11-12' };

function fakeClient(reply: Partial<{ stop_reason: string; parsed_output: AiEntry | null }> | Error) {
  const calls: Record<string, unknown>[] = [];
  const client: ClaudeClientLike = {
    beta: {
      messages: {
        parse: async (params) => {
          calls.push(params);
          if (reply instanceof Error) throw reply;
          return { stop_reason: 'end_turn', parsed_output: null, ...reply };
        },
      },
    },
  };
  return { client, calls };
}

const entry = (over: Partial<AiEntry> = {}): AiEntry => ({
  outcome: 'entry',
  reason: '',
  date: '2026-11-10',
  description: 'Bought a delivery van, half cash half loan',
  lines: [
    { accountNumber: 1600, side: 'debit', amount: '30000.00' },
    { accountNumber: 1000, side: 'credit', amount: '15000.00' },
    { accountNumber: 2100, side: 'credit', amount: '15000.00' },
  ],
  assumptions: '',
  ...over,
});

describe('ClaudeParser', () => {
  it('sends the sentence, chart of accounts and date to Claude with structured output', async () => {
    const { client, calls } = fakeClient({ parsed_output: entry() });
    await new ClaudeParser({ apiKey: 'test', client }).parse('Bought a van for 30k, half cash half loan', ctx);
    const req = calls[0] as { model: string; fallbacks: string; output_config: { effort: string; format: unknown }; messages: { content: string }[] };
    expect(req.model).toBe(CLAUDE_MODEL);
    expect(req.fallbacks).toBe('default');
    expect(req.output_config.effort).toBe('low');
    expect(req.output_config.format).toBeTruthy();
    expect(req.messages[0].content).toContain("Today's date: 2026-11-12");
    expect(req.messages[0].content).toContain('1600 Vehicles (Asset)');
    expect(req.messages[0].content).toContain("3100 Owner's Drawings (Equity, contra)");
    expect(req.messages[0].content).toContain('<transaction>\nBought a van for 30k, half cash half loan\n</transaction>');
  });

  it('maps a valid multi-line entry onto real accounts in cents', async () => {
    const { client } = fakeClient({ parsed_output: entry({ assumptions: 'Assumed the loan is from a bank.' }) });
    const r = await new ClaudeParser({ apiKey: 'test', client }).parse('x', ctx);
    expect(r).toMatchObject({
      status: 'matched',
      source: 'ai',
      date: '2026-11-10',
      amount: 3_000_000,
      notes: 'Assumed the loan is from a bank.',
      lines: [
        { accountId: K.vehicles, debit: 3_000_000, credit: 0 },
        { accountId: K.cash, debit: 0, credit: 1_500_000 },
        { accountId: K.notesPayable, debit: 0, credit: 1_500_000 },
      ],
    });
  });

  it.each<[string, Partial<{ stop_reason: string; parsed_output: AiEntry | null }> | Error, RegExp]>([
    ['unclear', { parsed_output: entry({ outcome: 'unclear', reason: 'Add a Land asset account first.', lines: [] }) }, /Land asset/],
    ['unknown account', { parsed_output: entry({ lines: [{ accountNumber: 1999, side: 'debit', amount: '5' }, { accountNumber: 1000, side: 'credit', amount: '5' }] }) }, /1999/],
    ['unbalanced', { parsed_output: entry({ lines: [{ accountNumber: 1600, side: 'debit', amount: '10' }, { accountNumber: 1000, side: 'credit', amount: '9' }] }) }, /Debits must equal credits/],
    ['bad amount', { parsed_output: entry({ lines: [{ accountNumber: 1600, side: 'debit', amount: 'lots' }, { accountNumber: 1000, side: 'credit', amount: '9' }] }) }, /lots/],
    ['refusal', { stop_reason: 'refusal' }, /declined/],
    ['unreadable', { parsed_output: null }, /couldn't be read/],
    ['bad key', Object.assign(new Error('401'), { status: 401 }), /API key was rejected/],
    ['rate limit', Object.assign(new Error('429'), { status: 429 }), /rate-limited/],
    ['offline', new TypeError('Failed to fetch'), /internet connection/],
  ])('never saves a bad proposal: %s', async (_name, reply, reason) => {
    const { client } = fakeClient(reply);
    const r = await new ClaudeParser({ apiKey: 'test', client }).parse('x', ctx);
    expect(r.status).toBe('unmatched');
    expect(r.status === 'unmatched' && r.reason).toMatch(reason);
  });

  it('falls back to today when the model returns an invalid date', async () => {
    const { client } = fakeClient({ parsed_output: entry({ date: 'last tuesday' }) });
    const r = await new ClaudeParser({ apiKey: 'test', client }).parse('x', ctx);
    expect(r.status === 'matched' && r.date).toBe('2026-11-12');
  });
});

describe('HybridParser', () => {
  const stub = (result: ParseResult) => {
    const p = { name: 'stub', calls: 0, parse: async () => (p.calls++, result) };
    return p as TransactionParser & { calls: number };
  };
  const aiOk: ParseResult = { status: 'matched', source: 'ai', templateId: 'ai', templateLabel: 'AI', date: '2026-11-12', description: 'x', amount: 1, lines: [] };
  const aiFail: ParseResult = { status: 'unmatched', source: 'ai', reason: 'AI says no' };

  it('fallback mode: rules answer first and the AI is not called', async () => {
    const ai = stub(aiOk);
    const r = await new HybridParser(new RuleBasedParser(), ai, 'fallback').parse('Paid rent 1200', ctx);
    expect(r.status === 'matched' && r.source).toBe('rules');
    expect(ai.calls).toBe(0);
  });

  it('fallback mode: asks the AI when the rules cannot tell', async () => {
    const ai = stub(aiOk);
    const r = await new HybridParser(new RuleBasedParser(), ai, 'fallback').parse('Sold the old truck for 5000', ctx);
    expect(r.status === 'matched' && r.source).toBe('ai');
    expect(ai.calls).toBe(1);
  });

  it('always mode: uses the AI, but the rules rescue an AI failure', async () => {
    const r1 = await new HybridParser(new RuleBasedParser(), stub(aiOk), 'always').parse('Paid rent 1200', ctx);
    expect(r1.status === 'matched' && r1.source).toBe('ai');
    const r2 = await new HybridParser(new RuleBasedParser(), stub(aiFail), 'always').parse('Paid rent 1200', ctx);
    expect(r2.status === 'matched' && r2.source).toBe('rules');
  });

  it('off mode or no key: rules only', async () => {
    const ai = stub(aiOk);
    const r = await new HybridParser(new RuleBasedParser(), ai, 'off').parse('Sold the old truck for 5000', ctx);
    expect(r.status).toBe('unmatched');
    expect(ai.calls).toBe(0);
    expect((await new HybridParser(new RuleBasedParser(), null, 'always').parse('Paid rent 1200', ctx)).status).toBe('matched');
  });
});
