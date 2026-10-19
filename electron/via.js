// VIA / QMK raw-HID transport. The R75 exposes usage page 0xFF60 / usage 0x61 (QMK Raw HID).
// Protocol: 32-byte reports, first byte = command id, replies echo the command.
const HID = require('node-hid');
const { EventEmitter } = require('events');

const VID = 0x342d;
const PID = 0xe484;
const USAGE_PAGE = 0xff60;
const USAGE = 0x61;

const CMD = {
  PROTOCOL: 0x01,
  GET_KEYBOARD_VALUE: 0x02,
  SET_KEYBOARD_VALUE: 0x03,
  DYNAMIC_KEYMAP_GET_KEYCODE: 0x04,
  DYNAMIC_KEYMAP_SET_KEYCODE: 0x05,
  DYNAMIC_KEYMAP_RESET: 0x06,
  CUSTOM_SET: 0x07,
  CUSTOM_GET: 0x08,
  CUSTOM_SAVE: 0x09,
  MACRO_COUNT: 0x0c,
  MACRO_BUFFER_SIZE: 0x0d,
  LAYER_COUNT: 0x11,
  KEYMAP_BUFFER_GET: 0x12,
  KEYMAP_BUFFER_SET: 0x13,
};
const CH_RGB_MATRIX = 3;
const RGB = { BRIGHTNESS: 1, EFFECT: 2, SPEED: 3, COLOR: 4 };

class ViaDevice extends EventEmitter {
  constructor() {
    super();
    this.dev = null;
    this.info = null;
    this.pending = [];
    this.connected = false;
    this.poll = null;
    this.busy = Promise.resolve();
    this.queue = [];
    this.pumping = false;
    this.opening = false;
  }

  static list() {
    return HID.devices()
      .filter((d) => d.vendorId === VID)
      .map((d) => ({
        path: d.path, interface: d.interface, usagePage: d.usagePage, usage: d.usage,
        product: d.product, manufacturer: d.manufacturer, pid: d.productId,
      }));
  }

  start() {
    this.tryOpen();
    this.poll = setInterval(async () => {
      if (!this.connected) return this.tryOpen();
      try {
        const list = await HID.devicesAsync();
        if (!list.some((d) => d.vendorId === VID && d.usagePage === USAGE_PAGE)) this.close(true);
      } catch { /* retry next poll */ }
    }, 2000);
  }

  stop() {
    clearInterval(this.poll);
    this.close(false);
  }

  async tryOpen() {
    if (this.opening || this.connected) return;
    this.opening = true;
    try {
      const d = (await HID.devicesAsync()).find((x) => x.vendorId === VID && x.usagePage === USAGE_PAGE && x.usage === USAGE);
      if (!d) return;
      const dev = await HID.HIDAsync.open(d.path);
      dev.on('data', (buf) => this.onData(Buffer.from(buf)));
      dev.on('error', () => this.close(true));
      this.dev = dev;
      this.queue = [];
      this.info = { product: d.product, manufacturer: d.manufacturer, pid: d.productId, release: d.release, path: d.path };
      this.connected = true;
      this.emit('connect', this.info);
    } catch (e) {
      console.error('hid open failed:', e && e.message);
      this.dev = null;
    } finally { this.opening = false; }
  }

