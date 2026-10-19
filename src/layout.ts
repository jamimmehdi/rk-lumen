// R75 (75%, ANSI-ish) layout. row/col are the QMK switch-matrix coordinates, verified against the keyboard's own keymap dump.
export interface KeyDef { id: string; label: string; row: number; col: number; x: number; y: number; w: number; knob?: boolean }

const keys: KeyDef[] = [];
function add(row: number, y: number, col: number, id: string, label: string, x: number, w = 1, knob = false) {
  keys.push({ id, label, row, col, x, y, w, knob });
}
// row 0
add(0, 0, 0, 'Escape', 'Esc', 0);
for (let i = 1; i <= 12; i++) add(0, 0, i, 'F' + i, 'F' + i, i);
add(0, 0, 13, 'Delete', 'Del', 14);
add(0, 0, 14, 'Knob', '', 15, 1, true);
// row 1
const r1 = ['Backquote:`', 'Digit1:1', 'Digit2:2', 'Digit3:3', 'Digit4:4', 'Digit5:5', 'Digit6:6', 'Digit7:7', 'Digit8:8', 'Digit9:9', 'Digit0:0', 'Minus:-', 'Equal:='];
r1.forEach((s, i) => { const [id, l] = s.split(':'); add(1, 1, i, id, l, i); });
add(1, 1, 13, 'Backspace', 'Backspace', 13, 2); add(1, 1, 14, 'Home', 'Home', 15);
// row 2
add(2, 2, 0, 'Tab', 'Tab', 0, 1.5);
'QWERTYUIOP'.split('').forEach((c, i) => add(2, 2, 1 + i, 'Key' + c, c, 1.5 + i));
add(2, 2, 11, 'BracketLeft', '[', 11.5); add(2, 2, 12, 'BracketRight', ']', 12.5);
add(2, 2, 13, 'Backslash', '\\', 13.5, 1.5); add(2, 2, 14, 'PageUp', 'PgUp', 15);
// row 3
add(3, 3, 0, 'CapsLock', 'Caps', 0, 1.75);
'ASDFGHJKL'.split('').forEach((c, i) => add(3, 3, 1 + i, 'Key' + c, c, 1.75 + i));
add(3, 3, 10, 'Semicolon', ';', 10.75); add(3, 3, 11, 'Quote', "'", 11.75);
add(3, 3, 13, 'Enter', 'Enter', 12.75, 2.25); add(3, 3, 14, 'PageDown', 'PgDn', 15);
// row 4
add(4, 4, 0, 'ShiftLeft', 'Shift', 0, 2.25);
'ZXCVBNM'.split('').forEach((c, i) => add(4, 4, 1 + i, 'Key' + c, c, 2.25 + i));
add(4, 4, 8, 'Comma', ',', 9.25); add(4, 4, 9, 'Period', '.', 10.25); add(4, 4, 10, 'Slash', '/', 11.25);
add(4, 4, 11, 'ShiftRight', 'Shift', 12.25, 1.75); add(4, 4, 13, 'ArrowUp', '↑', 14);
// row 5
add(5, 5, 0, 'ControlLeft', 'Ctrl', 0, 1.25); add(5, 5, 1, 'MetaLeft', 'Win', 1.25, 1.25); add(5, 5, 2, 'AltLeft', 'Alt', 2.5, 1.25);
add(5, 5, 5, 'Space', '', 3.75, 6.25); add(5, 5, 9, 'AltRight', 'Alt', 10); add(5, 5, 10, 'Fn', 'Fn', 11);
add(5, 5, 12, 'ArrowLeft', '←', 13); add(5, 5, 13, 'ArrowDown', '↓', 14); add(5, 5, 14, 'ArrowRight', '→', 15);

export const LAYOUT = keys;
export const LAYOUT_W = 16;
export const LAYOUT_H = 6;
