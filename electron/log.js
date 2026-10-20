// Tiny rotating log in the user-data folder (lumen.log) so connection problems can be diagnosed.
// Contains device state and error messages only — never keystrokes or settings values.
const fs = require('fs');
const path = require('path');
let file = null;
const MAX = 256 * 1024;

function init(dir) {
  try {
    file = path.join(dir, 'lumen.log');
    if (fs.existsSync(file) && fs.statSync(file).size > MAX) fs.renameSync(file, file + '.old');
  } catch { file = null; }
}
function log(tag, msg) {
  const line = `${new Date().toISOString()} [${tag}] ${msg}\n`;
  if (!file) return;
  try { fs.appendFileSync(file, line); } catch { /* disk full / locked: ignore */ }
}
module.exports = { init, log, path: () => file };
