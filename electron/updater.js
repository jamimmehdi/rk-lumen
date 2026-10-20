// In-app updates from GitHub Releases (electron-updater). Only the installed (NSIS) build can self-update;
// the portable zip and dev runs just link to the releases page. Nothing is downloaded without a click.
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const RELEASES_URL = 'https://github.com/jamimmehdi/rk-lumen/releases';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const state = {
  mode: 'dev',            // 'installed' | 'portable' | 'dev'
  supported: false,       // can this build update itself?
  status: 'idle',         // idle | checking | none | available | downloading | ready | error
  current: app.getVersion(),
  version: '',
  notes: '',
  percent: 0,
  checkedAt: 0,
  error: '',
  releasesUrl: RELEASES_URL,
};

let updater = null;
let notify = () => {};
let beforeInstall = () => {};

function installKind() {
  if (!app.isPackaged) return 'dev';
  try {
    // The NSIS installer drops "Uninstall <product>.exe" next to the app; a plain unzip does not.
    return fs.readdirSync(path.dirname(process.execPath)).some((f) => /^uninstall.*\.exe$/i.test(f)) ? 'installed' : 'portable';
  } catch { return 'portable'; }
}

const plain = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, 1500);
const set = (patch) => { Object.assign(state, patch); notify(); };

function init({ onChange, getSettings, onBeforeInstall }) {
  notify = onChange;
  beforeInstall = onBeforeInstall;
  state.mode = installKind();

  // Test hook: a local feed (http://127.0.0.1 / localhost only) lets the upgrade flow be exercised without GitHub.
  const test = process.env.LUMEN_UPDATE_URL;
  const testOk = !!test && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(test);
  state.supported = state.mode === 'installed' && (app.isPackaged || testOk);

  if (state.supported) {
    updater = require('electron-updater').autoUpdater;
    updater.autoDownload = false;          // always ask first
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.logger = null;
    if (testOk) updater.setFeedURL({ provider: 'generic', url: test });
    updater.on('checking-for-update', () => set({ status: 'checking', error: '' }));
    updater.on('update-available', (i) => set({ status: 'available', version: i.version, notes: plain(Array.isArray(i.releaseNotes) ? i.releaseNotes.map((n) => n.note).join('\n') : i.releaseNotes), percent: 0, checkedAt: Date.now() }));
    updater.on('update-not-available', () => set({ status: 'none', checkedAt: Date.now() }));
    updater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent || 0) }));
    updater.on('update-downloaded', () => set({ status: 'ready', percent: 100 }));
    updater.on('error', (e) => set({ status: 'error', error: String((e && e.message) || e).split('\n')[0].slice(0, 200) }));
  }

  ipcMain.handle('update:check', () => check());
  ipcMain.handle('update:download', async () => {
    if (!updater || state.status !== 'available') return;
    try { await updater.downloadUpdate(); } catch { /* reported through the error event */ }
  });
  ipcMain.handle('update:install', () => {
    if (!updater || state.status !== 'ready') return;
    beforeInstall();                       // restore lighting, flush settings, release the keyboard
    setTimeout(() => updater.quitAndInstall(true, true), 400);   // silent, relaunch afterwards
  });

  if (state.supported) {
    setTimeout(() => { if (getSettings().autoUpdateCheck) check(); }, 15000);
    setInterval(() => { if (getSettings().autoUpdateCheck && !['downloading', 'ready'].includes(state.status)) check(); }, CHECK_EVERY_MS);
  }
}

async function check() {
  if (!updater || ['checking', 'downloading', 'ready'].includes(state.status)) return;
  try { await updater.checkForUpdates(); } catch { /* reported through the error event */ }
}

module.exports = { init, state: () => ({ ...state }) };
