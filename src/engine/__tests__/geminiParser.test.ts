import { DEFAULT_ACCOUNTS, SYSTEM_KEYS as K } from '../accounts';
import type { AiEntry } from '../parser/aiShared';
import { GEMINI_MODEL, GEMINI_RESPONSE_SCHEMA, GeminiParser, type GeminiClientLike } from '../parser/geminiParser';

const ctx = { accounts: DEFAULT_ACCOUNTS, today: '2026-11-12' };

function fake(reply: { status?: string; output_text?: string } | Error) {
  const calls: Record<string, unknown>[] = [];
  const client: GeminiClientLike = {
    interactions: {
      create: async (params) => {
        calls.push(params);
        if (reply instanceof Error) throw reply;
        return reply;
      },
    },
  };
  return { client, calls };
}

const good: AiEntry = {
  outcome: 'entry',
  reason: '',
  date: '2026-11-12',
  description: 'Sold the old truck',
  lines: [
    { accountNumber: 1000, side: 'debit', amount: '5000.00' },
    { accountNumber: 1600, side: 'credit', amount: '5000.00' },
  ],
  assumptions: 'Assumed it sold for its book value.',
};

describe('GeminiParser', () => {
  it('calls the Interactions API with JSON output, low thinking and store:false', async () => {
    const { client, calls } = fake({ status: 'completed', output_text: JSON.stringify(good) });
    await new GeminiParser({ apiKey: 'k', client }).parse('Sold the old truck for 5000', ctx);
    const req = calls[0] as Record<string, any>;
    expect(req.model).toBe(GEMINI_MODEL);
    expect(req.store).toBe(false);
    expect(req.generation_config).toEqual({ thinking_level: 'low' });
    expect(req.response_format).toEqual({ type: 'text', mime_type: 'application/json', schema: GEMINI_RESPONSE_SCHEMA });
    expect(req.system_instruction).toContain('double-entry');
    expect(req.input).toContain('1600 Vehicles (Asset)');
    expect(req.input).toContain('<transaction>\nSold the old truck for 5000\n</transaction>');
  });

  it('sends a plain JSON Schema (no $schema key) with required fields', () => {
    expect(GEMINI_RESPONSE_SCHEMA.$schema).toBeUndefined();
    expect(GEMINI_RESPONSE_SCHEMA.type).toBe('object');
    expect(GEMINI_RESPONSE_SCHEMA.required).toEqual(['outcome', 'reason', 'date', 'description', 'lines', 'assumptions']);
  });

  it('turns a valid reply into a checked entry', async () => {
    const { client } = fake({ status: 'completed', output_text: JSON.stringify(good) });
    const r = await new GeminiParser({ apiKey: 'k', client }).parse('x', ctx);
    expect(r).toMatchObject({
      status: 'matched',
      source: 'ai',
      notes: 'Assumed it sold for its book value.',
      lines: [
        { accountId: K.cash, debit: 500_000, credit: 0 },
        { accountId: K.vehicles, debit: 0, credit: 500_000 },
      ],
    });
  });

  it.each<[string, { status?: string; output_text?: string } | Error, RegExp]>([
    ['not JSON', { status: 'completed', output_text: 'Sure! Here is your entry…' }, /couldn't be read/],
    ['wrong shape', { status: 'completed', output_text: '{"hello":1}' }, /couldn't be read/],
    ['incomplete', { status: 'incomplete', output_text: '' }, /didn't finish/],
    ['unbalanced', { status: 'completed', output_text: JSON.stringify({ ...good, lines: [good.lines[0], { ...good.lines[1], amount: '4000' }] }) }, /Debits must equal credits/],
    ['bad key (400 API_KEY_INVALID)', Object.assign(new Error('400 API error occurred: {}'), { status: 400 }), /API key isn't valid/],
    ['bad key (401)', Object.assign(new Error('Unauthorized'), { status: 401 }), /Gemini API key was rejected/],
    ['quota', Object.assign(new Error('Resource exhausted'), { status: 429 }), /rate-limiting/],
  ])('rejects: %s', async (_n, reply, reason) => {
    const { client } = fake(reply);
    const r = await new GeminiParser({ apiKey: 'k', client }).parse('x', ctx);
    expect(r.status).toBe('unmatched');
    expect(r.status === 'unmatched' && r.reason).toMatch(reason);
  });
});
