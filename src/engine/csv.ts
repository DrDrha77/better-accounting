export type CsvCell = string | number | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

/** Cents → plain decimal string for spreadsheets ("1234.50"), blank for zero when asked. */
export function centsToCsv(cents: number, blankZero = false): string {
  if (blankZero && cents === 0) return '';
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return `${neg ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
