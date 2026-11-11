# Better Accounting

Type business transactions in plain English ("Owner invested $40,000 into the business") and get a balanced double-entry journal entry. Every record (journal, general ledger, T-accounts, trial balance, income statement, balance sheet, statement of owner's equity, opening statement) is derived live from the journal.

No backend: data is kept in your browser's localStorage.

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

## The parser

`RuleBasedParser` (in `src/engine/parser/ruleParser.ts`) implements the `TransactionParser` interface:

```ts
interface TransactionParser {
  parse(text: string, ctx: { accounts: Account[]; today: string }): Promise<ParseResult>;
}
```

It finds a single amount (`40000`, `$40,000`, `1,200.50`, `10k`) and an optional date (`2026-03-15`, `3/15`, `yesterday`), then scores each template. If there's no amount, more than one amount, no match, or a tie between templates, it returns `unmatched` and the app opens the manual entry form. It never guesses. A matched result is still only a proposal: the user confirms or edits it before it is saved.

To plug in an LLM later, write another class that implements `TransactionParser` and swap it in at the top of `src/pages/Dashboard.tsx`.

### Adding a transaction type

Add an object to `TEMPLATES` in `src/engine/parser/templates.ts`:

```ts
{
  id: 'pay-advertising',
  label: 'Pay advertising',
  example: 'Paid 300 for advertising',
  match: [/\b(paid|pays?)\b/, /\badvertis(ing|ement)\b/], // all must match
  boost: [/\bcash\b/],                                      // optional, raises the score
  exclude: [/\bon account\b/],                              // optional, disqualifies
  debit: 'advertising_expense',                             // account systemKey
  credit: 'cash',
}
```

`debit`/`credit` refer to an account's `systemKey`, so renaming accounts doesn't break templates. A new key needs a matching account in `DEFAULT_ACCOUNTS` (`src/engine/accounts.ts`). The test suite checks that every template parses its own `example`.
