// Generates build/icon.png (256px) — rounded gradient tile with a glowing keycap grid. No dependencies.
const zlib = require('zlib'), fs = require('fs');
const N = 256, px = Buffer.alloc(N * N * 4);
const sdfRound = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.abs(x - cx) - (hw - r), dy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const o = (y * N + x) * 4;
  const d = sdfRound(x, y, 128, 128, 120, 120, 54);
  if (d > 1) continue;
  let c = mix([22, 18, 48], [10, 11, 22], y / N);
  // keycaps: 3x3 grid, colour sweeps violet -> cyan -> pink
  for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) {
    const kd = sdfRound(x, y, 62 + gx * 66, 62 + gy * 66, 26, 26, 9);
    const t = (gx + gy) / 4;
    const col = t < 0.5 ? mix([124, 92, 255], [34, 211, 238], t * 2) : mix([34, 211, 238], [244, 114, 182], (t - 0.5) * 2);
    if (kd < 1) c = mix(c, col, Math.min(1, 1 - kd) * (0.78 + 0.22 * (1 - (y - (36 + gy * 66)) / 52)));
    else if (kd < 14) c = mix(c, col, 0.18 * (1 - kd / 14));
  }
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = Math.round(255 * Math.min(1, Math.max(0, 1 - d)));
}
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4); }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/icon.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('icon written');
