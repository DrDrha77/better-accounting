import { DEFAULT_ACCOUNTS, SYSTEM_KEYS as K } from '../accounts';
import { emptyBooks, renameAccount } from '../books';
import { parseWithRules, RuleBasedParser } from '../parser/ruleParser';
import { TEMPLATES } from '../parser/templates';

const ctx = { accounts: DEFAULT_ACCOUNTS, today: '2026-03-01' };

function expectEntry(text: string, debitKey: string, creditKey: string, cents: number) {
  const r = parseWithRules(text, ctx);
  if (r.status !== 'matched') throw new Error(`"${text}" unmatched: ${r.reason}`);
  expect(r.lines).toEqual([
    { accountId: debitKey, debit: cents, credit: 0 },
    { accountId: creditKey, debit: 0, credit: cents },
  ]);
  return r;
}

describe('rule-based parser', () => {
  it('Owner invested $40,000 → Dr Cash 40,000 / Cr Owner’s Capital 40,000', () => {
    const r = expectEntry('Owner invested $40,000 into the business', K.cash, K.ownersCapital, 4_000_000);
    expect(r.templateId).toBe('owner-investment');
    expect(r.date).toBe('2026-03-01');
    expect(r.description).toBe('Owner invested $40,000 into the business');
  });

  it.each([
    ['Bought equipment for 5000 cash', K.equipment, K.cash, 500_000],
    ['Bought supplies on credit for 800', K.supplies, K.accountsPayable, 80_000],
    ['Earned 3000 service revenue in cash', K.cash, K.serviceRevenue, 300_000],
    ['Earned 1500 service revenue on account', K.accountsReceivable, K.serviceRevenue, 150_000],
    ['Paid rent 1200', K.rentExpense, K.cash, 120_000],
    ['Paid wages 2000', K.wagesExpense, K.cash, 200_000],
    ['Owner withdrew 500', K.ownersDrawings, K.cash, 50_000],
    ['Collected 1000 from customer', K.cash, K.accountsReceivable, 100_000],
    ['Paid 400 on account', K.accountsPayable, K.cash, 40_000],
    ['Borrowed 10000 from the bank', K.cash, K.notesPayable, 1_000_000],
    ['Repaid 2000 of the bank loan', K.notesPayable, K.cash, 200_000],
    ['Paid utilities 250', K.utilitiesExpense, K.cash, 25_000],
    ['Received 2000 in advance from a customer', K.cash, K.unearnedRevenue, 200_000],
    ['Bought equipment on credit for 7,500.25', K.equipment, K.accountsPayable, 750_025],
    ['Bought supplies for 300 cash', K.supplies, K.cash, 30_000],
    ['Paid 1200 for a one year insurance policy', K.prepaidInsurance, K.cash, 120_000],
  ])('%s', (text, dr, cr, cents) => {
    expectEntry(text, dr, cr, cents);
  });

  it('every template parses its own example', () => {
    for (const t of TEMPLATES) {
      const r = parseWithRules(t.example, ctx);
      expect(r.status === 'matched' && r.templateId, t.example).toBe(t.id);
    }
  });

  it('reads explicit dates and keeps them out of the amount', () => {
    const iso = parseWithRules('Paid rent 1200 on 2026-02-14', ctx);
    expect(iso.status === 'matched' && iso.date).toBe('2026-02-14');
    const us = parseWithRules('On 2/3 paid wages 900', ctx);
    expect(us.status === 'matched' && us.date).toBe('2026-02-03');
    expect(us.status === 'matched' && us.amount).toBe(90_000);
  });

  it('never guesses: no amount, several amounts, unknown, or ambiguous → unmatched', () => {
    expect(parseWithRules('Paid rent', ctx).status).toBe('unmatched');
    expect(parseWithRules('Paid rent 1200 and wages 2000', ctx).status).toBe('unmatched');
    expect(parseWithRules('Sold the moon for 5000', ctx).status).toBe('unmatched');
    const amb = parseWithRules('Paid rent and wages 3000', ctx);
    expect(amb.status).toBe('unmatched');
    expect(amb.status === 'unmatched' && amb.candidates).toEqual(['Pay rent', 'Pay wages']);
  });

  it('still resolves accounts after they are renamed', () => {
    const r = renameAccount(emptyBooks(), K.cash, 'Checking Account');
    if (!r.ok) throw new Error();
    const p = parseWithRules('Paid rent 100', { accounts: r.books.accounts, today: '2026-01-01' });
    expect(p.status === 'matched' && p.lines[1].accountId).toBe(K.cash);
  });

  it('exposes an async TransactionParser interface', async () => {
    const r = await new RuleBasedParser().parse('Paid rent 1200', ctx);
    expect(r.status).toBe('matched');
  });
});

describe('rule-based parser: everyday phrasings', () => {
  it.each([
    ['Bought a car for $50000', K.vehicles, K.cash, 5_000_000],
    ['Purchased a delivery truck for 32,500', K.vehicles, K.cash, 3_250_000],
    ['Bought a van on credit for 18000', K.vehicles, K.accountsPayable, 1_800_000],
    ['Bought a car for 50k with a loan', K.vehicles, K.notesPayable, 5_000_000],
    ['Financed a new truck for 40000', K.vehicles, K.notesPayable, 4_000_000],
    ['Got a new laptop for 1,200', K.equipment, K.cash, 120_000],
    ['Bought office chairs for 600', K.furniture, K.cash, 60_000],
    ['Paid 300 to fix the truck', K.repairsExpense, K.cash, 30_000],
    ['Spent 250 on Facebook ads', K.advertisingExpense, K.cash, 25_000],
    ['Paid 80 for gas for the van', K.travelExpense, K.cash, 8_000],
    ['Paid 150 interest on the loan', K.interestExpense, K.cash, 15_000],
    ['Paid 25 in bank fees', K.miscExpense, K.cash, 2_500],
    ['Received a 400 advertising bill to pay later', K.advertisingExpense, K.accountsPayable, 40_000],
    ['Paid the electric bill 120', K.utilitiesExpense, K.cash, 12_000],
    ['Received 800 for consulting services', K.cash, K.serviceRevenue, 80_000],
    ['Client paid 500 for the job', K.cash, K.serviceRevenue, 50_000],
    ['Billed a client 2500 for services', K.accountsReceivable, K.serviceRevenue, 250_000],
    ['Customer paid the 700 they owed', K.cash, K.accountsReceivable, 70_000],
    ['Took out a 20,000 loan from the bank', K.cash, K.notesPayable, 2_000_000],
    ['Paid 900 owed to a supplier', K.accountsPayable, K.cash, 90_000],
  ])('%s', (text, dr, cr, cents) => {
    expectEntry(text, dr, cr, cents);
  });

  it('still refuses to guess on genuinely unclear sentences', () => {
    for (const text of ['Sold the old truck for 5000', 'Owner contributed a truck worth 20000', 'Paid for supplies and rent 900']) {
      expect(parseWithRules(text, ctx).status, text).toBe('unmatched');
    }
  });
});
