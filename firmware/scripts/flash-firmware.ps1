<#
.SYNOPSIS
  Safely flashes the RK Lumen firmware to a Royal Kludge R75 (wired ANSI, USB 342D:E484).

.DESCRIPTION
  1. Verifies the firmware file against SHA256SUMS.
  2. Downloads Westberry's wb32-dfu-updater_cli (pinned by SHA-256) into %LOCALAPPDATA%\RKLumen\flasher.
  3. Waits for the keyboard in bootloader (DFU) mode.
  4. Saves a full backup of the firmware currently on the keyboard to Documents\RKLumen-backup.
  5. Flashes the image, reads it back and compares it byte for byte.

  The script NEVER uses the tool's -t option (it can erase the chip by disabling read protection).
  It does not install drivers or change system settings.

.EXAMPLE
  .\flash-firmware.ps1                       # flash the bundled RK-Lumen-R75-1.0.0.bin
  .\flash-firmware.ps1 -Restore backup.bin   # flash a previous backup (e.g. to go back to the original)
  .\flash-firmware.ps1 -CheckOnly            # verify files and tools, touch nothing on the keyboard
#>
[CmdletBinding()]
param(
  [string]$Firmware,
  [string]$Restore,
  [switch]$CheckOnly,
  [switch]$SkipBackup
)
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Firmware) { $Firmware = Join-Path $Here 'RK-Lumen-R75-1.0.0.bin' }

# ---- pinned downloads (MSYS2 package repository; contents verified by SHA-256) ----
$Base = 'https://repo.msys2.org/mingw/mingw64'
$Pkgs = @(
  @{ Name = 'mingw-w64-x86_64-wb32-dfu-updater-1.0.0-2-any.pkg.tar.zst'; Sha = '6ed13916107c7d59cfa18f10efee97916a2200e18229c8c4f8c2b60ac4fc7131' },
  @{ Name = 'mingw-w64-x86_64-libusb-1.0.30-1-any.pkg.tar.zst';          Sha = '124edc26b009678a4c5e759481a364abf63ed7f2f49a53092e8bd0a47c0c0740' }
)
$Home_ = Join-Path $env:LOCALAPPDATA 'RKLumen\flasher'
$Exe = Join-Path $Home_ 'mingw64\bin\wb32-dfu-updater_cli.exe'
$ExpectedUsb = 'VID_342D&PID_DFA0'

