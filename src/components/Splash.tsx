import { useEffect, useState } from 'react';
import { useCompanyName } from '../store/useCompanies';
import { useSettings } from '../store/useSettings';

const SHOW_MS = 1500;
const FADE_MS = 400;
/** Shown once per app start, so moving between pages never replays it. */
let played = false;

/** A short animated intro each time the app opens. Click or press any key to skip. */
export function Splash() {
  const enabled = useSettings((s) => s.showIntro);
  const company = useCompanyName();
  const [phase, setPhase] = useState<'show' | 'leave' | 'done'>(() => {
    if (played || !enabled) return 'done';
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'done';
    } catch {
      // keep going
    }
    return 'show';
  });

  useEffect(() => {
    if (phase === 'done') return;
    played = true;
    const leave = () => setPhase((p) => (p === 'show' ? 'leave' : p));
    const t1 = setTimeout(leave, SHOW_MS);
    const t2 = setTimeout(() => setPhase('done'), SHOW_MS + FADE_MS);
    window.addEventListener('keydown', leave);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('keydown', leave);
    };
  }, [phase === 'done']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'leave') return;
    const t = setTimeout(() => setPhase('done'), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return null;
  return (
    <div className="splash" data-leaving={phase === 'leave'} role="presentation" onClick={() => setPhase('leave')}>
      <svg className="splash-logo" viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
        <rect x="6" y="6" width="108" height="108" rx="26" fill="#0f5c47" />
        <path className="splash-line" style={{ animationDelay: '0.35s' }} d="M32 40h56" />
        <path className="splash-line" style={{ animationDelay: '0.55s' }} d="M32 60h56" />
        <path className="splash-line" style={{ animationDelay: '0.75s' }} d="M32 80h32" />
        <circle className="splash-dot" cx="86" cy="80" r="10" fill="#e0b43a" />
      </svg>
      <div className="splash-name">Better Accounting</div>
      {company && <div className="splash-company">{company}</div>}
    </div>
  );
}
