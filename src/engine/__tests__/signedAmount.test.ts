import { parseSignedAmount } from '../../components/OpeningBalancesCard';

describe('opening balance amounts', () => {
  it.each([
    ['', 0],
    ['1,500', 150_000],
    ['1500.25', 150_025],
    ['-200', -20_000],
    ['- 200', -20_000],
    ['(75.50)', -7_550],
  ])('%j → %i', (input, cents) => {
    expect(parseSignedAmount(input)).toBe(cents);
  });
  it('rejects nonsense', () => {
    expect(parseSignedAmount('lots')).toBeNull();
  });
});
