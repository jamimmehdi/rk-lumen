# Releasing

The installed app updates itself from GitHub Releases (`electron-updater`). For that to work every release must include the
update manifest and the installer's block map next to the installer.

1. Bump `version` in `package.json` (semver; the updater only offers versions greater than the installed one).
2. `npm ci && npm run dist` — produces in `release/`:
   - `RK-Lumen-<version>-x64.exe` (installer) and `RK-Lumen-<version>-x64.exe.blockmap`
   - `RK-Lumen-<version>-x64.zip` (portable; not self-updating)
   - `latest.yml` (version + SHA-512 of the installer — **required for in-app updates**)
3. Create the GitHub release **as a normal (non-draft, non-prerelease) release** and attach all of: the `.exe`, the `.exe.blockmap`,
   `latest.yml`, the portable `.zip`, the firmware kit (if changed) and a `SHA256SUMS.txt`:

   ```bash
   gh release create vX.Y.Z release/RK-Lumen-X.Y.Z-x64.exe release/RK-Lumen-X.Y.Z-x64.exe.blockmap release/latest.yml \
     release/RK-Lumen-X.Y.Z-x64.zip SHA256SUMS.txt --title "RK Lumen X.Y.Z" --notes-file notes.md --latest
   ```

   The release notes are shown inside the app before the user downloads.
4. Never edit or replace an uploaded installer after publishing: `latest.yml` pins its hash and clients will refuse a mismatch.

Notes
- The installer is unsigned, so the updater verifies integrity through the SHA-512 in `latest.yml` (served over HTTPS from GitHub).
- Firmware is **not** part of in-app updates. Publish firmware kits separately and say so in the notes.
- Local test of the update flow without GitHub: set `LUMEN_UPDATE_URL=http://127.0.0.1:<port>` (loopback only) and serve a folder containing a newer build's `latest.yml` + installer.
