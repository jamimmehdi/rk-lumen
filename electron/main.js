const {
  app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, powerMonitor, dialog, session, desktopCapturer, shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { ViaDevice } = require('./via');
const { Store, uid } = require('./store');
const { LiveEngine, MODES } = require('./live');

const DEV = !!process.env.LUMEN_DEV;
const ROWS = 6, COLS = 15;
const HIDDEN_START = process.argv.includes('--hidden');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win = null, tray = null, sensorWin = null, store, via, live;
let uiohook = null, uiKeyNames = null;
const pressed = new Set();
let statsDirty = false;
let lastSent = null;
let factor = 1;
let locked = false;
let idleSecs = 0;
let ruleProfileId = null; // profile applied by an app rule
let baseProfileId = null; // profile to return to
let activeApp = '';
let devState = { connected: false, info: null, protocol: 0, layers: 0 };
// RK Lumen custom-firmware link (VIA custom channel 0). null = stock firmware without the link.
let gaming = null;
const LV = { INFO: 1, ON: 2, MODE_V: 3, MODE_H: 4, NKRO: 5, GUI: 6, LAYER: 7, KEYS_V: 8, KEYS_H: 9 };

async function readGaming() {
  if (!via.connected) { gaming = null; return; }
  const info = await via.linkGet(LV.INFO);
  if (!info) { gaming = null; return; }
  const g = { version: info[0], caps: info[1] };
  const get = async (id) => (await via.linkGet(id)) || Buffer.alloc(3);
  g.socdOn = (await get(LV.ON))[0] === 1;
  g.modeV = (await get(LV.MODE_V))[0];
  g.modeH = (await get(LV.MODE_H))[0];
  g.nkro = (await get(LV.NKRO))[0] === 1;
  g.guiLock = (await get(LV.GUI))[0] === 1;
  const lay = await get(LV.LAYER);
  g.layer = lay[0]; g.layerMask = lay[1];
  const kv = await get(LV.KEYS_V), kh = await get(LV.KEYS_H);
  g.keysV = [kv[0], kv[1]]; g.keysH = [kh[0], kh[1]];
  gaming = g;
}
const gamingProfile = () => (gaming ? { socdOn: gaming.socdOn, modeV: gaming.modeV, modeH: gaming.modeH } : null);
async function applyGaming(p) {
  if (!p || !gaming || !via.connected) return;
  if (typeof p.modeV === 'number') via.linkSet(LV.MODE_V, p.modeV);
  if (typeof p.modeH === 'number') via.linkSet(LV.MODE_H, p.modeH);
  if (typeof p.socdOn === 'boolean') via.linkSet(LV.ON, p.socdOn ? 1 : 0);
  await readGaming();
  pushState();
}
let sensorError = '';
let outColor = { h: 0, s: 1, v: 0, effect: 0 };
let stateTimer = null;
let keymapCache = null;
let rawListen = false;
let quitting = false;

const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
const appIcon = () => (fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty());

// ---------------------------------------------------------------- state sync
const cur = () => store.data.current;
const sets = () => store.data.settings;
const todayKey = () => new Date().toISOString().slice(0, 10);

function snapshot() {
  const st = store.data.stats;
  return {
    device: devState,
    current: cur(),
    settings: sets(),
    profiles: store.data.profiles,
    activeProfileId: store.data.activeProfileId,
    appRules: store.data.appRules,
    modes: MODES,
    out: outColor,
    activeApp,
    sensorError,
    sys: live.sys,
    typing: { wpm: Math.round(live.typing.wpm), energy: live.typing.energy },
    stats: { total: st.total, today: st.daily[todayKey()] || 0, keys: st.keys, daily: st.daily },
    version: app.getVersion(),
    trackingAvailable: !!uiohook,
    gaming,
  };
}
function pushState() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    if (win && !win.isDestroyed()) win.webContents.send('state', snapshot());
    refreshTray();
  }, 40);
  store.save();
}
function pushFrame() {
  if (win && !win.isDestroyed() && win.isVisible() && !win.isMinimized()) {
    win.webContents.send('frame', { out: outColor, wpm: Math.round(live.typing.wpm), sys: live.sys, audio: live.sensors.audio });
  }
}

// ---------------------------------------------------------------- lighting engine
const b8 = (x) => Math.max(0, Math.min(255, Math.round(x)));

