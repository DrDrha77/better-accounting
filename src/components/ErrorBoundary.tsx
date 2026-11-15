import { Component, type ErrorInfo, type ReactNode } from 'react';
import { backupFilename, makeBackup } from '../engine/backup';
import { useBooks } from '../store/useBooks';
import { useSettings } from '../store/useSettings';
import { useCompany } from '../store/useCompany';
import { useCompanies } from '../store/useCompanies';
import { downloadFile } from './format';

/**
 * If something in the app crashes, show this instead of a blank page: the data is safe in the
 * browser, and the user can reload or download a backup of the active company.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Better Accounting crashed:', error, info.componentStack);
  }

  downloadBackup = () => {
    try {
      const b = useBooks.getState();
      const c = useCompany.getState();
      const s = useSettings.getState();
      const { companies, activeId } = useCompanies.getState();
      const now = new Date();
      const backup = makeBackup(
        { accounts: b.accounts, entries: b.entries, nextSeq: b.nextSeq },
        { companyName: companies.find((x) => x.id === activeId)?.name ?? '', entryDate: c.entryDate, periodFrom: c.periodFrom, theme: s.theme, style: s.style, design: s.design },
        now,
      );
      downloadFile(backupFilename(now), JSON.stringify(backup, null, 2), 'application/json');
    } catch (e) {
      console.error('Could not make a backup from the error screen', e);
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '12vh auto', padding: '0 20px', color: '#1d1d1f' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>Something went wrong</h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: '#424245' }}>
          Better Accounting hit an unexpected problem. <strong>Your books are safe</strong>: they're saved in this browser and nothing was deleted. Reloading usually fixes
          it.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
          <button type="button" onClick={() => window.location.reload()} style={{ background: '#0f5c47', color: '#fff', border: 0, borderRadius: 999, padding: '10px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Reload the app
          </button>
          <button type="button" onClick={this.downloadBackup} style={{ background: '#fff', color: '#0f5c47', border: '1px solid #0f5c47', borderRadius: 999, padding: '10px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Download a backup
          </button>
        </div>
        <details style={{ fontSize: 13, color: '#6e6e73' }}>
          <summary style={{ cursor: 'pointer' }}>Technical details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{String(this.state.error?.message ?? this.state.error)}</pre>
        </details>
      </div>
    );
  }
}
