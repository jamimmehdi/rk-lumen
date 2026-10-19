# RK Lumen firmware for the Royal Kludge R75

Custom QMK firmware for the **R75 wired ANSI** (USB `342D:E484`, chip WB32FQ95, Westberry DFU bootloader). It is the community R75 firmware with SOCD off by default, extra SOCD modes, and a small control channel that the RK Lumen app uses.

> ## ⚠️ Read before flashing
> - Tested on **one** keyboard. Do **not** flash the ISO model (`342D:E483`), the R75 Pro, wireless/tri-mode boards or any other keyboard.
> - A failed or interrupted flash can leave the keyboard unresponsive. Don't unplug it while flashing.
> - **No hardware recovery button was found** on the tested unit. Recovery relies on the keyboard still booting so that **Fn + Right Shift + Esc** can open the bootloader. Treat this as irreversible-risk.
> - Flashing replaces your keymap and lighting settings. Back up first (RK Lumen → Keymap → Backup).
> - Custom firmware may void your warranty. Check the rules of the games you play before using SOCD.

## What changed compared with the stock firmware

| | |
| --- | --- |
| SOCD cleaner | W/S and A/D; modes: last wins, neutral, first wins, key 0/1 wins; **off after power-up** unless saved |
| App control | SOCD on/off + mode + key pairs, NKRO, Windows-key lock, active layer, "remember" (saved in EEPROM) |
| Layers | 6 (Base, Fn, Options, Mac, Numpad, spare) |
| Effects | All 44 QMK RGB Matrix effects enabled, same numbering as the app |
| Bootloader | **Fn + Right Shift + Esc** (as on the stock firmware); also triple-tap **Q** on the Options layer |
| Removed | OpenRGB / SignalRGB (needs a QMK fork; use the community firmware if you need them) |

### Keys (hold **Fn + Right Shift** for the Options layer)

| Key | Action |
| --- | --- |
| `T` | SOCD on / off |
| `Y` | Cycle SOCD mode (last → neutral → first) |
| `N` | N-key rollover on / off |
| `Esc` | Enter bootloader |
| triple-tap `Q` / `Z` | Bootloader / clear settings |
| `1` / `3` / `4` | Base / Mac / Numpad layer |

## Install the firmware

You need the release asset **`RK-Lumen-R75-firmware-1.0.0.zip`** (firmware `.bin`/`.hex`, checksums and the flash script) from the [latest release](https://github.com/jamimmehdi/rk-lumen/releases/latest).

1. Install the app and make a **keymap backup** (Keymap → Backup).
2. Unzip the firmware kit. Right-click `flash-firmware.ps1` → *Run with PowerShell* (or run it in a terminal).
   - It verifies the checksum, downloads the open-source flasher (pinned by SHA-256), then asks you to put the keyboard in **bootloader mode**: hold **Fn + Right Shift + Esc** for one second.
   - Windows needs a **WinUSB driver** for the bootloader device (`342D:DFA0`). If the script reports a missing driver, download Westberry's driver ZIP from <https://github.com/WestberryTech/wb32-dfu-updater/tree/master/driver>, run `winusb_install.bat` **as administrator**, then run the script again. The script never installs drivers itself.
   - Type `FLASH` to continue. The script saves a **backup of the current firmware** to `Documents\RKLumen-backup`, flashes without the dangerous `-t` option, **reads the flash back and compares it byte for byte**.
3. Unplug the keyboard, wait 3 seconds, plug it back in.
4. If keys look shifted or scrambled (the stored keymap layout changed), open RK Lumen → **Keymap → Reset to defaults**.
5. Open the **Gaming** page. It shows *RK Lumen custom v1* when the firmware is active.

### Going back

```powershell
.\flash-firmware.ps1 -Restore "$env:USERPROFILE\Documents\RKLumen-backup\R75-firmware-backup-YYYYMMDD-HHMMSS.bin"
```

The backup is the exact firmware that was on **your** keyboard. The original firmware is not published by Royal Kludge; the community project ships an identical copy of the R75's stock image as `Original Firmware.hex` ([Royal-Kludge-R75](https://github.com/snakkarike/Royal-Kludge-R75/tree/main/firmware)).

## Build it yourself

Ubuntu 24.04 / WSL:

```bash
sudo apt-get install -y gcc-arm-none-eabi binutils-arm-none-eabi libnewlib-arm-none-eabi python3-venv git
firmware/scripts/build-wsl.sh        # builds against QMK commit 180f394b…, never flashes
```

Output lands in `firmware/out/` (`RK-Lumen-R75-1.0.0.bin/.hex` + `SHA256SUMS.txt`). The release image was built with arm-none-eabi-gcc 13.2.1.

## Custom channel (for developers)

The firmware answers VIA custom-value commands on **channel 0** (`0x07` set, `0x08` get, `0x09` save), 32-byte raw HID reports on usage page `0xFF60`, usage `0x61`. Stock firmware answers `0xFF` (unhandled), which is how the app detects it.

| id | get | set |
| --- | --- | --- |
| `0x01` info | `[version, capability bits]` | – |
| `0x02` SOCD on | `[0/1]` | `[0/1]` |
| `0x03` / `0x04` SOCD mode V / H | `[mode]` | `[mode]` (0 off, 1 last, 2 neutral, 3 key0 wins, 4 key1 wins, 5 first) |
| `0x05` NKRO | `[0/1]` | `[0/1]` |
| `0x06` Windows-key lock | `[0/1]` | `[0/1]` |
| `0x07` layer | `[highest layer, layer mask]` | – |
| `0x08` / `0x09` SOCD keys V / H | `[key0, key1]` | `[key0, key1]` (HID basic keycodes) |
| save (`0x09`) | – | persists SOCD settings, NKRO and GUI lock |

Source: `keyboards/rk/r75/custom/keymaps/via/features/lumen_link.c`.

## Licence and credits

GPL (see [LICENSE](LICENSE) and [../NOTICE.md](../NOTICE.md)). Built on QMK, the community R75 keyboard definition by @sdk66 and @iamdanielv, the community R75 firmware project by @snakkarike, and Pascal Getreuer's SOCD Cleaner (Apache-2.0).
