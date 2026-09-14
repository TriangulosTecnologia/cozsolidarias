#!/usr/bin/env python3
"""
color_tools.py — Color tooling for the branding-studio skill.

Functions:
  - sRGB (hex) <-> OKLab / OKLCH conversion (Björn Ottosson)
  - WCAG 2.x contrast (luminance ratio) — accessibility conformance baseline
  - APCA/Lc contrast (APCA-W3 0.1.9 constants, SAPC-4g) — perceptual quality signal
  - OKLCH tonal-scale generation targeting contrast ratios (Leonardo-style logic:
    binary search on L; contrast is monotonic in L for fixed hue/chroma)
  - Gamut clamp via chroma reduction

WCAG is not described here as a universal legal requirement; applicable law varies
by jurisdiction and context.

CLI usage:
  python color_tools.py contrast '#1a1a1a' '#ffffff'
  python color_tools.py scale '#2563EB' --bg '#ffffff'
  python color_tools.py inspect '#2563EB'
"""
import json
import math
import sys


def hex_to_rgb(hexstr):
    h = hexstr.strip().lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    if len(h) != 6:
        raise ValueError(f"invalid hex: {hexstr!r}")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return '#' + ''.join(f'{max(0, min(255, round(c * 255))):02x}' for c in rgb)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def linear_rgb_to_oklab(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (x ** (1 / 3) if x >= 0 else -((-x) ** (1 / 3)) for x in (l, m, s))
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )


def oklab_to_linear_rgb(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )


def hex_to_oklch(hexstr):
    r, g, b = (srgb_to_linear(c) for c in hex_to_rgb(hexstr))
    L, a, b2 = linear_rgb_to_oklab(r, g, b)
    C = math.hypot(a, b2)
    H = math.degrees(math.atan2(b2, a)) % 360
    return (L, C, H)


def oklch_in_gamut(L, C, H):
    a = C * math.cos(math.radians(H))
    b = C * math.sin(math.radians(H))
    rgb = oklab_to_linear_rgb(L, a, b)
    return all(-1e-4 <= c <= 1 + 1e-4 for c in rgb)


def oklch_to_hex(L, C, H, clamp_chroma=True):
    """OKLCH -> sRGB hex. If out of gamut, reduce chroma by bisection."""
    if clamp_chroma and not oklch_in_gamut(L, C, H):
        lo, hi = 0.0, C
        for _ in range(32):
            mid = (lo + hi) / 2
            if oklch_in_gamut(L, mid, H):
                lo = mid
            else:
                hi = mid
        C = lo
    a = C * math.cos(math.radians(H))
    b = C * math.sin(math.radians(H))
    rgb_lin = oklab_to_linear_rgb(L, a, b)
    return rgb_to_hex(tuple(linear_to_srgb(c) for c in rgb_lin))


