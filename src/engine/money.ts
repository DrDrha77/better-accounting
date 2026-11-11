import type { Cents } from './types';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format cents as "$1,234.56"; negatives as "-$1,234.56". */
export function formatCents(cents: Cents): string {
  if (cents < 0) return '-' + usd.format(-cents / 100);
  return usd.format(cents / 100);
}

/** Format cents without a currency symbol: "1,234.56". Blank for zero when `blankZero`. */
export function formatPlain(cents: Cents, blankZero = false): string {
  if (blankZero && cents === 0) return '';
  const s = (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? '-' + s : s;
}

/**
 * Parse a user-typed amount ("$40,000", "1,200.50", "10k", "2.5 thousand") into cents.
 * Uses string arithmetic so no floating-point error is introduced.
 * Returns null if the text is not a valid non-negative amount.
 */
export function parseAmount(input: string): Cents | null {
  const m = input
    .trim()
    .toLowerCase()
    .match(/^\$?\s*((?:\d{1,3}(?:,\d{3})+)|\d+)?(?:\.(\d*))?\s*(k|thousand|m|million)?$/);
  if (!m) return null;
  const [, intRaw, fracRaw, suffix] = m;
  if (intRaw === undefined && (fracRaw === undefined || fracRaw === '')) return null;
  const intPart = (intRaw ?? '0').replace(/,/g, '');
  const frac = fracRaw ?? '';
  const multiplierZeros = suffix === 'k' || suffix === 'thousand' ? 3 : suffix === 'm' || suffix === 'million' ? 6 : 0;
  // Represent as an integer number of 10^-(frac.length) units, shift by multiplier, then to cents.
  const digits = intPart + frac;
  const scale = frac.length - multiplierZeros - 2; // number of decimal places beyond cents
  let value = BigInt(digits || '0');
  if (scale > 0) {
    const div = 10n ** BigInt(scale);
    // Round half up to nearest cent.
    value = (value * 2n + div) / (div * 2n);
  } else if (scale < 0) {
    value = value * 10n ** BigInt(-scale);
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

export function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}
