export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export interface HSV { h: number; s: number; v: number } // all 0..1

export function hsv2rgb({ h, s, v }: HSV): [number, number, number] {
  const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
export function rgb2hsv(r: number, g: number, b: number): HSV {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return { h, s: mx ? d / mx : 0, v: mx };
}
export const hsv2hex = (c: HSV) => '#' + hsv2rgb(c).map((n) => n.toString(16).padStart(2, '0')).join('');
export function hex2hsv(hex: string): HSV {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, v: 1 };
  const n = parseInt(m[1], 16);
  return rgb2hsv((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
export const css = (c: HSV, a = 1) => { const [r, g, b] = hsv2rgb(c); return `rgba(${r},${g},${b},${a})`; };
// Firmware stores hue/sat/val as 0..255 bytes.
export const fromBytes = (h: number, s: number, v = 255): HSV => ({ h: h / 255, s: s / 255, v: v / 255 });
export const toBytes = (c: HSV) => ({ h: Math.round(c.h * 255) % 256, s: Math.round(c.s * 255) });
export const PRESETS = ['#ff3d71', '#ff8a3d', '#ffd23d', '#3ddc84', '#22d3ee', '#3b82f6', '#7c5cff', '#d946ef', '#f472b6', '#ffffff'];
