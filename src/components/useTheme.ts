import { useEffect } from 'react';
import { useSettings } from '../store/useSettings';

/** Applies the theme preference to <html data-theme> and follows the device when set to "system". */
export function useApplyTheme() {
  const pref = useSettings((s) => s.theme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    // Always print in the light theme (dark text on white paper).
    const beforePrint = () => (document.documentElement.dataset.theme = 'light');
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', apply);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', apply);
    };
  }, [pref]);
}
