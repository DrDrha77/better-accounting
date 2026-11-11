import { centsToCsv, toCsv } from '../csv';
import { formatCents, parseAmount } from '../money';

describe('parseAmount', () => {
  it.each([
    ['40000', 4_000_000],
    ['$40,000', 4_000_000],
    ['1,200.50', 120_050],
    ['0.1', 10],
    ['.75', 75],
    ['10k', 1_000_000],
    ['2.5k', 250_000],
    ['3 thousand', 300_000],
    ['1.005', 101],
  ])('%s → %i cents', (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it.each(['', 'abc', '1,00', '-5', '$'])('rejects %j', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('avoids floating-point error', () => {
    expect(parseAmount('0.1')! + parseAmount('0.2')!).toBe(parseAmount('0.3'));
  });
});

describe('formatting', () => {
  it('formats cents as dollars', () => {
    expect(formatCents(4_000_000)).toBe('$40,000.00');
    expect(formatCents(-120_050)).toBe('-$1,200.50');
  });
  it('builds CSV with escaping', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"'], [1, null]])).toBe('a,"b,c","say ""hi"""\r\n1,');
    expect(centsToCsv(120_050)).toBe('1200.50');
    expect(centsToCsv(-5)).toBe('-0.05');
  });
});
