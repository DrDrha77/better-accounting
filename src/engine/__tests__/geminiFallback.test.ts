import { DEFAULT_ACCOUNTS } from '../accounts';
import { GEMINI_MODELS, GeminiParser, scanWithGemini, withModelFallback, type GeminiClientLike } from '../parser/geminiParser';
import type { ScanResult } from '../scan';

const busy = () => Object.assign(new Error('503 high demand'), { status: 503, body: '[{"error":{"message":"gemini-3.8-flash is currently experiencing high demand.","status":"UNAVAILABLE"}}]' });
const quota = () => Object.assign(new Error('429'), { status: 429 });
const badKey = () => Object.assign(new Error('400'), { status: 400 });

/** A fake client whose answer depends on which model was asked. */
function client(byModel: Record<string, () => unknown>) {
  const asked: string[] = [];
  const c: GeminiClientLike = {
    interactions: {
      create: async (params) => {
        const model = String(params.model);
        asked.push(model);
        const r = byModel[model]?.();
        if (r instanceof Error) throw r;
        return r as { status?: string; output_text?: string };
      },
    },
  };
  return { c, asked };
}

const scan: ScanResult = { companyName: 'Ridgeview Motel', newAccounts: [], opening: { present: false, date: '', balances: [] }, transactions: [], notes: '' };
const ok = (body: unknown) => () => ({ status: 'completed', output_text: JSON.stringify(body) });

describe('Gemini backup models', () => {
  it('tries 3.8 Flash, then 3.6 Flash, then 3.5 Flash-Lite', () => {
    expect(GEMINI_MODELS).toEqual(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  });

  it('moves to the next model when one is busy or out of quota', async () => {
    const r = await withModelFallback(async (m) => {
      if (m === 'gemini-3.8-flash') throw busy();
      if (m === 'gemini-3.6-flash') throw quota();
      return 'answer';
    });
    expect(r).toEqual({ res: 'answer', model: 'gemini-3.5-flash-lite' });
  });

  it('does not try other models for a bad key', async () => {
    const tried: string[] = [];
    await expect(withModelFallback(async (m) => (tried.push(m), Promise.reject(badKey())))).rejects.toMatchObject({ status: 400 });
    expect(tried).toEqual(['gemini-3.8-flash']);
  });

  it('a scan falls back and says which model read the page', async () => {
    const { c, asked } = client({ 'gemini-3.8-flash': busy, 'gemini-3.6-flash': ok(scan) });
    const out = await scanWithGemini('k', { data: 'x', mimeType: 'image/jpeg' }, DEFAULT_ACCOUNTS, '2026-11-13', c);
    expect(asked).toEqual(['gemini-3.8-flash', 'gemini-3.6-flash']);
    expect(out).toMatchObject({ ok: true, model: 'Gemini 3.6 Flash' });
  });

  it('when every model is busy, shows Google’s message', async () => {
    const { c, asked } = client({ 'gemini-3.8-flash': busy, 'gemini-3.6-flash': busy, 'gemini-3.5-flash-lite': busy });
    const out = await scanWithGemini('k', { data: 'x', mimeType: 'image/jpeg' }, DEFAULT_ACCOUNTS, '2026-11-13', c);
    expect(asked).toHaveLength(3);
    expect(out.ok === false && out.reason).toMatch(/high demand/);
  });

  it('typed sentences fall back too', async () => {
    const entry = { outcome: 'entry', reason: '', date: '2026-11-13', description: 'Paid rent', lines: [{ accountNumber: 5000, side: 'debit', amount: '100' }, { accountNumber: 1000, side: 'credit', amount: '100' }], assumptions: '' };
    const { c, asked } = client({ 'gemini-3.8-flash': busy, 'gemini-3.6-flash': ok(entry) });
    const r = await new GeminiParser({ apiKey: 'k', client: c }).parse('Paid rent 100', { accounts: DEFAULT_ACCOUNTS, today: '2026-11-13' });
    expect(r.status).toBe('matched');
    expect(asked).toEqual(['gemini-3.8-flash', 'gemini-3.6-flash']);
  });
});

describe('stalled requests', () => {
  it('moves to the next model when one never answers', async () => {
    const tried: string[] = [];
    const r = await withModelFallback(
      (m) => {
        tried.push(m);
        return m === GEMINI_MODELS[0] ? new Promise<string>(() => {}) : Promise.resolve('ok');
      },
      GEMINI_MODELS,
      30,
    );
    expect(r.model).toBe(GEMINI_MODELS[1]);
    expect(tried).toEqual([GEMINI_MODELS[0], GEMINI_MODELS[1]]);
  });
});
