// Software ("live") lighting modes. Each returns {h,s,v} in 0..1.
// The R75 firmware only accepts one global HSV colour, so live modes animate that colour from the PC.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const hueLerp = (a, b, t) => { let d = ((b - a + 1.5) % 1) - 0.5; return (a + d * t + 1) % 1; };

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}
function hexToHsv(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return { h: 0, s: 0, v: 1 };
  const n = parseInt(m[1], 16);
  return rgbToHsv((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

// Param schema is shared with the UI (see MODES export) so controls render automatically.
const MODES = [
  { id: 'breathe', name: 'Smooth Breathe', icon: 'Wind', desc: 'Custom-colour breathing with adjustable depth and rhythm.',
    params: [
      { k: 'color', t: 'color', label: 'Colour', def: '#7c5cff' },
      { k: 'rate', t: 'range', label: 'Breaths / min', min: 4, max: 60, def: 14 },
      { k: 'depth', t: 'range', label: 'Depth', min: 0, max: 100, def: 85 },
    ] },
  { id: 'journey', name: 'Colour Journey', icon: 'Palette', desc: 'Crossfades through your own palette of up to 6 colours.',
    params: [
      { k: 'colors', t: 'palette', label: 'Palette', def: ['#ff3d71', '#ffaa00', '#00e096', '#3366ff', '#a23bff'] },
      { k: 'secs', t: 'range', label: 'Seconds per colour', min: 1, max: 30, def: 5 },
    ] },
  { id: 'audio', name: 'Audio Reactive', icon: 'AudioLines', desc: 'Reacts to whatever your PC is playing (system audio loopback).',
    params: [
      { k: 'style', t: 'select', label: 'Style', options: [['pulse', 'Bass pulse'], ['spectrum', 'Spectrum hue'], ['beat', 'Beat flash']], def: 'pulse' },
      { k: 'color', t: 'color', label: 'Base colour', def: '#f472b6' },
      { k: 'sens', t: 'range', label: 'Sensitivity', min: 20, max: 300, def: 120 },
      { k: 'floor', t: 'range', label: 'Idle brightness', min: 0, max: 60, def: 10 },
    ], needs: 'audio' },
  { id: 'screen', name: 'Screen Ambience', icon: 'MonitorPlay', desc: 'Matches your keyboard to the dominant colour on screen.',
    params: [
      { k: 'smooth', t: 'range', label: 'Smoothing', min: 0, max: 95, def: 70 },
      { k: 'boost', t: 'range', label: 'Saturation boost', min: 0, max: 100, def: 40 },
    ], needs: 'screen' },
  { id: 'cpu', name: 'System Load', icon: 'Cpu', desc: 'Green→red as CPU (or RAM) load rises. Pulses when overloaded.',
    params: [
      { k: 'source', t: 'select', label: 'Metric', options: [['cpu', 'CPU load'], ['ram', 'RAM usage']], def: 'cpu' },
      { k: 'alert', t: 'range', label: 'Alert pulse above %', min: 50, max: 100, def: 90 },
    ] },
  { id: 'typing', name: 'Typing Energy', icon: 'Keyboard', desc: 'Idle glow that surges and shifts colour as you type faster.',
    params: [
      { k: 'color', t: 'color', label: 'Idle colour', def: '#3b82f6' },
      { k: 'hot', t: 'color', label: 'Hot colour', def: '#ff4d4d' },
      { k: 'decay', t: 'range', label: 'Decay (s)', min: 1, max: 10, def: 3 },
    ], needs: 'keys' },
  { id: 'pomodoro', name: 'Focus Timer', icon: 'Timer', desc: 'Pomodoro on your keyboard: green focus shifting to red, blue break.',
    params: [
      { k: 'focus', t: 'range', label: 'Focus minutes', min: 5, max: 90, def: 25 },
      { k: 'brk', t: 'range', label: 'Break minutes', min: 1, max: 30, def: 5 },
    ] },
  { id: 'circadian', name: 'Circadian Glow', icon: 'Sunset', desc: 'Colour temperature follows the time of day — warm at night, cool by day.',
    params: [
      { k: 'warm', t: 'color', label: 'Night colour', def: '#ff8a3d' },
      { k: 'cool', t: 'color', label: 'Day colour', def: '#9ecbff' },
    ] },
  { id: 'rainbow', name: 'Silky Rainbow', icon: 'Rainbow', desc: 'Whole-board rainbow cycle with buttery 30 fps transitions.',
    params: [
      { k: 'speed', t: 'range', label: 'Speed', min: 1, max: 100, def: 25 },
      { k: 'sat', t: 'range', label: 'Saturation', min: 30, max: 100, def: 100 },
    ] },
];

const modeDef = (id) => MODES.find((m) => m.id === id);
const P = (live, key) => {
  const v = live.params[key];
  if (v !== undefined) return v;
  return modeDef(live.type).params.find((p) => p.k === key).def;
};

class LiveEngine {
  constructor() {
    this.t0 = Date.now();
    this.sensors = { audio: { bass: 0, mid: 0, high: 0, level: 0, centroid: 0, beat: 0 }, screen: { r: 0, g: 0, b: 0 } };
    this.sys = { cpu: 0, ram: 0 };
    this.typing = { energy: 0, wpm: 0, stamps: [] };
    this.smooth = {};
    this.pomoStart = Date.now();
    this.beatLevel = 0;
    this.lastUpdate = Date.now();
  }

  noteKey() {
    const now = Date.now();
    this.typing.stamps.push(now);
    this.typing.energy = clamp(this.typing.energy + 0.18);
  }

  restartTimer() { this.pomoStart = Date.now(); }

  compute(live) {
    const now = Date.now();
    const dt = Math.min(0.2, (now - this.lastUpdate) / 1000);
    this.lastUpdate = now;
    const t = (now - this.t0) / 1000;
    this.typing.stamps = this.typing.stamps.filter((s) => now - s < 8000);
    this.typing.wpm = (this.typing.stamps.length / 5) * (60 / 8);

    switch (live.type) {
      case 'breathe': {
        const c = hexToHsv(P(live, 'color'));
        const rate = P(live, 'rate') / 60;
        const depth = P(live, 'depth') / 100;
        const w = (Math.sin(t * rate * Math.PI * 2 - Math.PI / 2) + 1) / 2;
        const eased = w * w * (3 - 2 * w);
        return { h: c.h, s: c.s, v: lerp(1 - depth, 1, eased) };
      }
      case 'journey': {
        const cols = P(live, 'colors').map(hexToHsv);
        if (!cols.length) return { h: 0, s: 0, v: 0 };
        const per = P(live, 'secs');
        const pos = (t / per) % cols.length;
        const i = Math.floor(pos), f = pos - i;
        const a = cols[i], b = cols[(i + 1) % cols.length];
        const e = f * f * (3 - 2 * f);
        return { h: hueLerp(a.h, b.h, e), s: lerp(a.s, b.s, e), v: lerp(a.v, b.v, e) };
      }
      case 'audio': {
        const a = this.sensors.audio;
        const sens = P(live, 'sens') / 100;
        const floor = P(live, 'floor') / 100;
        const c = hexToHsv(P(live, 'color'));
        const style = P(live, 'style');
        if (style === 'spectrum') {
          const target = clamp(a.centroid);
          this.smooth.ah = hueLerp(this.smooth.ah ?? target, target, 0.15);
          return { h: (c.h + this.smooth.ah * 0.8) % 1, s: 1, v: clamp(floor + a.level * sens) };
        }
        if (style === 'beat') {
          if (a.beat) this.beatLevel = 1;
          this.beatLevel = Math.max(0, this.beatLevel - dt * 3.2);
          return { h: (c.h + (this.beatLevel > 0.5 ? 0.08 : 0)) % 1, s: c.s, v: clamp(floor + this.beatLevel * (1 - floor)) };
        }
        const target = clamp(floor + a.bass * sens * (1 - floor));
        this.smooth.av = (this.smooth.av ?? 0) + (target - (this.smooth.av ?? 0)) * (target > (this.smooth.av ?? 0) ? 0.6 : 0.18);
        return { h: c.h, s: c.s, v: this.smooth.av };
      }
      case 'screen': {
        const sm = P(live, 'smooth') / 100;
        const s = this.sensors.screen;
        const k = 1 - sm;
        this.smooth.r = (this.smooth.r ?? s.r) + (s.r - (this.smooth.r ?? s.r)) * k;
        this.smooth.g = (this.smooth.g ?? s.g) + (s.g - (this.smooth.g ?? s.g)) * k;
        this.smooth.b = (this.smooth.b ?? s.b) + (s.b - (this.smooth.b ?? s.b)) * k;
        const hsv = rgbToHsv(this.smooth.r, this.smooth.g, this.smooth.b);
        return { h: hsv.h, s: clamp(hsv.s * (1 + P(live, 'boost') / 100)), v: clamp(hsv.v * 1.15) };
      }
      case 'cpu': {
        const load = (P(live, 'source') === 'ram' ? this.sys.ram : this.sys.cpu) / 100;
        const h = lerp(0.36, 0, clamp(load * 1.1));
        let v = 0.9;
        if (load * 100 >= P(live, 'alert')) v = 0.45 + 0.55 * ((Math.sin(t * 9) + 1) / 2);
        return { h, s: 1, v };
      }
      case 'typing': {
        this.typing.energy = Math.max(0, this.typing.energy - dt / P(live, 'decay'));
        const idle = hexToHsv(P(live, 'color')), hot = hexToHsv(P(live, 'hot'));
        const e = this.typing.energy;
        return { h: hueLerp(idle.h, hot.h, e), s: lerp(idle.s, hot.s, e), v: lerp(0.35, 1, e) };
      }
      case 'pomodoro': {
        const focus = P(live, 'focus') * 60, brk = P(live, 'brk') * 60;
        const el = ((now - this.pomoStart) / 1000) % (focus + brk);
        if (el < focus) {
          const f = el / focus;
          const left = focus - el;
          const flash = left < 10 ? 0.6 + 0.4 * Math.sin(t * 10) : 1;
          return { h: lerp(0.36, 0, f * f), s: 1, v: flash };
        }
        const f = (el - focus) / brk;
        return { h: 0.58, s: 1, v: lerp(1, 0.4, f) };
      }
      case 'circadian': {
        const d = new Date();
        const hour = d.getHours() + d.getMinutes() / 60;
        const sun = clamp((Math.sin(((hour - 6) / 24) * Math.PI * 2) + 0.35) / 1.35);
        const warm = hexToHsv(P(live, 'warm')), cool = hexToHsv(P(live, 'cool'));
        return { h: hueLerp(warm.h, cool.h, sun), s: lerp(warm.s, cool.s, sun), v: lerp(0.55, 1, sun) };
      }
      case 'rainbow':
        return { h: (t * (P(live, 'speed') / 100) * 0.3) % 1, s: P(live, 'sat') / 100, v: 1 };
      default:
        return { h: 0, s: 0, v: 0 };
    }
  }
}

module.exports = { LiveEngine, MODES, rgbToHsv, hexToHsv, clamp };
