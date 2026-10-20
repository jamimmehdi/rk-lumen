const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultHw = () => ({ effect: 15, h: 85, s: 255, v: 200, speed: 80 });

const defaults = () => {
  const p1 = { id: uid(), name: 'Everyday', accent: '#7c5cff', mode: 'hardware', hw: { effect: 15, h: 85, s: 255, v: 200, speed: 80 }, live: { type: 'breathe', params: {} } };
  const p2 = { id: uid(), name: 'Focus', accent: '#22d3ee', mode: 'live', hw: defaultHw(), live: { type: 'pomodoro', params: {} } };
  const p3 = { id: uid(), name: 'Music', accent: '#f472b6', mode: 'live', hw: defaultHw(), live: { type: 'audio', params: {} } };
  return {
    settings: {
      autostart: false, startMinimized: false, closeToTray: true, trackKeys: false, hotkeys: true,
      maxBrightness: 100, offOnLock: true, restoreOnExit: true,
      idleDimMin: 0, idleDimLevel: 20, idleOffMin: 0,
      nightEnabled: false, nightFrom: '22:00', nightTo: '07:00', nightLevel: 40,
      disabledEffects: [], autoUpdateCheck: true,
    },
    profiles: [p1, p2, p3],
    activeProfileId: p1.id,
    appRules: [],
    current: { on: true, mode: p1.mode, hw: { ...p1.hw }, live: JSON.parse(JSON.stringify(p1.live)) },
    stats: { keys: {}, daily: {}, total: 0 },
  };
};

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'lumen.json');
    this.data = defaults();
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...this.data, ...saved, settings: { ...this.data.settings, ...saved.settings } };
    } catch { /* first run */ }
    this.timer = null;
  }
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }
  flush() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (e) { console.error('save failed', e); }
  }
}

module.exports = { Store, uid, defaultHw };
