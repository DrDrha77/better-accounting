import { useMemo } from 'react';
import type { AiProvider } from '../engine/parser/aiShared';
import { HybridParser } from '../engine/parser/hybridParser';
import { RuleBasedParser } from '../engine/parser/ruleParser';
import type { TransactionParser } from '../engine/parser/types';
import { useSettings } from '../store/useSettings';

/** AI parser for the chosen provider; its SDK is loaded only the first time it is used. */
export function lazyAiParser(provider: AiProvider, apiKey: string): TransactionParser {
  let inner: TransactionParser | null = null;
  return {
    name: 'ai',
    async parse(text, ctx) {
      if (!inner) {
        if (provider === 'gemini') {
          const { GeminiParser } = await import('../engine/parser/geminiParser');
          inner = new GeminiParser({ apiKey });
        } else {
          const { ClaudeParser } = await import('../engine/parser/claudeParser');
          inner = new ClaudeParser({ apiKey });
        }
      }
      return inner.parse(text, ctx);
    },
  };
}

/** The recognizer the app uses: rules, plus AI when the user has added a key for their chosen provider. */
export function useTransactionParser(): { parser: TransactionParser; aiEnabled: boolean } {
  const provider = useSettings((s) => s.aiProvider);
  const apiKey = useSettings((s) => s.apiKeys[s.aiProvider]);
  const mode = useSettings((s) => s.aiMode);
  return useMemo(() => {
    const aiEnabled = !!apiKey && mode !== 'off';
    return {
      parser: new HybridParser(new RuleBasedParser(), aiEnabled ? lazyAiParser(provider, apiKey) : null, mode),
      aiEnabled,
    };
  }, [provider, apiKey, mode]);
}
