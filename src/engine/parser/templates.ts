import { SYSTEM_KEYS as K } from '../accounts';

/**
 * A transaction template. To add one, append to TEMPLATES (or use the purchase/expense
 * helpers below) — no other code changes needed.
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

// ---------- Shared vocabulary ----------

const PAY = /\b(paid|pays?|paying|payment|spent|spends?|spending)\b/;
const BUY = /\b(bought|buys?|buying|purchased?|purchases|purchasing|acquired?|acquiring|got|ordered|picked up)\b/;
const BUY_OR_PAY = new RegExp(`${BUY.source}|${PAY.source}`);
const ON_CREDIT = /\b(on credit|on account|credit|payable|owe|owed|owing|invoice from|bill to pay later|pay later)\b/;
const LOAN = /\b(financed|financing|finance|with a loan|loan|on a note|note payable|mortgage)\b/;
const RECEIVE = /\b(collected|collects?|collecting|received|receives?|receiving|got paid)\b|\b(customers?|clients?) paid\b/;
const ADVANCE = /\b(in advance|advance|prepayment|unearned|deposit from)\b/;
const ON_ACCOUNT_SALE = /\b(on account|on credit|billed|bills?|invoiced?|invoices?|receivable)\b/;

/** Long-lived things the business buys (debited to an asset account). */
const ASSETS = {
  equipment: { key: K.equipment, label: 'equipment', noun: /\b(equipment|machinery|machines?|computers?|laptops?|printers?|tools|servers?|cameras?)\b/ },
  vehicles: { key: K.vehicles, label: 'a vehicle', noun: /\b(cars?|vehicles?|trucks?|vans?|automobiles?|suvs?|forklifts?|trailers?)\b/ },
  furniture: { key: K.furniture, label: 'furniture', noun: /\b(furniture|desks?|chairs?|tables?|shelv(es|ing)|fixtures|cabinets?)\b/ },
  supplies: { key: K.supplies, label: 'supplies', noun: /\b(suppl(y|ies)|stationery|paper)\b/ },
} as const;

const ANY_ASSET = new RegExp(Object.values(ASSETS).map((a) => a.noun.source).join('|'));

/** Day-to-day costs (debited to an expense account). */
const EXPENSES = {
  rent: { key: K.rentExpense, label: 'rent', noun: /\b(rent|lease)\b/ },
  wages: { key: K.wagesExpense, label: 'wages', noun: /\b(wages?|salar(y|ies)|payroll)\b/ },
  utilities: { key: K.utilitiesExpense, label: 'utilities', noun: /\b(utilit(y|ies)|electric(ity)?|water bill|internet|phone bill|power bill|gas bill)\b/ },
  advertising: { key: K.advertisingExpense, label: 'advertising', noun: /\b(advertis(ing|ement|ements)|ads?|marketing|promotion)\b/ },
  repairs: { key: K.repairsExpense, label: 'repairs', noun: /\b(repairs?|repaired|maintenance|fix(ed|ing)?)\b/ },
  travel: { key: K.travelExpense, label: 'travel', noun: /\b(travel|airfare|flights?|hotels?|fuel|gasoline|mileage|uber|taxi)\b|\bgas\b(?! bill)/ },
  interest: { key: K.interestExpense, label: 'interest', noun: /\binterest\b/ },
  bankFees: { key: K.miscExpense, label: 'bank fees', noun: /\bbank (fees?|charges?)\b|\bservice charges?\b/ },
} as const;

const ANY_EXPENSE = new RegExp(Object.values(EXPENSES).map((e) => e.noun.source).join('|'));

// ---------- Generators ----------

/** Buying an asset for cash, on credit, or with a loan. */
function purchaseTemplates(kind: keyof typeof ASSETS): TransactionTemplate[] {
  const { key, label, noun } = ASSETS[kind];
  const others = Object.entries(ASSETS)
    .filter(([k]) => k !== kind)
    .map(([, a]) => a.noun);
  return [
    {
      id: `buy-${kind}-cash`,
      label: `Buy ${label} for cash`,
      example: `Bought ${label} for 1200 cash`,
      match: [BUY_OR_PAY, noun],
      boost: [/\bcash\b/],
      exclude: [ON_CREDIT, LOAN, /\bsold\b/, ANY_EXPENSE, ...others],
      debit: key,
      credit: K.cash,
    },
    {
      id: `buy-${kind}-credit`,
      label: `Buy ${label} on credit`,
      example: `Bought ${label} on credit for 1200`,
      match: [BUY, noun, ON_CREDIT],
      exclude: [LOAN, ANY_EXPENSE, ...others],
      debit: key,
      credit: K.accountsPayable,
    },
    {
      id: `buy-${kind}-loan`,
      label: `Buy ${label} with a loan`,
      example: `Bought ${label} for 1200 with a loan`,
      match: [new RegExp(`${BUY.source}|\\b(financed|financing)\\b`), noun, LOAN],
      exclude: others,
      debit: key,
      credit: K.notesPayable,
    },
  ];
}

