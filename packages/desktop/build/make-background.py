#!/usr/bin/env python3
"""Generate the DMG background artwork for OpenCode Rig.

Emits background.svg, background.png (540x380) and retina-src/background@2x.png.
Only background.png is referenced by electron-builder — see DMG-ARTWORK-BRIEF.md
for why the @2x file must stay out of buildResources.

    python3 packages/desktop/build/make-background.py
"""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
W, H = 540, 380

# Sampled from assets/og-image.html and assets/logo-rig-dark.svg. Not invented.
BG_TOP = "#1D1A19"
BG_BOT = "#121010"
SILVER = "#B7B1B1"
PLATE_TOP = "#C4BDBA"
PLATE_BOT = "#9C9592"
BLOCK_UP = "#C4BDBA"
BLOCK_DOWN = "#9C9592"
AMBER = "#FAB283"
INK = "#5E3A21"  # dark amber — reads as inverted terminal ink on the plate
ACCENTS = ["#7FD88F", "#56B6C2", "#9D7CD8", "#FAB283"]

# The plate: icons at y=175..275, labels at ~278..295. Solid core covers both.
CORE_TOP, CORE_BOT = 160, 304
U = 6  # the brand's pixel unit, from the wordmark

# "opencode" wordmark, lifted verbatim from assets/logo-rig-dark.svg. The trailing
# cursor rect is dropped here and redrawn in amber after RIG.
WORDMARK = """
<path d="M18 30H6V18H18V30Z" fill="#4B4646"/>
<path d="M18 12H6V30H18V12ZM24 36H0V6H24V36Z" fill="#B7B1B1"/>
<path d="M48 30H36V18H48V30Z" fill="#4B4646"/>
<path d="M36 30H48V12H36V30ZM54 36H36V42H30V6H54V36Z" fill="#B7B1B1"/>
<path d="M84 24V30H66V24H84Z" fill="#4B4646"/>
<path d="M84 24H66V30H84V36H60V6H84V24ZM66 18H78V12H66V18Z" fill="#B7B1B1"/>
<path d="M108 36H96V18H108V36Z" fill="#4B4646"/>
<path d="M108 12H96V36H90V6H108V12ZM114 36H108V12H114V36Z" fill="#B7B1B1"/>
<path d="M144 30H126V18H144V30Z" fill="#4B4646"/>
<path d="M144 12H126V30H144V36H120V6H144V12Z" fill="#F1ECEC"/>
<path d="M168 30H156V18H168V30Z" fill="#4B4646"/>
<path d="M168 12H156V30H168V12ZM174 36H150V6H174V36Z" fill="#F1ECEC"/>
<path d="M198 30H186V18H198V30Z" fill="#4B4646"/>
<path d="M198 12H186V30H198V12ZM204 36H180V6H198V0H204V36Z" fill="#F1ECEC"/>
<path d="M234 24V30H216V24H234Z" fill="#4B4646"/>
<path d="M216 12V18H228V12H216ZM234 24H216V30H234V36H210V6H234V24Z" fill="#F1ECEC"/>
"""

# RIG, traced off assets/og-image.png at the same 6-unit grid as the wordmark.
GLYPHS = {
    "R": ["1111", "1001", "1111", "1010", "1001"],
    "I": ["111", "010", "010", "010", "111"],
    "G": ["1111", "1000", "1011", "1001", "1111"],
}

# ❯ — the install direction, drawn in the brand's own pixel unit.
CHEVRON = [
    "110000",
    "011000",
    "001100",
    "000110",
    "000011",
    "000110",
    "001100",
    "011000",
    "110000",
]


def bitmap(rows, x0, y0, fill, unit=U, opacity=None):
    op = "" if opacity is None else f' opacity="{opacity}"'
    out = []
    for r, row in enumerate(rows):
        c = 0
        while c < len(row):
            if row[c] == "1":
                run = 1
                while c + run < len(row) and row[c + run] == "1":
                    run += 1
                out.append(
                    f'<rect x="{x0 + c * unit}" y="{y0 + r * unit}" '
                    f'width="{run * unit}" height="{unit}" fill="{fill}"{op}/>'
                )
                c += run
            else:
                c += 1
    return "\n".join(out)


