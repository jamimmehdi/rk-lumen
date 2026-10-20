const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch) => (arg) => ipcRenderer.invoke(ch, arg);
const on = (ch) => (cb) => {
  const h = (_e, d) => cb(d);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld('lumen', {
  getState: invoke('state:get'),
  onState: on('state'),
  onFrame: on('frame'),
  onRaw: on('raw'),
  light: { patch: invoke('light:patch'), save: invoke('light:save') },
  profile: {
    save: invoke('profile:save'), apply: invoke('profile:apply'), update: invoke('profile:update'),
    remove: invoke('profile:delete'), exportOne: invoke('profile:export'), importOne: invoke('profile:import'),
  },
  settings: invoke('settings:patch'),
  rules: invoke('rules:set'),
  pomodoroRestart: invoke('pomo:restart'),
  resetStats: invoke('stats:reset'),
  keymap: { read: invoke('keymap:read'), set: invoke('keymap:set'), exportAll: invoke('keymap:export'), reset: invoke('keymap:reset'), importAll: invoke('keymap:import') },
  raw: { listen: invoke('raw:listen'), devices: invoke('raw:devices'), send: invoke('raw:send') },
  fw: { set: invoke('fw:set'), save: invoke('fw:save') },
  encoder: { get: invoke('enc:get'), set: invoke('enc:set') },
  update: { check: invoke('update:check'), download: invoke('update:download'), install: invoke('update:install') },
  reconnect: invoke('app:reconnect'),
  quit: invoke('app:quit'),
  openUrl: invoke('app:openUrl'),
});