/** Paying an expense now, or recording it to pay later. */
function expenseTemplates(kind: keyof typeof EXPENSES): TransactionTemplate[] {
  const { key, label, noun } = EXPENSES[kind];
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  const others = Object.entries(EXPENSES)
    .filter(([k]) => k !== kind)
    .map(([, e]) => e.noun);
  return [
    {
      id: `pay-${kind}`,
      label: `Pay ${label}`,
      example: `Paid ${label} 250`,
      match: [PAY, noun],
      exclude: [ON_CREDIT, RECEIVE, ASSETS.supplies.noun],
      debit: key,
      credit: K.cash,
    },
    {
      id: `${kind}-on-account`,
      label: `${cap} bill on account`,
      example: `Got a ${label} bill for 250 on account`,
      match: [noun, ON_CREDIT],
      exclude: [/\b(collected|customers?|clients?)\b/, /\bpaid\b/, ASSETS.supplies.noun, ...others],
      debit: key,
      credit: K.accountsPayable,
    },
  ];
}

// ---------- Template list ----------

export const TEMPLATES: TransactionTemplate[] = [
  {
    id: 'owner-investment',
    label: 'Owner investment',
    example: 'Owner invested 40000 into the business',
    match: [/\b(invest(ed|s|ing|ment)?|contribut(ed|es|ion)|put in)\b/],
    boost: [/\b(owner|personal|own money)\b/, /\binto (the )?business\b/],
    // "Owner contributed a truck" is a non-cash investment — leave it to manual/AI.
    exclude: [/\bwithdr/, ANY_ASSET],
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

  ...purchaseTemplates('equipment'),
  ...purchaseTemplates('vehicles'),
  ...purchaseTemplates('furniture'),
  ...purchaseTemplates('supplies'),

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
    match: [/\b(earned|earns?|earning|provided|performed|completed|rendered|revenue|fees?|made a sale|sales?|services? (for|to))\b/],
    boost: [/\bcash\b/],
    // Selling an asset is not revenue.
    exclude: [ON_ACCOUNT_SALE, ADVANCE, /\bcollected\b/, ANY_ASSET, PAY],
    debit: K.cash,
    credit: K.serviceRevenue,
  },
  {
    id: 'earn-revenue-account',
    label: 'Earn revenue on account',
    example: 'Earned 1500 service revenue on account',
    match: [/\b(earned|earns?|provided|performed|completed|rendered|revenue|fees?|billed|bills?|invoiced?|services?)\b/, ON_ACCOUNT_SALE],
    exclude: [ADVANCE, RECEIVE, ANY_ASSET, ANY_EXPENSE, PAY],
    debit: K.accountsReceivable,
    credit: K.serviceRevenue,
  },
  {
    id: 'receive-revenue-cash',
    label: 'Receive cash for services',
    example: 'Received 800 for consulting services',
    match: [RECEIVE, /\b(services?|work|jobs?|consulting|fees?|sales?|revenue|project)\b/],
    boost: [/\bfor (the |a |our |this |some )?(services?|work|jobs?|consulting|project)\b/],
    exclude: [ADVANCE, /\b(owed|owes|owing|receivable|on account|invoice|balance|earlier|previously|last (week|month|year))\b/],
    debit: K.cash,
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
    match: [RECEIVE, /\b(customers?|clients?|receivables?|on account|owed|owes|owing|invoice|balance)\b/],
    exclude: [ADVANCE],
    debit: K.cash,
    credit: K.accountsReceivable,
  },
  {
    id: 'pay-on-account',
    label: 'Pay on account',
    example: 'Paid 400 on account',
    match: [PAY, /\b(on account|accounts? payable|creditors?|suppliers?|vendors?|owed|what we owe|balance due)\b/],
    exclude: [ANY_EXPENSE, /\b(loan|note|mortgage)\b/, /\b(customers?|clients?)\b/],
    debit: K.accountsPayable,
    credit: K.cash,
  },

  ...expenseTemplates('rent'),
  ...expenseTemplates('wages'),
  ...expenseTemplates('utilities'),
  ...expenseTemplates('advertising'),
  ...expenseTemplates('repairs'),
  ...expenseTemplates('travel'),
  ...expenseTemplates('interest'),
  ...expenseTemplates('bankFees'),

  {
    id: 'borrow',
    label: 'Borrow from bank',
    example: 'Borrowed 10000 from the bank',
    match: [/\b(borrowed|borrows?|borrowing|loan|signed a note)\b/],
    boost: [/\b(bank|lender)\b/, /\b(borrowed|took out|got|received|obtained)\b/],
    exclude: [/\b(repaid|repay|paid|pay|pays|payment|interest)\b/, /\b(bought|buys?|purchased?|acquired?)\b/, ANY_ASSET],
    debit: K.cash,
    credit: K.notesPayable,
  },
  {
    id: 'repay-loan',
    label: 'Repay loan',
    example: 'Repaid 2000 of the bank loan',
    match: [/\b(repaid|repays?|repaying|paid|pays?|payment)\b/, /\b(loan|note|mortgage|bank)\b/],
    exclude: [/\bborrow/, /\binterest\b/, /\b(fees?|charges?)\b/, ANY_ASSET],
    debit: K.notesPayable,
    credit: K.cash,
  },
];
