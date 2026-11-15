const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    title: 'Better Accounting',
    backgroundColor: '#0b1f1a',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Links to other sites (like Google AI Studio) open in the normal browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (/^https?:/i.test(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setTimeout(checkForUpdates, 4000);
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

const RELEASES = 'https://github.com/DrDrha77/better-accounting/releases/latest';

function newer(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

/** Windows updates itself; Mac (unsigned) tells you a new version exists and opens the download page. */
async function checkForUpdates() {
  if (!app.isPackaged) return;
  try {
    if (process.platform === 'win32') {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.on('update-downloaded', async (info) => {
        const r = await dialog.showMessageBox({
          type: 'info',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          message: `Better Accounting ${info.version} is ready`,
          detail: 'Restart to finish updating. Your books are kept.',
        });
        if (r.response === 0) autoUpdater.quitAndInstall();
      });
      await autoUpdater.checkForUpdatesAndNotify();
      return;
    }
    const res = await fetch('https://api.github.com/repos/DrDrha77/better-accounting/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const latest = String((await res.json()).tag_name || '').replace(/^v/, '');
    if (latest && newer(latest, app.getVersion())) {
      const r = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Open download page', 'Later'],
        defaultId: 0,
        message: `Better Accounting ${latest} is available`,
        detail: 'Download the new version and drag it into Applications to replace this one. Your books are kept.',
      });
      if (r.response === 0) shell.openExternal(RELEASES);
    }
  } catch (e) {
    // Offline or GitHub unreachable: skip quietly.
  }
}