function Sha256([string]$p) { (Get-FileHash -Algorithm SHA256 -LiteralPath $p).Hash.ToLower() }
function Say([string]$m, [string]$c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Fail([string]$m) { Write-Host "`nSTOP: $m" -ForegroundColor Red; exit 1 }

# ---- 1. choose and verify the image ----
$Image = if ($Restore) { (Resolve-Path -LiteralPath $Restore).Path } else { $Firmware }
if (-not (Test-Path -LiteralPath $Image)) { Fail "Firmware file not found: $Image" }
$bytes = [IO.File]::ReadAllBytes($Image)
if ($bytes.Length -lt 4096 -or $bytes.Length -gt 262144) { Fail "Unexpected image size ($($bytes.Length) bytes). Expected 4 KB - 256 KB." }
$sp = [BitConverter]::ToUInt32($bytes, 0)
if (($sp -band 0xFFF00000) -ne 0x20000000) { Fail "This does not look like a firmware image for this chip (bad initial stack pointer 0x$($sp.ToString('x')))." }
if (-not $Restore) {
  $sums = Join-Path (Split-Path $Image) 'SHA256SUMS.txt'
  if (Test-Path $sums) {
    $line = Get-Content $sums | Where-Object { $_ -match [regex]::Escape((Split-Path $Image -Leaf)) } | Select-Object -First 1
    if (-not $line) { Fail 'The image is not listed in SHA256SUMS.txt.' }
    if ($line.Split(' ')[0].ToLower() -ne (Sha256 $Image)) { Fail 'SHA-256 mismatch: the firmware file is corrupted or modified. Download it again.' }
    Say 'Firmware checksum OK.' 'Green'
  } else { Say 'No SHA256SUMS.txt next to the image - skipping checksum check.' 'Yellow' }
}
Say ("Image: {0}  ({1:N0} bytes)" -f $Image, $bytes.Length)

# ---- 2. flasher tool ----
if (-not (Test-Path $Exe)) {
  Say 'Downloading the Westberry DFU flasher (open source, Apache-2.0) ...'
  New-Item -ItemType Directory -Force $Home_ | Out-Null
  foreach ($p in $Pkgs) {
    $f = Join-Path $Home_ $p.Name
    Invoke-WebRequest -Uri "$Base/$($p.Name)" -OutFile $f -UseBasicParsing
    if ((Sha256 $f) -ne $p.Sha) { Remove-Item $f -Force; Fail "Downloaded $($p.Name) does not match its pinned checksum." }
    & "$env:SystemRoot\System32\tar.exe" -xf $f -C $Home_
    if ($LASTEXITCODE -ne 0) { Fail 'Could not extract the package (Windows tar with zstd support is required: Windows 10 1803+ / 11).' }
  }
}
if (-not (Test-Path $Exe)) { Fail 'Flasher executable missing after extraction.' }
Say 'Flasher ready.' 'Green'
if ($CheckOnly) { Say "`nCheck finished. Nothing was written to the keyboard." 'Green'; exit 0 }

# ---- 3. wait for DFU mode ----
Say "`nPut the keyboard in bootloader mode: with the cable plugged in, hold Fn + Right Shift + Esc together for 1 second."
Say 'The keyboard stops typing - that is expected. Waiting up to 90 seconds ...'
$found = $false
for ($i = 0; $i -lt 45; $i++) {
  $out = & $Exe --list 2>&1 | Out-String
  if ($out -match 'Found DFU') { $found = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $found) {
  $dev = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match $ExpectedUsb }
  if ($dev -and $dev.Status -ne 'OK') { Fail "The keyboard is in bootloader mode but Windows has no driver for it. Install the WinUSB driver from Westberry's repo (driver\wb32-dfu-updater_cli-driver-windows-x64.zip -> run winusb_install.bat as administrator) and run this script again." }
  Fail 'No keyboard found in bootloader mode.'
}
Say 'Keyboard found in bootloader mode.' 'Green'

# ---- 4. confirm ----
Say "`nAbout to write $(Split-Path $Image -Leaf) to the keyboard." 'Yellow'
Say 'Flashing can leave a keyboard unusable if interrupted. Do not unplug it or let the PC sleep during the process.' 'Yellow'
$ans = Read-Host "Type FLASH to continue"
if ($ans -cne 'FLASH') { Fail 'Cancelled. Nothing was written. Unplug and replug the keyboard to leave bootloader mode.' }

# ---- 5. backup ----
if (-not $SkipBackup) {
  $dir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RKLumen-backup'
  New-Item -ItemType Directory -Force $dir | Out-Null
  $bak = Join-Path $dir ("R75-firmware-backup-{0:yyyyMMdd-HHmmss}.bin" -f (Get-Date))
  Say "Saving a backup of the current firmware to $bak ..."
  & $Exe -s 0x08000000 -Z 262144 -U $bak 2>&1 | Out-Null
  $ok = (Test-Path $bak) -and ((Get-Item $bak).Length -eq 262144) -and ([IO.File]::ReadAllBytes($bak) | Where-Object { $_ -ne 0 -and $_ -ne 255 } | Select-Object -First 1) -ne $null
  if (-not $ok) {
    Say 'The backup could not be read (the chip may be read-protected).' 'Yellow'
    if ((Read-Host 'Continue without a backup? Type YES') -cne 'YES') { Fail 'Cancelled. Nothing was written.' }
  } else { Say 'Backup saved. Keep this file: you can restore it with -Restore.' 'Green' }
}

# ---- 6. flash + verify ----
Say "`nFlashing (do not unplug) ..."
& $Exe -s 0x08000000 -D $Image 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { Fail 'The flasher reported an error. Do NOT unplug: run this script again.' }
$tmp = Join-Path $env:TEMP 'rklumen-readback.bin'
& $Exe -s 0x08000000 -Z 262144 -U $tmp 2>&1 | Out-Null
$rb = [IO.File]::ReadAllBytes($tmp)
for ($i = 0; $i -lt $bytes.Length; $i++) {
  if ($rb[$i] -ne $bytes[$i]) { Fail "Verification FAILED at byte $i. Do NOT unplug: run this script again." }
}
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Say "`nVerified: the keyboard's flash matches the image byte for byte." 'Green'
Say 'Now unplug the keyboard, wait 3 seconds and plug it back in.'
Say 'If the keys look shifted or scrambled afterwards, open RK Lumen -> Keymap -> "Reset to defaults".' 'Yellow'
