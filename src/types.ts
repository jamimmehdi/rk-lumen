export type Mode = 'hardware' | 'live';
export interface Hw { effect: number; h: number; s: number; v: number; speed: number }
export interface LiveCfg { type: string; params: Record<string, any> }
export interface Current { on: boolean; mode: Mode; hw: Hw; live: LiveCfg }
export interface GamingScene { socdOn?: boolean; modeV?: number; modeH?: number }
export interface Profile { id: string; name: string; accent: string; mode: Mode; hw: Hw; live: LiveCfg; gaming?: GamingScene }
export interface Gaming {
  version: number; caps: number; socdOn: boolean; modeV: number; modeH: number; nkro: boolean; guiLock: boolean;
  layer: number; layerMask: number; keysV: [number, number]; keysH: [number, number];
}
export interface Param {
  k: string; t: 'color' | 'range' | 'select' | 'palette'; label: string; def: any;
  min?: number; max?: number; options?: [string, string][];
}
export interface ModeDef { id: string; name: string; icon: string; desc: string; params: Param[]; needs?: string }
export interface Settings {
  autostart: boolean; startMinimized: boolean; closeToTray: boolean; trackKeys: boolean; hotkeys: boolean;
  maxBrightness: number; offOnLock: boolean; restoreOnExit: boolean;
  idleDimMin: number; idleDimLevel: number; idleOffMin: number;
  nightEnabled: boolean; nightFrom: string; nightTo: string; nightLevel: number;
  disabledEffects: number[];
}
export interface Snap {
  device: { connected: boolean; info: { product: string; manufacturer: string; pid: number; release: number } | null; protocol: number; layers: number };
  current: Current; settings: Settings; profiles: Profile[]; activeProfileId: string;
  appRules: { exe: string; profileId: string }[];
  modes: ModeDef[];
  out: { h: number; s: number; v: number; effect: number };
  activeApp: string; sensorError: string;
  sys: { cpu: number; ram: number };
  typing: { wpm: number; energy: number };
  stats: { total: number; today: number; keys: Record<string, number>; daily: Record<string, number> };
  version: string; trackingAvailable: boolean; gaming: Gaming | null;
}
export interface Frame {
  out: { h: number; s: number; v: number; effect: number }; wpm: number;
  sys: { cpu: number; ram: number };
  audio: { bass: number; mid: number; high: number; level: number; centroid: number; beat: number };
}
export interface Keymap { rows: number; cols: number; layers: number[][][] }

declare global {
  interface Window {
    lumen: {
      getState(): Promise<Snap>;
      onState(cb: (s: Snap) => void): () => void;
      onFrame(cb: (f: Frame) => void): () => void;
      onRaw(cb: (m: { dir: 'in' | 'out'; hex: string; t: number }) => void): () => void;
      light: { patch(p: any): Promise<void>; save(): Promise<{ ok: boolean; error?: string }> };
      profile: {
        save(a: { id?: string; name?: string; accent?: string }): Promise<string>; apply(id: string): Promise<void>;
        update(a: { id: string; name?: string; accent?: string }): Promise<void>; remove(id: string): Promise<void>;
        exportOne(id: string): Promise<boolean>; importOne(): Promise<boolean>;
      };
      settings(p: Partial<Settings>): Promise<void>;
      rules(r: { exe: string; profileId: string }[]): Promise<void>;
      pomodoroRestart(): Promise<void>;
      resetStats(): Promise<void>;
      keymap: { read(): Promise<Keymap>; set(a: { layer: number; row: number; col: number; code: number }): Promise<number>; exportAll(): Promise<boolean>; reset(): Promise<Keymap>; importAll(): Promise<Keymap | null> };
      raw: { listen(on: boolean): Promise<void>; devices(): Promise<any[]>; send(hex: string): Promise<string> };
      fw: { set(a: { key: string; value: any }): Promise<Gaming>; save(): Promise<boolean> };
      encoder: { get(layer: number): Promise<{ ccw: number; cw: number }>; set(a: { layer: number; clockwise: boolean; code: number }): Promise<{ ccw: number; cw: number }> };
      reconnect(): Promise<void>; quit(): Promise<void>; openUrl(u: string): Promise<void>;
    };
  }
}
