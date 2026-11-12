import { useEffect, useState } from 'react';
import { cx, formatCents } from '../components/format';
import { Button, Card, Field, inputClass, PageHeader } from '../components/ui';
import { lazyAiParser } from '../components/useTransactionParser';
import { todayISO } from '../engine/journal';
import type { AiProvider } from '../engine/parser/aiShared';
import type { AiMode } from '../engine/parser/hybridParser';
import { PROVIDERS } from '../engine/parser/modelInfo';
import type { ParseResult } from '../engine/parser/types';
import { useBooks } from '../store/useBooks';
import { useSettings, type ThemePref } from '../store/useSettings';

const MODES: { value: AiMode; label: string; help: string }[] = [
  { value: 'fallback', label: 'When the rules can’t tell (recommended)', help: 'Common sentences are recognised instantly for free; only the tricky ones are sent to the AI.' },
  { value: 'always', label: 'Always use AI', help: 'Every sentence goes to the AI. Smartest, but each one is an API call and takes a few seconds.' },
  { value: 'off', label: 'Off', help: 'Only the built-in rules are used. Nothing is sent anywhere.' },
];

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Match my device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const TEST_SENTENCE = 'Bought a used delivery van for 18,500, paid 5,000 cash and financed the rest';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="glass-inset inline-flex flex-wrap gap-1 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ease-bubble',
            value === o.value ? 'bubble-active text-white shadow-md' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Settings() {
  const { aiProvider, apiKeys, aiMode, theme, setProvider, setApiKey, setAiMode, setTheme } = useSettings();
  const accounts = useBooks((s) => s.accounts);
  const savedKey = apiKeys[aiProvider];
  const info = PROVIDERS[aiProvider];
  const [draft, setDraft] = useState(savedKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ParseResult | null>(null);

  // Switching provider shows that provider's saved key.
  useEffect(() => {
    setDraft(savedKey);
    setSaved(false);
    setTest(null);
  }, [aiProvider, savedKey]);

  const dirty = draft.trim() !== savedKey;
  const looksWrong = aiProvider === 'anthropic' && draft.trim() !== '' && !draft.trim().startsWith('sk-ant-');

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const r = await lazyAiParser(aiProvider, savedKey).parse(TEST_SENTENCE, { accounts, today: todayISO() });
    setTest(r);
    setTesting(false);
  };

  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">AI transaction recognizer</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add an API key and the AI will turn sentences the built-in rules don’t understand into journal entries. You still review every entry before it’s
          saved.
        </p>

        <div className="mt-5">
          <div className="mb-2 text-sm font-medium text-slate-600">AI provider</div>
          <Segmented
            label="AI provider"
            value={aiProvider}
            onChange={setProvider}
            options={(Object.keys(PROVIDERS) as AiProvider[]).map((p) => ({ value: p, label: PROVIDERS[p].name + (apiKeys[p] ? ' ✓' : '') }))}
          />
          <p className="mt-2 text-xs text-slate-500">
            Uses {info.model}. {info.note}
          </p>
        </div>

        <div className="mt-5 max-w-xl space-y-2">
          <Field label={`${info.name} API key`}>
            <div className="flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                className={cx(inputClass, 'font-mono')}
                placeholder="Paste your API key"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSaved(false);
                  setTest(null);
                }}
              />
              <Button onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</Button>
            </div>
          </Field>
          {looksWrong && <p className="text-sm text-amber-700">Anthropic API keys usually start with “sk-ant-”.</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={!dirty || !draft.trim()}
              onClick={() => {
                setApiKey(aiProvider, draft);
                setSaved(true);
              }}
            >
              Save key
            </Button>
            {savedKey && (
              <Button
                variant="danger"
                onClick={() => {
                  setApiKey(aiProvider, '');
                  setDraft('');
                  setTest(null);
                  setSaved(false);
                }}
              >
                Remove key
              </Button>
            )}
            {savedKey && !dirty && (
              <Button onClick={runTest} disabled={testing}>
                {testing ? 'Testing…' : 'Test the AI'}
              </Button>
            )}
          </div>
          {saved && !dirty && <p className="text-sm text-cyan-700">Key saved in this browser.</p>}
          <p className="text-xs text-slate-500">
            {info.keyHint} Get one at{' '}
            <a className="underline" href={info.keyUrl} target="_blank" rel="noreferrer">
              {new URL(info.keyUrl).host}
            </a>
            .
          </p>
        </div>

        {test && (
          <div
            data-testid="ai-test-result"
            className={cx('mt-4 max-w-xl rounded-2xl px-4 py-3 text-sm', test.status === 'matched' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800')}
          >
            <div className="font-medium">Test: “{TEST_SENTENCE}”</div>
            {test.status === 'matched' ? (
              <ul className="mt-1 space-y-0.5">
                {test.lines.map((l, i) => (
                  <li key={i} className="tabular-nums">
                    {l.debit ? 'Dr' : 'Cr'} {name(l.accountId)} {formatCents(l.debit || l.credit)}
                  </li>
                ))}
                <li className="pt-1">✓ The AI is working.</li>
              </ul>
            ) : (
              <p className="mt-1">{test.reason}</p>
            )}
          </div>
        )}

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-slate-600">When to use AI</legend>
          <div className="mt-2 space-y-2">
            {MODES.map((m) => (
              <label key={m.value} className="glass-inset flex cursor-pointer gap-3 rounded-2xl p-3 text-sm transition hover:brightness-105">
                <input type="radio" name="ai-mode" className="mt-0.5 accent-cyan-500" checked={aiMode === m.value} onChange={() => setAiMode(m.value)} />
                <span>
                  <span className="font-medium text-slate-900">{m.label}</span>
                  <span className="block text-slate-500">{m.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="glass-inset mt-6 rounded-2xl p-3 text-xs text-slate-600">
          <strong className="text-slate-700">Privacy:</strong> keys are stored only in this browser (localStorage) and sent only to the provider you choose.
          When the AI is used, the sentence you typed and your chart of accounts (names and numbers, no balances) are sent with it. Don’t save a key on a
          shared or public computer.
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Appearance</h2>
        <div className="mt-3">
          <Segmented label="Theme" value={theme} onChange={setTheme} options={THEMES} />
        </div>
      </Card>
    </div>
  );
}