function targetFactor() {
  const s = sets();
  let f = 1;
  if (locked && s.offOnLock) return 0;
  if (s.idleOffMin > 0 && idleSecs >= s.idleOffMin * 60) return 0;
  if (s.idleDimMin > 0 && idleSecs >= s.idleDimMin * 60) f = Math.min(f, s.idleDimLevel / 100);
  if (s.nightEnabled) {
    const d = new Date(); const m = d.getHours() * 60 + d.getMinutes();
    const [fh, fm] = s.nightFrom.split(':').map(Number); const [th, tm] = s.nightTo.split(':').map(Number);
    const a = fh * 60 + fm, b = th * 60 + tm;
    const inNight = a <= b ? m >= a && m < b : m >= a || m < b;
    if (inNight) f = Math.min(f, s.nightLevel / 100);
  }
  return f;
}

function desired() {
  const c = cur();
  const cap = sets().maxBrightness / 100;
  if (!c.on || factor < 0.004) {
    return c.mode === 'hardware' ? { effect: 0, h: c.hw.h, s: c.hw.s, v: 0, speed: c.hw.speed } : { effect: 1, h: 0, s: 0, v: 0, speed: 0 };
  }
  if (c.mode === 'hardware') {
    return { effect: c.hw.effect, h: c.hw.h, s: c.hw.s, v: b8(c.hw.v * cap * factor), speed: c.hw.speed };
  }
  const hsv = live.compute(c.live);
  return { effect: 1, h: b8(hsv.h * 255) % 256, s: b8(hsv.s * 255), v: b8(hsv.v * 255 * cap * factor), speed: 0 };
}

function send(d, force) {
  if (!via.connected) return;
  const l = force ? {} : lastSent || {};
  if (d.effect !== l.effect) via.setEffect(d.effect);
  if (d.speed !== l.speed && d.effect !== 1 && d.effect !== 0) via.setSpeed(d.speed);
  if (d.h !== l.h || d.s !== l.s) via.setColor(d.h, d.s);
  if (d.v !== l.v) via.setBrightness(d.v);
  lastSent = { ...d };
}

function updateSensorNeeds() {
  const c = cur();
  const want = { audio: c.on && c.mode === 'live' && c.live.type === 'audio', screen: c.on && c.mode === 'live' && c.live.type === 'screen' };
  if (!want.audio && !want.screen) { if (sensorWin) { sensorWin.destroy(); sensorWin = null; } return; }
  if (!sensorWin) {
    sensorWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
    sensorWin.loadFile(path.join(__dirname, 'sensors.html'));
    sensorWin.on('closed', () => { sensorWin = null; });
    sensorWin.webContents.once('did-finish-load', () => sensorWin && sensorWin.webContents.send('sensor:want', want));
    sensorError = '';
  } else if (!sensorWin.webContents.isLoading()) sensorWin.webContents.send('sensor:want', want);
}

let lastCpu = os.cpus();
function sampleSystem() {
  const now = os.cpus();
  let idle = 0, total = 0;
  now.forEach((c, i) => {
    const p = lastCpu[i]; if (!p) return;
    for (const k of Object.keys(c.times)) total += c.times[k] - p.times[k];
    idle += c.times.idle - p.times.idle;
  });
  lastCpu = now;
  live.sys.cpu = total ? Math.round((1 - idle / total) * 100) : 0;
  live.sys.ram = Math.round((1 - os.freemem() / os.totalmem()) * 100);
}

let frameN = 0;
function tick() {
  const target = targetFactor();
  factor += (target - factor) * (target < factor ? 0.12 : 0.25);
  if (Math.abs(target - factor) < 0.003) factor = target;
  const d = desired();
  send(d);
  outColor = { h: d.h / 255, s: d.s / 255, v: d.v / 255, effect: d.effect };
  if (++frameN % 2 === 0) pushFrame();
}