def rig_lockup():
    """opencode + RIG + cursor, in wordmark units. Returns (svg, width)."""
    parts = [WORDMARK]
    x = 234 + 3 * U  # word space after "opencode"
    for ch in "RIG":
        rows = GLYPHS[ch]
        parts.append(bitmap(rows, x, 6, AMBER))
        x += len(rows[0]) * U + U
    x += U  # the cursor sits two cells clear of the G
    parts.append(f'<rect x="{x}" y="30" width="{3 * U}" height="{U}" fill="{AMBER}"/>')
    return "\n".join(parts), x + 3 * U


def codelines(x0):
    """Three dim, out-of-focus lines of syntax-coloured blocks under the wordmark.

    Echoes the tagline in assets/og-image.png without setting any type that could
    go stale. Cell runs, in the same 6-unit grid as everything else.
    """
    lines = [
        [(3, SILVER, 0.16), (5, "#56B6C2", 0.22), (4, SILVER, 0.16), (7, "#7FD88F", 0.20), (2, SILVER, 0.12)],
        [(2, SILVER, 0.12), (6, "#9D7CD8", 0.20), (3, SILVER, 0.16), (5, SILVER, 0.10), (4, "#56B6C2", 0.16)],
        [(4, SILVER, 0.14), (3, AMBER, 0.20), (6, SILVER, 0.10)],
    ]
    out = []
    for row, runs in enumerate(lines):
        x = x0
        for cells, color, op in runs:
            out.append(
                f'<rect x="{x}" y="{98 + row * 12}" width="{cells * U}" height="{U}" '
                f'fill="{color}" opacity="{op}"/>'
            )
            x += (cells + 1) * U
    return "\n".join(out)


