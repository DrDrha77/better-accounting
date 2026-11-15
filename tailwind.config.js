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

/** The accent (the `cyan` palette in class names) is a deep bookkeeping green. */
const greenAccent = (dark) =>
  Object.fromEntries(SHADES.map((s) => [`--c-cyan-${s}`, rgb(colors.emerald[dark ? INVERT[s] : s])]));

/**
 * Apple-style design: neutral grays (Apple's text colors) in place of Tailwind's bluish slate,
 * and Apple blue as the accent. Light text is a little darker than Apple's own tertiary gray so
 * it stays easy to read. Dark values are pure-black-page greys.
 */
const APPLE_SLATE_LIGHT = { 50: '#fbfbfd', 100: '#f5f5f7', 200: '#e8e8ed', 300: '#d2d2d7', 400: '#6e6e73', 500: '#56565a', 600: '#424245', 700: '#333336', 800: '#2c2c2e', 900: '#1d1d1f', 950: '#000000' };
const APPLE_SLATE_DARK = { 50: '#0a0a0a', 100: '#1c1c1e', 200: '#2c2c2e', 300: '#48484a', 400: '#8e8e93', 500: '#a1a1a6', 600: '#b8b8bd', 700: '#d2d2d7', 800: '#ececf0', 900: '#f5f5f7', 950: '#000000' };
// Read so that the dark inversion lands on #2997ff for links (700 -> 300) and #0a84ff for fills (600 -> 400).
const APPLE_BLUE = { 50: '#f2f8ff', 100: '#e3f0ff', 200: '#bcdcff', 300: '#2997ff', 400: '#0a84ff', 500: '#0077ed', 600: '#0071e3', 700: '#0066cc', 800: '#0050a0', 900: '#003a75', 950: '#00264d' };

const appleVars = (dark) => ({
  ...Object.fromEntries(SHADES.map((s) => [`--c-slate-${s}`, rgb((dark ? APPLE_SLATE_DARK : APPLE_SLATE_LIGHT)[s])])),
  ...Object.fromEntries(SHADES.map((s) => [`--c-cyan-${s}`, rgb(APPLE_BLUE[dark ? INVERT[s] : s])])),
});

const ACCENTS = { blue: colors.blue, purple: colors.violet, orange: colors.orange, pink: colors.pink };
const accentVars = (name, dark) =>
  Object.fromEntries(SHADES.map((s) => [`--c-cyan-${s}`, rgb(ACCENTS[name][dark ? INVERT[s] : s])]));

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
        ':root:root': greenAccent(false),
        ':root:root[data-theme="dark"]': greenAccent(true),
        ':root:root[data-design="apple"]': appleVars(false),
        ':root:root[data-design="apple"][data-theme="dark"]': appleVars(true),
        ...Object.fromEntries(
          Object.keys(ACCENTS).flatMap((name) => [
            [`:root:root[data-accent="${name}"][data-theme="light"]`, accentVars(name, false)],
            [`:root:root[data-accent="${name}"][data-theme="dark"]`, accentVars(name, true)],
          ]),
        ),
      });
    }),
  ],
};
