import { useMemo } from 'react';
import { HybridParser } from '../engine/parser/hybridParser';
import { RuleBasedParser } from '../engine/parser/ruleParser';
import type { TransactionParser } from '../engine/parser/types';
import { useSettings } from '../store/useSettings';

/** AI parser that loads the Anthropic SDK only the first time it is used. */
export function lazyClaudeParser(apiKey: string): TransactionParser {
  let inner: TransactionParser | null = null;
  return {
    name: 'ai',
    async parse(text, ctx) {
      if (!inner) {
        const { ClaudeParser } = await import('../engine/parser/claudeParser');
        inner = new ClaudeParser({ apiKey });
      }
      return inner.parse(text, ctx);
    },
  };
}

/** The recognizer the app uses: rules, plus Claude when the user has added an API key. */
export function useTransactionParser(): { parser: TransactionParser; aiEnabled: boolean } {
  const apiKey = useSettings((s) => s.anthropicApiKey);
  const mode = useSettings((s) => s.aiMode);
  return useMemo(() => {
    const aiEnabled = !!apiKey && mode !== 'off';
    return {
      parser: new HybridParser(new RuleBasedParser(), aiEnabled ? lazyClaudeParser(apiKey) : null, mode),
      aiEnabled,
    };
  }, [apiKey, mode]);
}
