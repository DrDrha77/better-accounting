import { useState } from 'react';
import { lazyClaudeParser } from '../components/useTransactionParser';
import { cx, formatCents } from '../components/format';
import { Button, Card, Field, inputClass, PageHeader } from '../components/ui';
import { CLAUDE_MODEL_LABEL } from '../engine/parser/modelInfo';
import { todayISO } from '../engine/journal';
import type { AiMode } from '../engine/parser/hybridParser';
import type { ParseResult } from '../engine/parser/types';
import { useBooks } from '../store/useBooks';
import { useSettings } from '../store/useSettings';

const MODES: { value: AiMode; label: string; help: string }[] = [
  { value: 'fallback', label: 'When the rules can’t tell (recommended)', help: 'Common sentences are recognised instantly for free; only the tricky ones are sent to Claude.' },
  { value: 'always', label: 'Always use AI', help: 'Every sentence goes to Claude. Smartest, but each one is a paid API call and takes a few seconds.' },
  { value: 'off', label: 'Off', help: 'Only the built-in rules are used. Nothing is sent to Anthropic.' },
];

const TEST_SENTENCE = 'Bought a used delivery van for 18,500, paid 5,000 cash and financed the rest';

export function Settings() {
  const { anthropicApiKey, aiMode, setApiKey, setAiMode } = useSettings();
  const accounts = useBooks((s) => s.accounts);
  const [draft, setDraft] = useState(anthropicApiKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ParseResult | null>(null);

  const dirty = draft.trim() !== anthropicApiKey;
  const looksWrong = draft.trim() !== '' && !draft.trim().startsWith('sk-ant-');

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const r = await lazyClaudeParser(anthropicApiKey).parse(TEST_SENTENCE, { accounts, today: todayISO() });
    setTest(r);
    setTesting(false);
  };

  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader title="Settings" />

      <Card className="p-5">
        <h2 className="text-lg font-medium text-slate-900">AI transaction recognizer</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add an Anthropic API key and {CLAUDE_MODEL_LABEL} will turn sentences the built-in rules don’t understand into journal entries. You still
          review every entry before it’s saved.
        </p>

        <div className="mt-5 max-w-xl space-y-2">
          <Field label="Anthropic API key">
            <div className="flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                className={cx(inputClass, 'font-mono')}
                placeholder="sk-ant-…"
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
                setApiKey(draft);
                setSaved(true);
              }}
            >
              Save key
            </Button>
            {anthropicApiKey && (
              <Button
                variant="danger"
                onClick={() => {
                  setApiKey('');
                  setDraft('');
                  setTest(null);
                  setSaved(false);
                }}
              >
                Remove key
              </Button>
            )}
            {anthropicApiKey && !dirty && (
              <Button onClick={runTest} disabled={testing}>
                {testing ? 'Testing…' : 'Test the AI'}
              </Button>
            )}
          </div>
          {saved && !dirty && <p className="text-sm text-emerald-700">Key saved in this browser.</p>}
          <p className="text-xs text-slate-500">
            Get a key at{' '}
            <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            . Usage is billed to that key’s Anthropic account.
          </p>
        </div>

        {test && (
          <div className={cx('mt-4 max-w-xl rounded-md px-3 py-2 text-sm', test.status === 'matched' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800')}>
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
          <legend className="text-sm font-medium text-slate-700">When to use AI</legend>
          <div className="mt-2 space-y-2">
            {MODES.map((m) => (
              <label key={m.value} className="flex cursor-pointer gap-3 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50">
                <input type="radio" name="ai-mode" className="mt-0.5" checked={aiMode === m.value} onChange={() => setAiMode(m.value)} />
                <span>
                  <span className="font-medium text-slate-900">{m.label}</span>
                  <span className="block text-slate-500">{m.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <strong className="text-slate-700">Privacy:</strong> your key is stored only in this browser (localStorage) and is sent only to Anthropic’s API. When
          the AI is used, the sentence you typed and your chart of accounts (names and numbers, no balances) are sent with it. Don’t save a key on a shared
          or public computer.
        </div>
      </Card>
    </div>
  );
}