// ---------------------------------------------------------------- key tracking
function keyCode(name) {
  if (/^[A-Z]$/.test(name)) return 'Key' + name;
  if (/^[0-9]$/.test(name)) return 'Digit' + name;
  const m = { Ctrl: 'ControlLeft', CtrlRight: 'ControlRight', Alt: 'AltLeft', Shift: 'ShiftLeft', Meta: 'MetaLeft' };
  return m[name] || name;
}
function startKeyHook() {
  if (uiohook || process.env.LUMEN_NOHOOK) return;
  try {
    const m = require('uiohook-napi');
    uiohook = m.uIOhook;
    uiKeyNames = Object.fromEntries(Object.entries(m.UiohookKey).map(([n, v]) => [v, keyCode(n)]));
    uiohook.on('keydown', (e) => {
      if (pressed.has(e.keycode)) return;
      pressed.add(e.keycode);
      live.noteKey();
      if (!sets().trackKeys) return;
      const code = uiKeyNames[e.keycode];
      if (!code) return;
      const st = store.data.stats;
      st.keys[code] = (st.keys[code] || 0) + 1;
      st.total++;
      const k = todayKey();
      st.daily[k] = (st.daily[k] || 0) + 1;
      statsDirty = true;
    });
    uiohook.on('keyup', (e) => pressed.delete(e.keycode));
    uiohook.start();
  } catch (e) { console.error('key hook unavailable', e.message); uiohook = null; }
}
function stopKeyHook() {
  if (!uiohook) return;
  try { uiohook.stop(); } catch { /* ignore */ }
  uiohook = null;
}
function syncKeyHook() {
  const need = sets().trackKeys || (cur().on && cur().mode === 'live' && cur().live.type === 'typing');
  if (need) startKeyHook(); else stopKeyHook();
}

// ---------------------------------------------------------------- profiles / automation
function applyProfile(id, { fromRule = false } = {}) {
  const p = store.data.profiles.find((x) => x.id === id);
  if (!p) return;
  const c = cur();
  c.mode = p.mode; c.hw = { ...p.hw }; c.live = JSON.parse(JSON.stringify(p.live)); c.on = true;
  applyGaming(p.gaming || { socdOn: false });
  if (!fromRule) { store.data.activeProfileId = id; baseProfileId = id; ruleProfileId = null; }
  if (p.live.type === 'pomodoro') live.restartTimer();
  afterChange();
}
function afterChange() { updateSensorNeeds(); syncKeyHook(); pushState(); }

let activeWin = null;
async function checkActiveApp() {
  try {
    if (!activeWin) activeWin = (await import('active-win')).default;
    const w = await activeWin();
    activeApp = w && w.owner && w.owner.path ? path.basename(w.owner.path).toLowerCase() : '';
  } catch { activeApp = ''; }
  const rule = store.data.appRules.find((r) => r.exe && r.exe.toLowerCase() === activeApp);
  if (rule && rule.profileId !== ruleProfileId) {
    if (!ruleProfileId) baseProfileId = store.data.activeProfileId;
    ruleProfileId = rule.profileId;
    applyProfile(rule.profileId, { fromRule: true });
  } else if (!rule && ruleProfileId) {
    ruleProfileId = null;
    if (baseProfileId) applyProfile(baseProfileId);
  }
}

function cycleProfile(dir) {
  const ps = store.data.profiles; if (!ps.length) return;
  const i = Math.max(0, ps.findIndex((p) => p.id === store.data.activeProfileId));
  applyProfile(ps[(i + dir + ps.length) % ps.length].id);
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  if (!sets().hotkeys) return;
  const reg = (k, fn) => { try { globalShortcut.register(k, fn); } catch { /* taken */ } };
  const bright = (d) => { sets().maxBrightness = Math.max(5, Math.min(100, sets().maxBrightness + d)); pushState(); };
  reg('Control+Alt+Up', () => bright(10));
  reg('Control+Alt+Down', () => bright(-10));
  reg('Control+Alt+Right', () => cycleProfile(1));
  reg('Control+Alt+Left', () => cycleProfile(-1));
  reg('Control+Alt+L', () => { cur().on = !cur().on; afterChange(); });
}

// ---------------------------------------------------------------- window / tray
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    show: false, backgroundColor: '#0b0c0f', title: 'RK Lumen', icon: appIcon(),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#aab1c5', height: 48 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  if (DEV) win.loadURL('http://localhost:5173'); else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => { if (!(HIDDEN_START || sets().startMinimized)) win.show(); });
  win.on('close', (e) => {
    if (!app.isQuitting && sets().closeToTray) { e.preventDefault(); win.hide(); }
  });
}
function showWindow() { if (!win) createWindow(); win.show(); win.focus(); }

