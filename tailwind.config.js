import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

/**
 * Theming: these palettes resolve to CSS variables, so every existing `text-slate-900`,
 * `bg-red-50`, … flips automatically in dark mode. Dark values are the palette inverted
 * (50↔950, 100↔900, …), which keeps contrast the same way round on a dark background.
 */
const THEMED = ['slate', 'red', 'amber', 'sky', 'violet', 'emerald', 'cyan'];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const INVERT = Object.fromEntries(SHADES.map((s, i) => [s, SHADES[SHADES.length - 1 - i]]));

const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};

const themedColors = Object.fromEntries(
  THEMED.map((name) => [name, Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]))]),
);

// Muted grays need a bit more light than a straight inversion gives them on deep water.
const DARK_OVERRIDES = { slate: { 400: '400', 500: '300' } };
// Light mode: secondary text one step darker than Tailwind's defaults, so it reads easily on paper and glass.
const LIGHT_OVERRIDES = { slate: { 400: '500', 500: '600', 600: '700' } };

/** In the classic ledger style the accent (the `cyan` palette) becomes a deep bookkeeping green. */
const ledgerAccent = (dark) =>
  Object.fromEntries(SHADES.map((s) => [`--c-cyan-${s}`, rgb(colors.green[dark ? INVERT[s] : s])]));

const vars = (dark) =>
  Object.fromEntries(
    THEMED.flatMap((name) =>
      SHADES.map((s) => [`--c-${name}-${s}`, rgb(colors[name][dark ? (DARK_OVERRIDES[name]?.[s] ?? INVERT[s]) : (LIGHT_OVERRIDES[name]?.[s] ?? s)])]),
    ),
  );

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: themedColors,
      transitionTimingFunction: { bubble: 'cubic-bezier(.34,1.56,.64,1)' },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': vars(false),
        ':root[data-theme="dark"]': vars(true),
        ':root[data-style="ledger"]': ledgerAccent(false),
        ':root[data-style="ledger"][data-theme="dark"]': ledgerAccent(true),
      });
    }),
  ],
};
