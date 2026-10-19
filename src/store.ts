import { create } from 'zustand';
import type { Frame, Snap } from './types';

export type Page = 'dashboard' | 'lighting' | 'live' | 'gaming' | 'keymap' | 'profiles' | 'stats' | 'lab' | 'settings';

export const ACCENTS: Record<string, string> = { ember: '255,122,61', cyan: '34,211,238', green: '70,224,143', pink: '255,61,139' };
const load = () => { try { return localStorage.getItem('lumen.accent') || 'ember'; } catch { return 'ember'; } };

interface UI {
  snap: Snap | null;
  frame: Frame | null;
  page: Page;
  accent: string;
  toast: { id: number; msg: string; kind: 'ok' | 'err' } | null;
  setPage: (p: Page) => void;
  setAccent: (a: string) => void;
  notify: (msg: string, kind?: 'ok' | 'err') => void;
}

export const useUI = create<UI>((set) => ({
  snap: null,
  frame: null,
  page: 'dashboard',
  accent: load(),
  toast: null,
  setPage: (page) => set({ page }),
  setAccent: (accent) => { try { localStorage.setItem('lumen.accent', accent); } catch { /* private mode */ } set({ accent }); },
  notify: (msg, kind = 'ok') => {
    const id = Date.now();
    set({ toast: { id, msg, kind } });
    setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 3200);
  },
}));

export function initBridge() {
  window.lumen.getState().then((snap) => useUI.setState({ snap }));
  window.lumen.onState((snap) => useUI.setState({ snap }));
  window.lumen.onFrame((frame) => useUI.setState({ frame }));
}

// Optimistic light patching: UI feels instant, main process stays source of truth.
export function patchLight(p: any) {
  const s = useUI.getState().snap;
  if (s) {
    const c = s.current;
    const next = { ...c };
    if (p.on !== undefined) next.on = p.on;
    if (p.mode) next.mode = p.mode;
    if (p.hw) next.hw = { ...c.hw, ...p.hw };
    if (p.live) {
      next.live = { type: p.live.type ?? c.live.type, params: p.live.type && p.live.type !== c.live.type ? {} : { ...c.live.params, ...(p.live.params || {}) } };
    }
    useUI.setState({ snap: { ...s, current: next } });
  }
  return window.lumen.light.patch(p);
}