function refreshTray() {
  if (!tray) return;
  const c = cur();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open RK Lumen', click: showWindow },
    { type: 'separator' },
    { label: c.on ? 'Turn lights off' : 'Turn lights on', click: () => { c.on = !c.on; afterChange(); } },
    { label: 'Profiles', submenu: store.data.profiles.map((p) => ({ label: p.name, type: 'radio', checked: p.id === store.data.activeProfileId, click: () => applyProfile(p.id) })) },
    { label: 'Brightness', submenu: [100, 75, 50, 25, 10].map((n) => ({ label: n + '%', type: 'radio', checked: sets().maxBrightness === n, click: () => { sets().maxBrightness = n; pushState(); } })) },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.setToolTip(`RK Lumen — ${devState.connected ? 'R75 connected' : 'keyboard not found'}`);
}
function createTray() {
  let img = appIcon();
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.on('click', showWindow);
  refreshTray();
}

// ---------------------------------------------------------------- IPC
function mergeLight(patch) {
  const c = cur();
  if (patch.on !== undefined) c.on = patch.on;
  if (patch.mode) c.mode = patch.mode;
  if (patch.hw) c.hw = { ...c.hw, ...patch.hw };
  if (patch.live) {
    if (patch.live.type && patch.live.type !== c.live.type) { c.live.type = patch.live.type; c.live.params = {}; if (patch.live.type === 'pomodoro') live.restartTimer(); }
    if (patch.live.params) c.live.params = { ...c.live.params, ...patch.live.params };
  }
}
const profileOf = (c) => ({ mode: c.mode, hw: { ...c.hw }, live: JSON.parse(JSON.stringify(c.live)), ...(gamingProfile() ? { gaming: gamingProfile() } : {}) });

