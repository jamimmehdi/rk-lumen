#!/usr/bin/env bash
# Builds the RK Lumen R75 firmware with official QMK. Tested on Ubuntu 24.04 (WSL) with gcc-arm-none-eabi 13.2.
# Usage: firmware/scripts/build-wsl.sh        (never flashes anything)
set -euo pipefail

QMK_COMMIT="180f394b489c238cb231c2bf8b080262155e03c0"   # official qmk_firmware commit this firmware was built against
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${QMK_WORK:-$HOME/qmk}"

if ! command -v arm-none-eabi-gcc >/dev/null; then
  echo "Install the toolchain first:  sudo apt-get install -y gcc-arm-none-eabi binutils-arm-none-eabi libnewlib-arm-none-eabi python3-venv git" >&2
  exit 1
fi

mkdir -p "$WORK"
if [ ! -d "$WORK/official" ]; then
  git clone https://github.com/qmk/qmk_firmware.git "$WORK/official"
fi
cd "$WORK/official"
git fetch --quiet origin "$QMK_COMMIT" 2>/dev/null || git fetch --quiet origin
git checkout --quiet "$QMK_COMMIT"
git submodule update --init --recursive --depth 1

[ -d "$WORK/venv" ] || python3 -m venv "$WORK/venv"
# shellcheck disable=SC1091
. "$WORK/venv/bin/activate"
pip -q install qmk

rm -rf keyboards/rk/r75/custom
mkdir -p keyboards/rk/r75
cp -r "$HERE/keyboards/rk/r75/custom" keyboards/rk/r75/custom

export QMK_HOME="$PWD"
qmk compile -kb rk/r75/custom -km via

mkdir -p "$HERE/out"
cp .build/rk_r75_custom_via.bin "$HERE/out/RK-Lumen-R75-1.0.0.bin"
cp .build/rk_r75_custom_via.hex "$HERE/out/RK-Lumen-R75-1.0.0.hex"
( cd "$HERE/out" && sha256sum RK-Lumen-R75-1.0.0.bin RK-Lumen-R75-1.0.0.hex | tee SHA256SUMS.txt )
echo "Built into $HERE/out"