  close(emit) {
    const was = this.connected;
    this.connected = false;
    const dev = this.dev;
    this.dev = null;
    this.queue = [];
    if (dev) dev.close().catch(() => {});
    this.pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('disconnected')); });
    this.pending = [];
    if (was && emit) this.emit('disconnect');
  }

  onData(buf) {
    this.emit('raw', { dir: 'in', hex: buf.toString('hex'), t: Date.now() });
    const i = this.pending.findIndex((p) => p.cmd === buf[0]);
    if (i >= 0) {
      const [p] = this.pending.splice(i, 1);
      clearTimeout(p.timer);
      p.resolve(buf);
    }
  }

  // Fire-and-forget write. HID I/O runs on node-hid's worker thread (HIDAsync) so a slow or wedged
  // device can never block the Electron main process. Writes are queued, and the oldest are dropped under load.
  write(bytes, log = false) {
    if (!this.connected) return false;
    const b = Buffer.alloc(33);
    bytes.forEach((v, i) => { if (i < 32) b[i + 1] = v & 0xff; });
    if (this.queue.length > 24) this.queue.shift();
    this.queue.push(b);
    if (log) this.emit('raw', { dir: 'out', hex: b.subarray(1).toString('hex'), t: Date.now() });
    this.pump();
    return true;
  }

  async flush() { for (let i = 0; i < 40 && (this.queue.length || this.pumping); i++) await new Promise((r) => setTimeout(r, 25)); }

  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    const dev = this.dev;
    try {
      while (this.queue.length && this.dev === dev) {
        const b = this.queue.shift();
        await Promise.race([dev.write(b), new Promise((_, rej) => setTimeout(() => rej(new Error('write timeout')), 1500))]);
      }
    } catch {
      if (this.dev === dev) this.close(true);
    }
    this.pumping = false;
  }

  // Request/response, serialised so replies never get matched to the wrong caller.
  request(bytes, timeout = 600) {
    const run = () => new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('not connected'));
      const entry = { cmd: bytes[0], resolve, reject };
      entry.timer = setTimeout(() => {
        this.pending = this.pending.filter((p) => p !== entry);
        reject(new Error('timeout'));
      }, timeout);
      this.pending.push(entry);
      if (!this.write(bytes, true)) { clearTimeout(entry.timer); reject(new Error('write failed')); }
    });
    const next = this.busy.then(run, run);
    this.busy = next.catch(() => {});
    return next;
  }

  // ---- Lighting (RGB Matrix, channel 3). Uses the *_noeeprom paths in QMK, so streaming is flash-safe.
  setBrightness(v) { return this.write([CMD.CUSTOM_SET, CH_RGB_MATRIX, RGB.BRIGHTNESS, v]); }
  setEffect(e) { return this.write([CMD.CUSTOM_SET, CH_RGB_MATRIX, RGB.EFFECT, e]); }
  setSpeed(s) { return this.write([CMD.CUSTOM_SET, CH_RGB_MATRIX, RGB.SPEED, s]); }
  setColor(h, s) { return this.write([CMD.CUSTOM_SET, CH_RGB_MATRIX, RGB.COLOR, h, s]); }
  saveLighting() { return this.write([CMD.CUSTOM_SAVE, CH_RGB_MATRIX], true); }

  async readLighting() {
    const get = async (id) => (await this.request([CMD.CUSTOM_GET, CH_RGB_MATRIX, id]));
    const [b, e, s, c] = await Promise.all([get(RGB.BRIGHTNESS), get(RGB.EFFECT), get(RGB.SPEED), get(RGB.COLOR)]);
    return { v: b[3], effect: e[3], speed: s[3], h: c[3], s: c[4] };
  }

  async readInfo() {
    const proto = await this.request([CMD.PROTOCOL]);
    const layers = await this.request([CMD.LAYER_COUNT]);
    return { protocol: (proto[1] << 8) | proto[2], layers: layers[1] };
  }

  // ---- Keymap
  async readKeymap(layers, rows, cols) {
    const total = layers * rows * cols * 2;
    const out = Buffer.alloc(total);
    for (let off = 0; off < total; off += 28) {
      const size = Math.min(28, total - off);
      const r = await this.request([CMD.KEYMAP_BUFFER_GET, off >> 8, off & 0xff, size]);
      r.copy(out, off, 4, 4 + size);
    }
    const map = [];
    for (let l = 0; l < layers; l++) {
      const layer = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) row.push(out.readUInt16BE((((l * rows) + r) * cols + c) * 2));
        layer.push(row);
      }
      map.push(layer);
    }
    return map;
  }

  // ---- RK Lumen custom firmware link (VIA custom channel 0). Returns null on stock firmware.
  async linkGet(id, timeout = 600) {
    try {
      const r = await this.request([CMD.CUSTOM_GET, 0, id], timeout);
      return r[0] === 0xff ? null : r.subarray(3);
    } catch { return null; }
  }
  linkSet(id, ...bytes) { return this.write([CMD.CUSTOM_SET, 0, id, ...bytes], true); }
  linkSave() { return this.write([CMD.CUSTOM_SAVE, 0], true); }

  // ---- Rotary encoder (knob) actions per layer
  async getEncoder(layer, index, clockwise) {
    const r = await this.request([0x14, layer, index, clockwise ? 1 : 0]);
    return (r[4] << 8) | r[5];
  }
  async setEncoder(layer, index, clockwise, code) {
    return this.write([0x15, layer, index, clockwise ? 1 : 0, code >> 8, code & 0xff], true);
  }

  async setKeycode(layer, row, col, code) {
    const r = await this.request([CMD.DYNAMIC_KEYMAP_SET_KEYCODE, layer, row, col, code >> 8, code & 0xff]);
    return (r[4] << 8) | r[5];
  }
}

module.exports = { ViaDevice, VID, PID, CMD };
