#!/usr/bin/env python3
"""Repoint latest-mac.yml at a DMG whose bytes changed after packaging.

fix-dmg-background.sh rewrites .DS_Store inside the DMG so Finder can resolve the
background alias, which changes the file. The sha512 and size electron-builder
recorded while publishing no longer describe it.

electron-updater resolves macOS updates through the .zip named by the top-level
`path:`, so a stale DMG entry would not actually break updating — but a manifest
that lies about a file it lists is a trap for whoever reads it next, and the correct
values are two lines of arithmetic away.

Only the matching entry is touched, and nothing is written unless exactly one entry
matched — a silent no-op here would put a wrong hash on a real release.

    python3 refresh-update-feed.py dist/latest-mac.yml dist/opencode-desktop-mac-arm64.dmg
"""

import hashlib
import os
import re
import sys


def digest(path):
    h = hashlib.sha512()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    import base64
    return base64.b64encode(h.digest()).decode()


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__.strip().splitlines()[-1].strip())
    feed, artifact = sys.argv[1], sys.argv[2]
    name = os.path.basename(artifact)

    sha512 = digest(artifact)
    size = os.path.getsize(artifact)

    lines = open(feed).read().splitlines(keepends=True)

    # The entry looks like:
    #   - url: opencode-desktop-mac-arm64.dmg
    #     sha512: <base64>
    #     size: <bytes>
    starts = [i for i, l in enumerate(lines) if re.match(rf"\s*-\s+url:\s+{re.escape(name)}\s*$", l)]
    if len(starts) != 1:
        sys.exit(f"expected exactly one '- url: {name}' entry in {feed}, found {len(starts)}")

    i = starts[0]
    replaced = set()
    for j in range(i + 1, len(lines)):
        if re.match(r"\s*-\s+url:", lines[j]) or not lines[j].startswith(" "):
            break
        for key, value in (("sha512", sha512), ("size", size)):
            m = re.match(rf"(\s*){key}:\s+.*$", lines[j])
            if m:
                lines[j] = f"{m.group(1)}{key}: {value}\n"
                replaced.add(key)

    missing = {"sha512", "size"} - replaced
    if missing:
        sys.exit(f"did not find {', '.join(sorted(missing))} under '{name}' in {feed}")

    open(feed, "w").write("".join(lines))
    print(f"{feed}: {name} -> sha512 {sha512[:16]}... size {size}")


if __name__ == "__main__":
    main()