def wcag_luminance(hexstr):
    r, g, b = (srgb_to_linear(c) for c in hex_to_rgb(hexstr))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def wcag_ratio(fg, bg):
    l1, l2 = sorted((wcag_luminance(fg), wcag_luminance(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


WCAG_MIN = {"body": 4.5, "large": 3.0, "ui": 3.0}


_APCA = dict(
    exp=2.4, rco=0.2126729, gco=0.7151522, bco=0.0721750,
    blkThrs=0.022, blkClmp=1.414,
    normBG=0.56, normTXT=0.57, revBG=0.65, revTXT=0.62,
    scale=1.14, loClip=0.1, deltaYmin=0.0005, loOffset=0.027,
)


def _apca_y(hexstr):
    r, g, b = hex_to_rgb(hexstr)
    y = (_APCA['rco'] * r ** _APCA['exp'] + _APCA['gco'] * g ** _APCA['exp']
         + _APCA['bco'] * b ** _APCA['exp'])
    if y < _APCA['blkThrs']:
        y += (_APCA['blkThrs'] - y) ** _APCA['blkClmp']
    return y


def apca_lc(fg, bg):
    """Lc of text fg over background bg. Sign indicates polarity."""
    ytx, ybg = _apca_y(fg), _apca_y(bg)
    if abs(ybg - ytx) < _APCA['deltaYmin']:
        return 0.0
    if ybg > ytx:
        sapc = (ybg ** _APCA['normBG'] - ytx ** _APCA['normTXT']) * _APCA['scale']
        lc = 0.0 if sapc < _APCA['loClip'] else sapc - _APCA['loOffset']
    else:
        sapc = (ybg ** _APCA['revBG'] - ytx ** _APCA['revTXT']) * _APCA['scale']
        lc = 0.0 if sapc > -_APCA['loClip'] else sapc + _APCA['loOffset']
    return lc * 100


APCA_MIN = {"body": 60, "large": 45, "ui": 45, "minimum": 30, "non_text": 15}


def solve_l_for_wcag(target_ratio, hue, chroma, bg_hex, damp=True):
    """Binary search on L (OKLCH) to hit a target WCAG ratio against bg."""
    bg_lum = wcag_luminance(bg_hex)

    def ratio_at(L):
        c = chroma * math.sin(math.pi * L) if damp else chroma
        h = oklch_to_hex(L, c, hue)
        return wcag_ratio(h, bg_hex), h

    darker_needed = bg_lum > 0.5
    lo, hi = (0.0, 1.0)
    best = None
    for _ in range(28):
        mid = (lo + hi) / 2
        r, h = ratio_at(mid)
        best = (r, h, mid)
        if (r < target_ratio) == darker_needed:
            hi = mid
        else:
            lo = mid
    return best


def generate_scale(seed_hex, bg_hex='#ffffff',
                   targets=(1.1, 1.3, 1.8, 3.0, 4.5, 7.0, 10.0, 13.0)):
    """Generate a tonal scale preserving seed hue and targeting contrast ratios."""
    L0, C0, H0 = hex_to_oklch(seed_hex)
    out = []
    for i, target in enumerate(targets, start=1):
        ratio, h, L = solve_l_for_wcag(target, H0, max(C0, 0.02), bg_hex)
        out.append({
            "step": i * 100,
            "hex": h,
            "oklch": {"L": round(L, 4), "C_seed": round(C0, 4), "H": round(H0, 2)},
            "wcag_vs_bg": round(ratio, 2),
            "apca_lc_vs_bg": round(apca_lc(h, bg_hex), 1),
        })
    return {"seed": seed_hex, "background": bg_hex, "scale": out}


def check_pair(fg, bg, usage="body"):
    ratio = wcag_ratio(fg, bg)
    lc = apca_lc(fg, bg)
    return {
        "text": fg,
        "background": bg,
        "usage": usage,
        "wcag_ratio": round(ratio, 2),
        "wcag_aa": ratio >= WCAG_MIN.get(usage, 4.5),
        "apca_lc": round(lc, 1),
        "apca_ok": abs(lc) >= APCA_MIN.get(usage, 60),
        "note": (
            "WCAG 2.x is used here as an accessibility conformance baseline; "
            "APCA/Lc is reported as a perceptual quality signal. Applicable legal requirements vary."
        ),
    }


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)
    cmd = args[0]
    if cmd == 'contrast':
        usage = args[3] if len(args) > 3 else 'body'
        print(json.dumps(check_pair(args[1], args[2], usage), indent=2, ensure_ascii=False))
    elif cmd == 'scale':
        bg = '#ffffff'
        if '--bg' in args:
            bg = args[args.index('--bg') + 1]
        print(json.dumps(generate_scale(args[1], bg), indent=2, ensure_ascii=False))
    elif cmd == 'inspect':
        L, C, H = hex_to_oklch(args[1])
        print(json.dumps({
            "hex": args[1],
            "oklch": {"L": round(L, 4), "C": round(C, 4), "H": round(H, 2)},
            "wcag_luminance": round(wcag_luminance(args[1]), 4)
        }, indent=2))
    else:
        print(f"unknown command: {cmd}")
        sys.exit(1)
