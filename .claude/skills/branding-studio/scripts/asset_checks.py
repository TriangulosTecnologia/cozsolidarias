#!/usr/bin/env python3
"""
asset_checks.py — deterministic production checks for SVG brand masters.

Checks only machine-observable SVG properties. It does not judge whether the logo
is strategically or aesthetically good.

Usage:
    python asset_checks.py path/to/logo.svg

Exit 0 = no blocking production-structure failures.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET


XLINK_NS = "http://www.w3.org/1999/xlink"


def _strip_ns(tag):
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse_length(value):
    if not isinstance(value, str):
        return None
    m = re.fullmatch(r"\s*([0-9]*\.?[0-9]+)\s*(px|pt|pc|mm|cm|in)?\s*", value)
    return float(m.group(1)) if m else None


def inspect_svg(path):
    failures, warnings, passed = [], [], []

    try:
        tree = ET.parse(path)
    except (ET.ParseError, OSError) as exc:
        return {
            "verdict": "INVALID_SVG",
            "failures": [f"cannot parse SVG: {exc}"],
            "warnings": [],
            "passed": [],
            "scope_note": "Deterministic SVG-structure checks only.",
        }

    root = tree.getroot()
    if _strip_ns(root.tag) != "svg":
        failures.append("root element is not <svg>")

    viewbox = root.attrib.get("viewBox")
    if viewbox:
        parts = re.split(r"[,\s]+", viewbox.strip())
        try:
            nums = [float(x) for x in parts if x != ""]
        except ValueError:
            nums = []
        if len(nums) == 4 and nums[2] > 0 and nums[3] > 0:
            passed.append(f"valid viewBox: {viewbox}")
        else:
            failures.append(f"invalid viewBox: {viewbox!r}")
    else:
        failures.append("missing viewBox — master is not reliably scalable")

    width = root.attrib.get("width")
    height = root.attrib.get("height")
    if width and height:
        if _parse_length(width) is None or _parse_length(height) is None:
            warnings.append("width/height use non-simple values; viewBox remains the scalable authority")
        else:
            passed.append("explicit width/height present")
    else:
        warnings.append("width/height not both declared — acceptable when viewBox is authoritative")

    tag_counts = {}
    external_refs = []
    embedded_raster = []
    text_nodes = []
    style_nodes = 0
    script_nodes = 0

    for element in root.iter():
        tag = _strip_ns(element.tag)
        tag_counts[tag] = tag_counts.get(tag, 0) + 1

        if tag == "image":
            href = (
                element.attrib.get("href")
                or element.attrib.get(f"{{{XLINK_NS}}}href")
                or ""
            )
            if href.startswith("data:image/"):
                embedded_raster.append(href[:40] + "...")
            else:
                external_refs.append(href or "<missing href>")

        if tag == "text":
            text_nodes.append("".join(element.itertext()).strip())

        if tag == "style":
            style_nodes += 1
        if tag == "script":
            script_nodes += 1

        for key, value in element.attrib.items():
            if _strip_ns(key) == "href" and isinstance(value, str):
                if value.startswith(("http://", "https://", "file://")):
                    external_refs.append(value)

    if embedded_raster:
        failures.append(f"embedded raster <image> found ({len(embedded_raster)}) — not a pure vector master")
    else:
        passed.append("no embedded raster image elements")

    if external_refs:
        failures.append(f"external references found: {external_refs}")
    else:
        passed.append("no external asset references")

    if script_nodes:
        failures.append(f"<script> elements found: {script_nodes}")
    else:
        passed.append("no script elements")

    if text_nodes:
        warnings.append(
            f"<text> elements found ({len(text_nodes)}). For portable production masters, convert final lettering to outlines or ensure font dependency is intentional."
        )
    else:
        passed.append("no live text/font dependency detected")

    if style_nodes:
        warnings.append(
            "embedded <style> detected; acceptable, but explicit presentation attributes can improve portability across production software"
        )

    vector_primitives = sum(tag_counts.get(tag, 0) for tag in (
        "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"
    ))
    if vector_primitives:
        passed.append(f"vector primitives present: {vector_primitives}")
    else:
        warnings.append("no common vector drawing primitives detected")

    verdict = "SVG_STRUCTURE_VALID" if not failures else "SVG_STRUCTURE_INVALID"
    return {
        "verdict": verdict,
        "failures": failures,
        "warnings": warnings,
        "passed": passed,
        "stats": {
            "elements": sum(tag_counts.values()),
            "vector_primitives": vector_primitives,
            "tag_counts": tag_counts,
        },
        "scope_note": (
            "Checks SVG structure, portability and raster/external dependencies only. "
            "It does not verify trademark uniqueness, optical quality or brand fit."
        ),
    }


def main(path):
    report = inspect_svg(path)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["verdict"] == "SVG_STRUCTURE_VALID" else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(0)
    sys.exit(main(sys.argv[1]))
