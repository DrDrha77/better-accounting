import { SYSTEM_KEYS as K } from '../accounts';

/**
 * A transaction template. To add one, append to TEMPLATES — no other code changes needed.
 *
 * Matching (on the lower-cased sentence):
 *  - every pattern in `match` must be found
 *  - no pattern in `exclude` may be found
 *  - score = match.length + number of `boost` patterns found
 * The highest score wins; a tie between templates is treated as ambiguous (no guess).
 * `debit` / `credit` are account systemKeys, so renamed accounts still resolve.
 */
export interface TransactionTemplate {
  id: string;
  label: string;
  example: string;
  match: RegExp[];
  boost?: RegExp[];
  exclude?: RegExp[];
  debit: string;
  credit: string;
}

const PAY = /\b(paid|pays?|paying|payment)\b/;
const BUY = /\b(bought|buys?|buying|purchased?|purchases|acquired?)\b/;
const ON_CREDIT = /\b(on credit|on account|credit|payable|owe|owed|invoice from)\b/;
const EQUIPMENT = /\b(equipment|machinery|machine|computers?|furniture|vehicles?|truck|tools)\b/;
const SUPPLIES = /\bsuppl(y|ies)\b/;
const EARN = /\b(earned|earns?|earning|provided|performed|completed|rendered|revenue|fees?|services? (for|to))\b/;
const ON_ACCOUNT_SALE = /\b(on account|on credit|billed|bills?|invoiced?|invoices?|receivable)\b/;
const RECEIVE = /\b(collected|collects?|collecting|received|receives?|receiving)\b/;
const ADVANCE = /\b(in advance|advance|prepayment|unearned|deposit from)\b/;

export const TEMPLATES: TransactionTemplate[] = [
  {
    id: 'owner-investment',
    label: 'Owner investment',
    example: 'Owner invested 40000 into the business',
    match: [/\b(invest(ed|s|ing|ment)?|contribut(ed|es|ion)|put in)\b/],
    boost: [/\b(owner|personal|own money)\b/, /\binto (the )?business\b/],
    exclude: [/\bwithdr/],
    debit: K.cash,
    credit: K.ownersCapital,
  },
  {
    id: 'owner-withdrawal',
    label: 'Owner withdrawal',
    example: 'Owner withdrew 500',
    match: [/\b(withdr(ew|aw|aws|awing|awal|awals)|drew|drawings?|took out)\b/],
    boost: [/\b(owner|personal)\b/],
    exclude: [/\bloan\b/],
    debit: K.ownersDrawings,
    credit: K.cash,
  },
  {
    id: 'buy-equipment-cash',
    label: 'Buy equipment for cash',
    example: 'Bought equipment for 5000 cash',
    match: [BUY, EQUIPMENT],
    boost: [/\bcash\b/],
    exclude: [ON_CREDIT],
    debit: K.equipment,
    credit: K.cash,
  },
  {
    id: 'buy-equipment-credit',
    label: 'Buy equipment on credit',
    example: 'Bought equipment on credit for 5000',
    match: [BUY, EQUIPMENT, ON_CREDIT],
    debit: K.equipment,
    credit: K.accountsPayable,
  },
  {
    id: 'buy-supplies-cash',
    label: 'Buy supplies for cash',
    example: 'Bought supplies for 300 cash',
    match: [BUY, SUPPLIES],
    boost: [/\bcash\b/],
    exclude: [ON_CREDIT],
    debit: K.supplies,
    credit: K.cash,
  },
  {
    id: 'buy-supplies-credit',
    label: 'Buy supplies on credit',
    example: 'Bought supplies on credit for 800',
    match: [BUY, SUPPLIES, ON_CREDIT],
    debit: K.supplies,
    credit: K.accountsPayable,
  },
  {
    id: 'prepaid-insurance',
    label: 'Prepay insurance',
    example: 'Paid 1200 for a one-year insurance policy',
    match: [/\b(paid|pays?|prepaid|bought|purchased?)\b/, /\binsurance\b/],
    debit: K.prepaidInsurance,
    credit: K.cash,
  },
  {
    id: 'earn-revenue-cash',
    label: 'Earn revenue for cash',
    example: 'Earned 3000 service revenue in cash',
    match: [EARN],
    boost: [/\bcash\b/],
    exclude: [ON_ACCOUNT_SALE, ADVANCE, /\bcollected\b/],
    debit: K.cash,
    credit: K.serviceRevenue,
  },
  {
    id: 'earn-revenue-account',
    label: 'Earn revenue on account',
    example: 'Earned 1500 service revenue on account',
    match: [/\b(earned|earns?|provided|performed|completed|rendered|revenue|fees?|billed|bills?|invoiced?)\b/, ON_ACCOUNT_SALE],
    exclude: [ADVANCE, RECEIVE],
    debit: K.accountsReceivable,
    credit: K.serviceRevenue,
  },
  {
    id: 'receive-advance',
    label: 'Receive cash in advance',
    example: 'Received 2000 in advance from a customer',
    match: [RECEIVE, ADVANCE],
    debit: K.cash,
    credit: K.unearnedRevenue,
  },
  {
    id: 'collect-receivable',
    label: 'Collect from customer',
    example: 'Collected 1000 from customer',
    match: [RECEIVE, /\b(customers?|clients?|receivables?|on account)\b/],
    exclude: [ADVANCE],
    debit: K.cash,
    credit: K.accountsReceivable,
  },
  {
    id: 'pay-on-account',
    label: 'Pay on account',
    example: 'Paid 400 on account',
    match: [PAY, /\b(on account|accounts? payable|creditors?|suppliers?|vendors?|owed)\b/],
    exclude: [/\b(rent|wages?|salar(y|ies)|payroll|utilit(y|ies)|loan|note)\b/],
    debit: K.accountsPayable,
    credit: K.cash,
  },
  {
    id: 'pay-rent',
    label: 'Pay rent',
    example: 'Paid rent 1200',
    match: [PAY, /\brent\b/],
    debit: K.rentExpense,
    credit: K.cash,
  },
  {
    id: 'pay-wages',
    label: 'Pay wages',
    example: 'Paid wages 2000',
    match: [PAY, /\b(wages?|salar(y|ies)|payroll)\b/],
    debit: K.wagesExpense,
    credit: K.cash,
  },
  {
    id: 'pay-utilities',
    label: 'Pay utilities',
    example: 'Paid utilities 250',
    match: [PAY, /\b(utilit(y|ies)|electric(ity)?|water bill|internet|phone bill)\b/],
    debit: K.utilitiesExpense,
    credit: K.cash,
  },
  {
    id: 'borrow',
    label: 'Borrow from bank',
    example: 'Borrowed 10000 from the bank',
    match: [/\b(borrowed|borrows?|borrowing|took out a loan|obtained a loan|signed a note)\b/],
    boost: [/\b(bank|loan|note)\b/],
    exclude: [/\b(repaid|repay|paid back|paid off)\b/],
    debit: K.cash,
    credit: K.notesPayable,
  },
  {
    id: 'repay-loan',
    label: 'Repay loan',
    example: 'Repaid 2000 of the bank loan',
    match: [/\b(repaid|repays?|repaying|paid|pays?)\b/, /\b(loan|note|bank)\b/],
    exclude: [/\bborrow/],
    debit: K.notesPayable,
    credit: K.cash,
  },
];
