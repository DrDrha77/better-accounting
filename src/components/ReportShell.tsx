import type { ReactNode } from 'react';
import { toCsv, type CsvCell } from '../engine/csv';
import { downloadCsv } from './format';
import { Button, PageHeader } from './ui';

/** Common frame for reports: title, filters, Print and Export CSV buttons, print-friendly body. */
export function ReportShell({
  title,
  subtitle,
  filters,
  csvName,
  csvRows,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  filters?: ReactNode;
  csvName: string;
  csvRows: () => CsvCell[][];
  children: ReactNode;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button onClick={() => window.print()}>Print</Button>
            <Button onClick={() => downloadCsv(csvName, toCsv(csvRows()))}>Export CSV</Button>
          </>
        }
      />
      {filters && <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">{filters}</div>}
      {children}
    </div>
  );
}
