import { useEffect } from 'react';
import { useSettings } from '../store/useSettings';

/** Applies the theme preference to <html data-theme> and follows the device when set to "system". */
export function useApplyTheme() {
  const pref = useSettings((s) => s.theme);
  const style = useSettings((s) => s.style);
  const design = useSettings((s) => s.design);
  const textSize = useSettings((s) => s.textSize);
  const accent = useSettings((s) => s.accent);
  const density = useSettings((s) => s.density);
  useEffect(() => {
    const d = document.documentElement.dataset;
    d.text = textSize;
    d.accent = accent;
    d.density = density;
  }, [textSize, accent, density]);
  useEffect(() => {
    document.documentElement.dataset.style = style;
  }, [style]);
  useEffect(() => {
    document.documentElement.dataset.design = design;
    // index.html loads the fonts for the design you started with; load the other set when you switch.
    if (!document.head.querySelector(`link[data-fonts="${design}"]`)) {
      const families = design === 'apple' ? 'family=Inter:wght@400;500;600;700' : 'family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800';
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
      link.setAttribute('data-fonts', design);
      document.head.appendChild(link);
    }
  }, [design]);
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
