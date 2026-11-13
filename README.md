# Better Accounting

Type business transactions in plain English ("Owner invested $40,000 into the business") and get a balanced double-entry journal entry. Every record (journal, general ledger, T-accounts, trial balance, income statement, balance sheet, opening statement) is derived live from the journal.

No backend: data is kept in your browser's localStorage.

Tabs: **Journal** (home) · Ledger · T-Accounts · Trial Balance · Balance Sheet · Income Statement · **Settings**.

- **Journal** is the main entry point: type a transaction in plain English, use **Quick post** (date, amount, debit account, credit account), or open a **Blank draft** for multi-line entries. **Save for date** sets the date new entries start on (handy when catching up on an earlier month). The textbook journal shows Date, Description, PR, Amount (Dr. $) and Amount (Cr. $), with a date filter and **Clear journal** (keeps accounts and opening balances). **Opening balances** jumps to that section in Settings.
- **Settings** holds the **company name** (shown on statements), the **chart of accounts** (add, see how many entries use each account, delete unused ones), **opening balances** (as-of date, memo, one amount per account on its normal side; the difference goes to Opening Balance Equity automatically; optional "set period From" and "clear journal first"), the **opening statement**, the AI key, appearance (mint gradient or lined paper; light or dark), and Load sample data / Reset books.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

Click **Load sample data** in the sidebar to see a filled-in month with opening balances.

## How it works

- **Single source of truth:** only the chart of accounts and journal entries are stored. Every report is a pure function of them, so adding, editing or deleting an entry updates everything immediately.
- **Money:** all amounts are integer cents. User input is parsed with string/BigInt arithmetic, so there's no floating-point drift.
- **Balanced or nothing:** an entry that doesn't balance (or has bad lines, dates or accounts) can't be saved.
- **Balance sheet without closing entries:** equity = capital + opening balance equity − drawings + cumulative net income through the as-of date.
- **Opening balances:** saved as one `Opening Balance` entry (number `OB`) that always sorts first. Saving is blocked while it's out of balance; one click can post the difference to *Opening Balance Equity*. The **Opening Statement** page shows the balance sheet from that entry alone.

## Project layout

```
src/
  engine/            pure TypeScript accounting engine (no React)
    money.ts         parse/format amounts in cents
    accounts.ts      default chart of accounts, normal-balance rules
    journal.ts       entry validation and ordering
    ledger.ts        ledgers, T-accounts
    reports.ts       trial balance, income statement, balance sheet, owner's equity, opening statement
    opening.ts       opening-balance totals and the Opening Balance Equity plug
    books.ts         pure add/edit/delete transitions used by the store
    parser/          plain-English parser (see below)
    sample.ts        sample data, built by running sentences through the parser
    __tests__/       Vitest tests
  store/useBooks.ts  Zustand store, persisted to localStorage
  components/        layout, entry editor, report frame, UI bits
  pages/             one file per screen
```

## Recognizing transactions

Typing a sentence goes through two recognizers (`src/engine/parser/`), both behind the same `TransactionParser` interface:

```ts
interface TransactionParser {
  parse(text: string, ctx: { accounts: Account[]; today: string }): Promise<ParseResult>;
}
```

**1. Built-in rules** (`ruleParser.ts`, instant and free). It finds a single amount (`40000`, `$40,000`, `1,200.50`, `50k`) and an optional date (`2026-03-15`, `3/15`, `yesterday`), then scores the templates in `templates.ts`. It covers owner investments and withdrawals; buying equipment, vehicles, furniture or supplies for cash, on credit or with a loan; paying or accruing rent, wages, utilities, advertising, repairs, travel, interest and bank fees; earning, billing and collecting revenue; customer deposits; and borrowing and repaying loans. If there's no amount, more than one amount, no match, or a tie, it gives up rather than guessing.

**2. AI** (optional). In **Settings**, choose a provider and paste your own API key:

| Provider | Model | Notes |
|---|---|---|
| Google Gemini (`geminiParser.ts`) | `gemini-3.8-flash` | Free tier available (Google AI Studio). Uses the Interactions API with `store: false`. |
| Anthropic Claude (`claudeParser.ts`) | `claude-opus-5-5` | Paid per use. Server-side refusal fallback enabled. |

The AI handles sentences the rules can't, such as multi-line entries ("paid 5,000 cash and financed the rest"), written-out numbers, and unusual wording. Both providers share one prompt, JSON schema and validator (`aiShared.ts`). The model gets the sentence, today's date and the chart of accounts (names and numbers only), and its answer is checked before you see it: real accounts only, amounts parsed to cents, debits = credits. Assumptions it made (for example "assumed cash") are shown above the preview. Modes: *when the rules can't tell* (default), *always*, or *off*. `hybridParser.ts` combines rules and AI.

Keys are stored only in that browser's localStorage and sent only to the chosen provider; there is no backend. Each provider's SDK is loaded lazily, the first time the AI runs. To add another provider, implement `TransactionParser` using the helpers in `aiShared.ts` and add it to `lazyAiParser` and `PROVIDERS`.

Every proposal, from rules or AI, is shown as an editable preview and nothing is saved until you confirm it.

### Adding a transaction type to the rules

For a new asset or expense category, add it to `ASSETS` or `EXPENSES` in `templates.ts` and call `purchaseTemplates(...)` / `expenseTemplates(...)`, which generate the cash, on-credit and loan (or pay-later) variants. For anything else, add an object to `TEMPLATES`:

```ts
{
  id: 'owner-investment',
  label: 'Owner investment',
  example: 'Owner invested 40000 into the business',
  match: [/\b(invest(ed|s)?|contribut(ed|ion))\b/], // all must match
  boost: [/\bowner\b/],                              // optional, raises the score
  exclude: [/\bwithdr/],                             // optional, disqualifies
  debit: 'cash',                                     // account systemKey
  credit: 'capital',
}
```

`debit`/`credit` refer to an account's `systemKey`, so renaming accounts doesn't break templates. A new key needs a matching account in `DEFAULT_ACCOUNTS` (`src/engine/accounts.ts`); saved books pick up new default accounts automatically on load. The test suite checks that every template parses its own `example`.
