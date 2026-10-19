export type Cat = 'static' | 'pulse' | 'rainbow' | 'ambient' | 'reactive';
export interface Effect { id: number; name: string; cat: Cat; color: boolean; speed: boolean }

const e = (id: number, name: string, cat: Cat, color = true, speed = true): Effect => ({ id, name, cat, color, speed });
// QMK RGB Matrix effect order. Which ones the R75 firmware actually compiled in is unknown — hide any that do nothing.
export const EFFECTS: Effect[] = [
  e(1, 'Solid Colour', 'static', true, false), e(2, 'Alphas / Mods', 'static', true, false),
  e(3, 'Gradient Up/Down', 'static', true, false), e(4, 'Gradient Left/Right', 'static', true, false),
  e(5, 'Breathing', 'pulse'), e(6, 'Band Saturation', 'pulse'), e(7, 'Band Brightness', 'pulse'),
  e(8, 'Pinwheel Saturation', 'pulse'), e(9, 'Pinwheel Brightness', 'pulse'), e(10, 'Spiral Saturation', 'pulse'),
  e(11, 'Spiral Brightness', 'pulse'), e(25, 'Hue Breathing', 'pulse'), e(26, 'Hue Pendulum', 'pulse'), e(27, 'Hue Wave', 'pulse'),
  e(12, 'Cycle All', 'rainbow', false), e(13, 'Cycle Left/Right', 'rainbow', false), e(14, 'Cycle Up/Down', 'rainbow', false),
  e(15, 'Rainbow Chevron', 'rainbow', false), e(16, 'Cycle Out/In', 'rainbow', false), e(17, 'Cycle Out/In Dual', 'rainbow', false),
  e(18, 'Cycle Pinwheel', 'rainbow', false), e(19, 'Cycle Spiral', 'rainbow', false), e(20, 'Dual Beacon', 'rainbow', false),
  e(21, 'Rainbow Beacon', 'rainbow', false), e(22, 'Rainbow Pinwheels', 'rainbow', false),
  e(23, 'Raindrops', 'ambient'), e(24, 'Jellybean Raindrops', 'ambient', false), e(28, 'Pixel Fractal', 'ambient'),
  e(29, 'Pixel Flow', 'ambient', false), e(30, 'Pixel Rain', 'ambient', false), e(32, 'Digital Rain', 'ambient'),
  e(31, 'Typing Heatmap', 'reactive'), e(33, 'Reactive Simple', 'reactive'), e(34, 'Reactive', 'reactive'),
  e(35, 'Reactive Wide', 'reactive'), e(36, 'Reactive Multi-wide', 'reactive'), e(37, 'Reactive Cross', 'reactive'),
  e(38, 'Reactive Multi-cross', 'reactive'), e(39, 'Reactive Nexus', 'reactive'), e(40, 'Reactive Multi-nexus', 'reactive'),
  e(41, 'Splash', 'reactive'), e(42, 'Multi-splash', 'reactive'), e(43, 'Solid Splash', 'reactive'), e(44, 'Solid Multi-splash', 'reactive'),
];
export const CATS: { id: Cat; name: string; blurb: string }[] = [
  { id: 'static', name: 'Static & Gradients', blurb: 'Calm, solid looks' },
  { id: 'pulse', name: 'Pulse & Bands', blurb: 'Breathing and sweeping bands' },
  { id: 'rainbow', name: 'Rainbow Cycles', blurb: 'Full-spectrum motion' },
  { id: 'ambient', name: 'Ambient Pixels', blurb: 'Rain, flow and fractals' },
  { id: 'reactive', name: 'Reactive', blurb: 'Lights respond to every keystroke' },
];
export const effectById = (id: number) => EFFECTS.find((x) => x.id === id);

// ------------------------------------------------------------------ keycodes
const L: Record<number, string> = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => (L[0x04 + i] = c));
'1234567890'.split('').forEach((c, i) => (L[0x1e + i] = c));
Object.assign(L, {
  0x28: 'Enter', 0x29: 'Esc', 0x2a: 'Bksp', 0x2b: 'Tab', 0x2c: 'Space', 0x2d: '-', 0x2e: '=', 0x2f: '[', 0x30: ']', 0x31: '\\',
  0x32: '#', 0x33: ';', 0x34: "'", 0x35: '`', 0x36: ',', 0x37: '.', 0x38: '/', 0x39: 'Caps', 0x46: 'PrtSc', 0x47: 'ScrLk',
  0x48: 'Pause', 0x49: 'Ins', 0x4a: 'Home', 0x4b: 'PgUp', 0x4c: 'Del', 0x4d: 'End', 0x4e: 'PgDn', 0x4f: '→', 0x50: '←', 0x51: '↓',
  0x52: '↑', 0x53: 'NumLk', 0x65: 'Menu', 0xe0: 'LCtrl', 0xe1: 'LShift', 0xe2: 'LAlt', 0xe3: 'LWin', 0xe4: 'RCtrl', 0xe5: 'RShift', 0xe6: 'RAlt', 0xe7: 'RWin',
  0xa5: 'Power', 0xa6: 'Sleep', 0xa7: 'Wake', 0xa8: 'Mute', 0xa9: 'Vol+', 0xaa: 'Vol−', 0xab: 'Next', 0xac: 'Prev', 0xad: 'Stop', 0xae: 'Play',
  0xaf: 'Media', 0xb0: 'Eject', 0xb1: 'Mail', 0xb2: 'Calc', 0xb3: 'PC', 0xb4: 'Search', 0xb5: 'Web', 0xb6: 'Back', 0xb7: 'Fwd', 0xb8: 'Stop',
  0xb9: 'Refresh', 0xba: 'Favs', 0xbb: 'FF', 0xbc: 'Rew', 0xbd: 'Bri+', 0xbe: 'Bri−',
  0xcd: 'Ms↑', 0xce: 'Ms↓', 0xcf: 'Ms←', 0xd0: 'Ms→', 0xd1: 'Click', 0xd2: 'RClick', 0xd3: 'MClick', 0xd9: 'Wh↑', 0xda: 'Wh↓',
  0x7820: 'RGB Tog', 0x7821: 'RGB Mode+', 0x7822: 'RGB Mode−', 0x7823: 'Hue+', 0x7824: 'Hue−', 0x7825: 'Sat+', 0x7826: 'Sat−',
  0x7827: 'Bri+', 0x7828: 'Bri−', 0x7829: 'Spd+', 0x782a: 'Spd−', 0x7800: 'BL On', 0x7801: 'BL Off', 0x7802: 'BL Tog', 0x7803: 'BL−', 0x7804: 'BL+', 0x7805: 'BL Step',
});
for (let i = 0; i < 12; i++) L[0x3a + i] = 'F' + (i + 1);
for (let i = 0; i < 12; i++) L[0x68 + i] = 'F' + (i + 13);

