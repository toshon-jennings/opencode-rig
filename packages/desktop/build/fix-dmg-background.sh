#!/usr/bin/env bash
# fix-dmg-background.sh — make a DMG background actually render on Apple Silicon
#
# WHY THIS EXISTS
# On arm64, `hdiutil` cannot create HFS+ disk images, so electron-builder falls
# back to APFS and says so:
#     "Detected arm64 process, HFS+ is unavailable. Creating dmg with APFS"
# electron-builder's ds-store library then writes a *classic HFS-style alias*
# into .DS_Store to point at the background image. On an APFS volume the HFS
# file/volume identifiers in that alias don't resolve, so Finder silently falls
# back to a plain grey window. No error, no warning — the DMG is structurally
# perfect and the background just never appears.
#
# The fix is to let Finder itself rewrite .DS_Store against the real APFS volume,
# which produces an alias valid for that volume.
#
# Usage:
#   ./fix-dmg-background.sh <dmg> [APP_NAME] [W] [H] [ICON_X] [ICON_Y] [APPS_X] [APPS_Y]
#
# Defaults are the house values from ~/.config/agent-rules/DMG.md.
# Requires: Finder automation permission for the terminal running this
# (System Settings > Privacy & Security > Automation).

set -euo pipefail

DMG="${1:?usage: $0 <dmg> [app-name] [w] [h] [icon_x] [icon_y] [apps_x] [apps_y]}"
APP="${2:-}"
W="${3:-540}"; H="${4:-380}"
IX="${5:-140}"; IY="${6:-225}"
AX="${7:-400}"; AY="${8:-225}"

[ -f "$DMG" ] || { echo "no such dmg: $DMG" >&2; exit 1; }
DMG=$(cd "$(dirname "$DMG")" && pwd)/$(basename "$DMG")

RW=$(mktemp -u /tmp/fixdmg-XXXXXX).dmg
cleanup() {
  [ -n "${VOL:-}" ] && hdiutil detach "$VOL" -quiet 2>/dev/null || true
  rm -f "$RW"
}
trap cleanup EXIT

echo "==> converting to read-write"
hdiutil convert "$DMG" -format UDRW -o "$RW" -quiet

echo "==> mounting"
VOL=$(hdiutil attach "$RW" -nobrowse -noautoopen | grep '/Volumes/' | sed 's/.*\(\/Volumes\/.*\)/\1/' | tail -1)
[ -n "$VOL" ] || { echo "mount failed" >&2; exit 1; }
NAME=$(basename "$VOL")
echo "    volume: $NAME"

BG=$(ls "$VOL/.background/" 2>/dev/null | head -1)
[ -n "$BG" ] || { echo "no .background/ in volume - nothing to fix" >&2; exit 1; }
echo "    background asset: $BG"
case "$BG" in
  *.tiff) echo "    NOTE: multi-rep .tiff backgrounds are unreliable in Finder;"
          echo "          prefer a single PNG at exactly ${W}x${H}." ;;
esac

# Find the .app if not supplied.
if [ -z "$APP" ]; then
  APP=$(ls "$VOL" | grep '\.app$' | head -1)
fi
[ -n "$APP" ] || { echo "could not find an .app in the volume" >&2; exit 1; }
echo "    app: $APP"

# Finder wants bounds as {left, top, right, bottom} in screen coords.
L=400; T=120; R=$((L + W)); B=$((T + H))

echo "==> handing off to Finder"
osascript <<EOF >/dev/null
tell application "Finder"
  tell disk "$NAME"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {$L, $T, $R, $B}
    set vo to the icon view options of container window
    set arrangement of vo to not arranged
    set icon size of vo to 100
    set background picture of vo to file ".background:$BG"
    set position of item "$APP" of container window to {$IX, $IY}
    set position of item "Applications" of container window to {$AX, $AY}
    close
    open
    update without registering applications
    delay 2
    close
  end tell
end tell
EOF

sync; sleep 1

# Confirm Finder actually wrote a background record before we repack.
python3 - "$VOL/.DS_Store" <<'PY'
import plistlib, re, sys
data = open(sys.argv[1], "rb").read()
for s in [m.start() for m in re.finditer(b"bplist00", data)]:
    blob = data[s:]
    pl = None
    for t in range(len(blob), 60, -1):
        try:
            pl = plistlib.loads(blob[:t])
            if isinstance(pl, dict):
                break
        except Exception:
            pl = None
    if pl and "backgroundImageAlias" in pl:
        print(f"    backgroundType={pl.get('backgroundType')} "
              f"alias={len(pl['backgroundImageAlias'])} bytes  (Finder-written)")
        sys.exit(0)
print("    WARNING: Finder did not write a background alias", file=sys.stderr)
sys.exit(1)
PY

echo "==> repacking"
hdiutil detach "$VOL" -quiet; VOL=""
TMP_OUT=$(mktemp -u /tmp/fixdmg-out-XXXXXX).dmg
hdiutil convert "$RW" -format UDZO -o "$TMP_OUT" -quiet
mv -f "$TMP_OUT" "$DMG"

echo
echo "done: $DMG"
echo "Mount it and toggle Light/Dark with the window open."