function setupIpc() {
  ipcMain.handle('state:get', () => snapshot());
  ipcMain.handle('light:patch', (_e, patch) => { mergeLight(patch); afterChange(); });
  ipcMain.handle('light:save', () => {
    if (cur().mode !== 'hardware') return { ok: false, error: 'Switch to a hardware effect first — live modes are driven by the app.' };
    if (!via.connected) return { ok: false, error: 'Keyboard not connected.' };
    send(desiredHardwareFull(), true);
    via.saveLighting();
    return { ok: true };
  });
  ipcMain.handle('profile:save', (_e, { id, name, accent }) => {
    const list = store.data.profiles;
    let p = id && list.find((x) => x.id === id);
    if (p) Object.assign(p, profileOf(cur()), name ? { name } : {}, accent ? { accent } : {});
    else { p = { id: uid(), name: name || 'New profile', accent: accent || '#7c5cff', ...profileOf(cur()) }; list.push(p); }
    store.data.activeProfileId = p.id; baseProfileId = p.id;
    pushState(); return p.id;
  });
  ipcMain.handle('profile:apply', (_e, id) => applyProfile(id));
  ipcMain.handle('profile:update', (_e, { id, name, accent }) => {
    const p = store.data.profiles.find((x) => x.id === id);
    if (p) { if (name) p.name = name; if (accent) p.accent = accent; pushState(); }
  });
  ipcMain.handle('profile:delete', (_e, id) => {
    const list = store.data.profiles; if (list.length <= 1) return;
    store.data.profiles = list.filter((p) => p.id !== id);
    store.data.appRules = store.data.appRules.filter((r) => r.profileId !== id);
    if (store.data.activeProfileId === id) store.data.activeProfileId = store.data.profiles[0].id;
    pushState();
  });
  ipcMain.handle('profile:export', async (_e, id) => {
    const p = store.data.profiles.find((x) => x.id === id); if (!p) return false;
    const r = await dialog.showSaveDialog(win, { defaultPath: `${p.name}.lumen.json`, filters: [{ name: 'Lumen profile', extensions: ['json'] }] });
    if (r.canceled) return false;
    fs.writeFileSync(r.filePath, JSON.stringify(p, null, 2)); return true;
  });
  ipcMain.handle('profile:import', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Lumen profile', extensions: ['json'] }], properties: ['openFile'] });
    if (r.canceled) return false;
    try {
      const p = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (!p.hw || !p.live || !p.mode) throw new Error('bad profile');
      store.data.profiles.push({ id: uid(), name: p.name || 'Imported', accent: p.accent || '#7c5cff', mode: p.mode, hw: p.hw, live: p.live, ...(p.gaming ? { gaming: p.gaming } : {}) });
      pushState(); return true;
    } catch { return false; }
  });
  ipcMain.handle('settings:patch', (_e, patch) => {
    Object.assign(sets(), patch);
    if ('autostart' in patch) app.setLoginItemSettings({ openAtLogin: !!patch.autostart, args: ['--hidden'] });
    if ('hotkeys' in patch) registerHotkeys();
    if ('trackKeys' in patch) syncKeyHook();
    pushState();
  });
  ipcMain.handle('rules:set', (_e, rules) => { store.data.appRules = rules; pushState(); });
  ipcMain.handle('pomo:restart', () => live.restartTimer());
  ipcMain.handle('stats:reset', () => { store.data.stats = { keys: {}, daily: {}, total: 0 }; pushState(); });

  ipcMain.handle('keymap:read', async () => {
    if (!via.connected) throw new Error('Keyboard not connected');
    keymapCache = await via.readKeymap(devState.layers || 5, ROWS, COLS);
    return { rows: ROWS, cols: COLS, layers: keymapCache };
  });
  ipcMain.handle('keymap:set', async (_e, { layer, row, col, code }) => {
    const got = await via.setKeycode(layer, row, col, code);
    if (keymapCache) keymapCache[layer][row][col] = got;
    return got;
  });
  ipcMain.handle('keymap:reset', async () => {
    // VIA "dynamic keymap reset": restores the firmware's built-in default keymap on every layer.
    if (!via.connected) throw new Error('Keyboard not connected');
    await via.request([0x06]);
    await new Promise((r) => setTimeout(r, 1000));
    keymapCache = await via.readKeymap(devState.layers || 5, ROWS, COLS);
    return { rows: ROWS, cols: COLS, layers: keymapCache };
  });
  ipcMain.handle('keymap:export', async () => {
    if (!keymapCache) return false;
    const r = await dialog.showSaveDialog(win, { defaultPath: 'r75-keymap.json', filters: [{ name: 'Keymap', extensions: ['json'] }] });
    if (r.canceled) return false;
    fs.writeFileSync(r.filePath, JSON.stringify({ rows: ROWS, cols: COLS, layers: keymapCache }, null, 2)); return true;
  });
  ipcMain.handle('keymap:import', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Keymap', extensions: ['json'] }], properties: ['openFile'] });
    if (r.canceled) return null;
    const j = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
    if (j.rows !== ROWS || j.cols !== COLS || !Array.isArray(j.layers)) throw new Error('Keymap file does not match this keyboard');
    for (let l = 0; l < Math.min(j.layers.length, devState.layers); l++) {
      for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
        const want = j.layers[l][rr][cc];
        if (!keymapCache || keymapCache[l][rr][cc] !== want) await via.setKeycode(l, rr, cc, want);
      }
    }
    keymapCache = await via.readKeymap(devState.layers, ROWS, COLS);
    return { rows: ROWS, cols: COLS, layers: keymapCache };
  });

  ipcMain.handle('raw:listen', (_e, on) => { rawListen = !!on; });
  ipcMain.handle('raw:devices', () => ViaDevice.list());
  ipcMain.handle('raw:send', async (_e, hex) => {
    const clean = String(hex).replace(/[^0-9a-f]/gi, '');
    if (clean.length < 2 || clean.length > 64) throw new Error('Enter 1–32 bytes of hex');
    const bytes = [...Buffer.from(clean.padEnd(clean.length + (clean.length % 2), '0'), 'hex')];
    if (bytes[0] === 0x06) throw new Error('Blocked: command 0x06 resets the whole keymap.');
    if (bytes[0] === 0xdd) throw new Error('Blocked: bootloader command.');
    try { const r = await via.request(bytes); return r.toString('hex'); } catch { via.write(bytes, true); return '(no reply)'; }
  });
  ipcMain.handle('fw:set', async (_e, { key, value }) => {
    if (!gaming) throw new Error('This keyboard is running the stock firmware. Flash the RK Lumen firmware to use this.');
    const b = (x) => (x ? 1 : 0);
    const map = {
      socdOn: () => via.linkSet(LV.ON, b(value)), modeV: () => via.linkSet(LV.MODE_V, value & 0xff), modeH: () => via.linkSet(LV.MODE_H, value & 0xff),
      nkro: () => via.linkSet(LV.NKRO, b(value)), guiLock: () => via.linkSet(LV.GUI, b(value)),
      keysV: () => via.linkSet(LV.KEYS_V, value[0], value[1]), keysH: () => via.linkSet(LV.KEYS_H, value[0], value[1]),
    };
    if (!map[key]) throw new Error('Unknown setting');
    map[key]();
    await readGaming();
    pushState();
    return gaming;
  });
  ipcMain.handle('fw:save', async () => {
    if (!gaming) throw new Error('Stock firmware: nothing to save');
    via.linkSave();
    return true;
  });
  ipcMain.handle('enc:get', async (_e, layer) => {
    if (!via.connected) throw new Error('Keyboard not connected');
    return { ccw: await via.getEncoder(layer, 0, false), cw: await via.getEncoder(layer, 0, true) };
  });
  ipcMain.handle('enc:set', async (_e, { layer, clockwise, code }) => {
    await via.setEncoder(layer, 0, clockwise, code);
    return { ccw: await via.getEncoder(layer, 0, false), cw: await via.getEncoder(layer, 0, true) };
  });
  ipcMain.handle('app:reconnect', () => { via.close(false); via.tryOpen(); });
  ipcMain.handle('app:quit', () => { app.isQuitting = true; app.quit(); });
  ipcMain.handle('app:openUrl', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

  ipcMain.on('sensor:audio', (_e, a) => { live.sensors.audio = a; });
  ipcMain.on('sensor:screen', (_e, s) => { live.sensors.screen = s; });
  ipcMain.on('sensor:error', (_e, m) => { sensorError = m; pushState(); });
}

