import type { AiProvider } from './aiShared';

/** Display info per AI provider (kept separate so the UI doesn't load any SDK just to show it). */
export const PROVIDERS: Record<AiProvider, { name: string; model: string; keyUrl: string; keyHint: string; note: string }> = {
  gemini: {
    name: 'Google Gemini',
    model: 'Gemini 3.8 Flash',
    keyUrl: 'https://aistudio.google.com/',
    keyHint: 'Create a key in Google AI Studio and restrict it to the Gemini API.',
    note: 'Has a free tier. On the free tier, Google may use requests to improve its products.',
  },
  anthropic: {
    name: 'Anthropic Claude',
    model: 'Claude Opus 5.5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'Anthropic keys start with “sk-ant-”.',
    note: 'Paid per use, billed to the key’s Anthropic account.',
  },
};