const LAYER_BASES: [number, string][] = [[0x5200, 'TO'], [0x5220, 'MO'], [0x5240, 'DF'], [0x5260, 'TG'], [0x5280, 'OSL'], [0x52c0, 'TT']];

export function keyLabel(code: number): { short: string; title: string } {
  if (code === 0) return { short: '', title: 'None' };
  if (code === 1) return { short: '▽', title: 'Transparent (falls through to the layer below)' };
  if (L[code]) return { short: L[code], title: L[code] };
  for (const [b, n] of LAYER_BASES) if (code >= b && code < b + 32) return { short: `${n}(${code - b})`, title: `${n} layer ${code - b}` };
  if (code >= 0x100 && code < 0x2000) {
    const m = (code >> 8) & 0x1f; const base = L[code & 0xff] ?? '?';
    const parts = [m & 1 ? 'Ctrl' : '', m & 2 ? 'Shift' : '', m & 4 ? 'Alt' : '', m & 8 ? 'Win' : ''].filter(Boolean);
    return { short: parts.map((p) => p[0]).join('') + '+' + base, title: [...parts, base].join('+') };
  }
  if (code >= 0x2000 && code < 0x4000) return { short: 'MT ' + (L[code & 0xff] ?? ''), title: 'Mod-tap' };
  if (code >= 0x4000 && code < 0x5000) return { short: `LT${(code >> 8) & 0xf} ${L[code & 0xff] ?? ''}`, title: 'Layer-tap' };
  if (code >= 0x7700 && code < 0x7720) return { short: 'M' + (code - 0x7700), title: 'Macro ' + (code - 0x7700) };
  if (code >= 0x7e00 && code < 0x7e80) return { short: 'KB' + (code - 0x7e00), title: 'Keyboard-specific ' + (code - 0x7e00) };
  return { short: '0x' + code.toString(16).toUpperCase(), title: 'Keycode 0x' + code.toString(16) };
}

export interface KcItem { code: number; label: string }
const range = (a: number, b: number): KcItem[] => Array.from({ length: b - a + 1 }, (_, i) => ({ code: a + i, label: L[a + i] }));
const list = (cs: number[]): KcItem[] => cs.map((c) => ({ code: c, label: L[c] }));
export const KC_TABS: { id: string; name: string; items: (layers: number) => KcItem[] }[] = [
  { id: 'basic', name: 'Basic', items: () => [...range(0x04, 0x1d), ...range(0x1e, 0x27), ...list([0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38])] },
  { id: 'nav', name: 'Navigation', items: () => list([0x39, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x65]) },
  { id: 'fn', name: 'F-keys', items: () => [...range(0x3a, 0x45), ...range(0x68, 0x73)] },
  { id: 'mods', name: 'Modifiers', items: () => range(0xe0, 0xe7) },
  { id: 'media', name: 'Media', items: () => list([0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xa5, 0xa6, 0xa7]) },
  { id: 'mouse', name: 'Mouse', items: () => list([0xcd, 0xce, 0xcf, 0xd0, 0xd1, 0xd2, 0xd3, 0xd9, 0xda]) },
  { id: 'layers', name: 'Layers', items: (n) => LAYER_BASES.flatMap(([b, name]) => Array.from({ length: n }, (_, i) => ({ code: b + i, label: `${name}(${i})` }))) },
  { id: 'rgb', name: 'Lighting', items: () => range(0x7820, 0x782a).concat(range(0x7800, 0x7805)) },
  { id: 'special', name: 'Special', items: () => [{ code: 1, label: '▽ Transparent' }, { code: 0, label: 'None' }] },
];
// Anything in QK_BOOT..QK_CLEAR_EEPROM would reboot or wipe the board; never allow it from the editor.
export const isDangerous = (code: number) => code >= 0x7c00 && code <= 0x7c1f;