function desiredHardwareFull() {
  const c = cur();
  return { effect: c.hw.effect, h: c.hw.h, s: c.hw.s, v: c.hw.v, speed: c.hw.speed };
}

// ---------------------------------------------------------------- boot
app.on('second-instance', showWindow);

app.whenReady().then(async () => {
  store = new Store();
  live = new LiveEngine();
  via = new ViaDevice();
  baseProfileId = store.data.activeProfileId;

  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    try {
      const srcs = await desktopCapturer.getSources({ types: ['screen'] });
      cb({ video: srcs[0], audio: 'loopback' });
    } catch { cb({}); }
  }, { useSystemPicker: false });

  via.on('connect', async (info) => {
    devState = { connected: true, info, protocol: 0, layers: 0 };
    try {
      const i = await via.readInfo();
      devState.protocol = i.protocol; devState.layers = i.layers;
      await readGaming();
      if (!store.data.synced) {
        const l = await via.readLighting();
        cur().hw = { effect: l.effect, h: l.h, s: l.s, v: l.v, speed: l.speed };
        store.data.profiles[0].hw = { ...cur().hw };
        store.data.synced = true;
      }
    } catch (e) { console.error('init failed', e.message); }
    lastSent = null;
    pushState();
  });
  via.on('disconnect', () => { devState = { connected: false, info: null, protocol: 0, layers: 0 }; gaming = null; lastSent = null; keymapCache = null; pushState(); });
  via.on('raw', (m) => { if (rawListen && win && !win.isDestroyed()) win.webContents.send('raw', m); });

  setupIpc();
  createWindow();
  createTray();
  registerHotkeys();
  app.setLoginItemSettings({ openAtLogin: !!sets().autostart, args: ['--hidden'] });
  via.start();
  syncKeyHook();
  updateSensorNeeds();

  setInterval(tick, 33);
  setInterval(() => { sampleSystem(); idleSecs = powerMonitor.getSystemIdleTime(); }, 1000);
  setInterval(checkActiveApp, 2000);
  setInterval(() => { if (statsDirty) { statsDirty = false; pushState(); } }, 10000);
  setInterval(async () => { if (win && win.isVisible()) { if (gaming) await readGaming().catch(() => {}); pushState(); } }, 2000);
  powerMonitor.on('lock-screen', () => { locked = true; });
  powerMonitor.on('unlock-screen', () => { locked = false; });
  powerMonitor.on('suspend', () => { locked = true; });
  powerMonitor.on('resume', () => { locked = false; lastSent = null; });
});

app.on('before-quit', (e) => {
  app.isQuitting = true;
  if (quitting) return;
  quitting = true;
  e.preventDefault();
  (async () => {
    try {
      if (via && via.connected && sets().restoreOnExit) {
        const p = store.data.profiles.find((x) => x.id === baseProfileId) || store.data.profiles[0];
        send({ effect: p.hw.effect, h: p.hw.h, s: p.hw.s, v: p.hw.v, speed: p.hw.speed }, true);
        await via.flush();
      }
    } catch { /* device gone */ }
    try { stopKeyHook(); store && store.flush(); via && via.stop(); } catch { /* ignore */ }
    app.exit(0);
  })();
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* stay in tray */ });