def dissolve():
    """Break the plate's edges into pixels instead of a drawn rectangle.

    An ordered 1/2 -> 1/4 -> 1/8 dither ramp, not a random scatter. Random reads
    as a torn edge; the ordered ramp reads as a deliberate 1-bit fade, which is
    the right register for a wordmark built out of 6px blocks.
    """
    rows = [
        (CORE_TOP - U, 2, 0, BLOCK_UP, 0.95),
        (CORE_TOP - 2 * U, 4, 1, BLOCK_UP, 0.70),
        (CORE_TOP - 3 * U, 8, 3, BLOCK_UP, 0.45),
        (CORE_BOT, 2, 1, BLOCK_DOWN, 0.95),
        (CORE_BOT + U, 4, 2, BLOCK_DOWN, 0.70),
        (CORE_BOT + 2 * U, 8, 6, BLOCK_DOWN, 0.45),
    ]
    out = []
    for y, step, phase, fill, op in rows:
        for col in range(W // U):
            if col % step == phase:
                out.append(
                    f'<rect x="{col * U}" y="{y}" width="{U}" height="{U}" '
                    f'fill="{fill}" opacity="{op}"/>'
                )
    return "\n".join(out)


def build():
    lockup, lockup_w = rig_lockup()
    scale = 2 / 3  # every wordmark coordinate is a multiple of 6, so edges stay integral
    lock_x = round((W - lockup_w * scale) / 2)

    # ❯ then the block cursor stepping right toward /Applications.
    chev_x, chev_y = 208, 225 - (len(CHEVRON) * U) // 2
    cursors = "\n".join(
        f'<rect x="{x}" y="213" width="{2 * U}" height="{4 * U}" fill="{INK}" opacity="{op}"/>'
        for x, op in ((250, 0.62), (274, 0.36), (298, 0.20), (322, 0.10))
    )

    # The accent rule from assets/og-image.html, fading out to the right.
    rule_w, rule_y = 192, 346
    rule_x = (W - rule_w) // 2
    stops = "".join(
        f'<stop offset="{i / (len(ACCENTS) - 1):.3f}" stop-color="{c}"/>'
        for i, c in enumerate(ACCENTS)
    )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{BG_TOP}"/>
    <stop offset="1" stop-color="{BG_BOT}"/>
  </linearGradient>
  <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{PLATE_TOP}"/>
    <stop offset="1" stop-color="{PLATE_BOT}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.74" cy="0.61" r="0.52">
    <stop offset="0" stop-color="{AMBER}" stop-opacity="0.16"/>
    <stop offset="1" stop-color="{AMBER}" stop-opacity="0"/>
  </radialGradient>
  <pattern id="gridlight" width="18" height="18" patternUnits="userSpaceOnUse">
    <path d="M18 0H0V18" fill="none" stroke="#FFFFFF" stroke-opacity="0.035" stroke-width="1"/>
  </pattern>
  <pattern id="griddark" width="18" height="18" patternUnits="userSpaceOnUse">
    <path d="M18 0H0V18" fill="none" stroke="#000000" stroke-opacity="0.05" stroke-width="1"/>
  </pattern>
  <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">{stops}</linearGradient>
  <linearGradient id="rulefade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/>
    <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <mask id="rulemask">
    <rect x="{rule_x}" y="{rule_y}" width="{rule_w}" height="3" fill="url(#rulefade)"/>
  </mask>
  <!-- Feathers the plate off the left and right frame edges so it reads as a lit
       area rather than a UI panel. Clear of both icons (x=90..190, x=350..450). -->
  <linearGradient id="platefade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.085" stop-color="#FFFFFF" stop-opacity="1"/>
    <stop offset="0.915" stop-color="#FFFFFF" stop-opacity="1"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <mask id="platemask">
    <rect x="0" y="{CORE_TOP - 3 * U}" width="{W}" height="{CORE_BOT - CORE_TOP + 6 * U}" fill="url(#platefade)"/>
  </mask>
</defs>

<rect width="{W}" height="{H}" fill="url(#bg)"/>
<rect width="{W}" height="{H}" fill="url(#gridlight)"/>

<!-- the plate: a selected line, inverted out of the terminal field -->
<g mask="url(#platemask)">
  <rect x="0" y="{CORE_TOP}" width="{W}" height="{CORE_BOT - CORE_TOP}" fill="url(#plate)"/>
  {dissolve()}
  <rect x="0" y="{CORE_TOP}" width="{W}" height="{CORE_BOT - CORE_TOP}" fill="url(#griddark)"/>
</g>

<rect width="{W}" height="{H}" fill="url(#glow)"/>

<!-- ❯ and the cursor stepping toward /Applications -->
{bitmap(CHEVRON, chev_x, chev_y, INK)}
{cursors}

<g transform="translate({lock_x},46) scale({scale})">
{lockup}
</g>
{codelines(lock_x)}

<g mask="url(#rulemask)">
  <rect x="{rule_x}" y="{rule_y}" width="{rule_w}" height="3" fill="url(#rule)"/>
</g>
</svg>
"""

    (HERE / "background.svg").write_text(svg)

    try:
        import cairosvg
    except ImportError:
        sys.exit("cairosvg not installed: pip3 install cairosvg")

    cairosvg.svg2png(
        bytestring=svg.encode(), write_to=str(HERE / "background.png"),
        output_width=W, output_height=H,
    )
    retina = HERE / "retina-src"
    retina.mkdir(exist_ok=True)
    cairosvg.svg2png(
        bytestring=svg.encode(), write_to=str(retina / "background@2x.png"),
        output_width=W * 2, output_height=H * 2,
    )
    # cairosvg writes 96dpi; Finder wants 72dpi for a 540x380 point window.
    subprocess.run(
        ["sips", "-s", "dpiWidth", "72", "-s", "dpiHeight", "72", str(HERE / "background.png")],
        check=True, capture_output=True,
    )
    print(f"wrote {HERE / 'background.png'} ({W}x{H})")


if __name__ == "__main__":
    build()
