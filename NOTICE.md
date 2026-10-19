# Third-party notices

## Application (MIT)
RK Lumen's own code (`src/`, `electron/`, `tools/`) is MIT licensed. Runtime dependencies (Electron, React, node-hid,
uiohook-napi, active-win, zustand, framer-motion, lucide-react, @fontsource/manrope, @fontsource/jetbrains-mono) keep their own
licences; see `package.json` and each package. Fonts Manrope and JetBrains Mono are under the SIL Open Font License 1.1.

## Firmware (`firmware/`)
- **QMK Firmware** — GPL-2.0-or-later — <https://github.com/qmk/qmk_firmware>. The firmware is built against it.
- **Royal Kludge R75 keyboard definition** (`keyboards/rk/r75/custom`) — GPL-2.0-or-later, Copyright 2024 SDK (@sdk66) and
  DV (@iamdanielv); packaged in <https://github.com/snakkarike/Royal-Kludge-R75> (GPL-3.0) by @snakkarike, with credit to @irfanjmdn.
  Modified here: SOCD off by default, first-input-wins mode, OpenRGB/SignalRGB removed, current QMK keycode names, all effects
  enabled, boot key, and the RK Lumen app link (`features/lumen_link.c`).
- **SOCD Cleaner** (`features/socd_cleaner.*`) — Apache-2.0, Copyright 2024 Google LLC, Pascal Getreuer —
  <https://getreuer.info/posts/keyboards/socd-cleaner>. Modified here to add the first-input-wins mode.
- The combined firmware is distributed under the **GPL** (`firmware/LICENSE`).

## Flashing tool (downloaded at flash time, not redistributed here)
- **wb32-dfu-updater** — Apache-2.0 — <https://github.com/WestberryTech/wb32-dfu-updater>
- **libusb** — LGPL-2.1 — <https://libusb.info>

## Trademarks
Royal Kludge, RK, Westberry, QMK and VIA are trademarks of their respective owners. This project is independent and unaffiliated.
