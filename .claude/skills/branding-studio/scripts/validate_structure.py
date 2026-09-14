#!/usr/bin/env python3
"""Machine-checkable structural validation for Branding Studio brand specs.

The validator proves only structural/technical properties that can be decided from the
file itself. It does not score strategy, creativity, meaning, distinctiveness or craft.

Schema v4 is the sparse canonical contract. Legacy v3/pre-v3 specs remain operable and
are validated only for compatible machine-checkable properties.
"""

from __future__ import annotations

import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from color_tools import check_pair  # noqa: E402


SCHEMA_VERSION = 4
VALID_TIERS = {"provisional", "full"}
VALID_EVIDENCE_KINDS = {"fact", "observation", "hypothesis"}
VALID_EVIDENCE_STATES = {"active", "challenged", "superseded"}
VALID_HIERARCHY = {"modular", "custom", "fluid"}
VALID_PRODUCTION = {"final", "concept", "external_craft_required"}
VALID_ARCHITECTURE = {"house-of-brands", "endorsed", "branded-house", "hybrid"}
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
HEX = re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def _get(data, path, default=None):
    cur = data
    for key in path.split("."):
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def _nonblank(value):
    return isinstance(value, str) and bool(value.strip()) and " | " not in value


def _nonempty_list(value):
    return isinstance(value, list) and any(
        (isinstance(item, str) and item.strip()) or isinstance(item, dict)
        for item in value
    )


def _major(value):
    match = re.match(r"^\s*(\d+)", str(value or ""))
    return int(match.group(1)) if match else 0


def _schema_version(spec):
    value = _get(spec, "meta.schema_version")
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def resolve_token(spec, ref):
    """Resolve an alias like {color.text} through visual.tokens."""
    seen = set()
    while isinstance(ref, str) and ref.startswith("{") and ref.endswith("}"):
        path = ref[1:-1]
        if path in seen:
            return None, f"circular token reference: {ref}"
        seen.add(path)
        node = _get(spec, f"visual.tokens.{path}")
        if not isinstance(node, dict) or "$value" not in node:
            return None, f"token reference does not resolve: {ref}"
        ref = node["$value"]
    return ref, None


def _walk_tokens(node, path, failures):
    if not isinstance(node, dict):
        failures.append(f"token group is not an object: {path}")
        return
    if "$value" in node:
        if "$type" not in node:
            failures.append(f"token missing $type: {path}")
        return
    for key, value in node.items():
        if key.startswith("_") or key.startswith("$"):
            continue
        _walk_tokens(value, f"{path}.{key}", failures)


def _validate_modular_scale(hierarchy, failures, passed):
    base = hierarchy.get("base_px")
    ratio = hierarchy.get("ratio")
    steps = hierarchy.get("steps", [])
    if not (
        isinstance(base, (int, float))
        and base > 0
        and isinstance(ratio, (int, float))
        and ratio > 1
        and isinstance(steps, list)
        and steps
        and all(isinstance(x, (int, float)) and x > 0 for x in steps)
    ):
        failures.append(
            "modular typography requires positive base_px, ratio>1 and positive numeric steps"
        )
        return

    bad = []
    for size in steps:
        try:
            n = round(math.log(size / base, ratio))
            expected = base * (ratio ** n)
        except (ValueError, ZeroDivisionError):
            bad.append(str(size))
            continue
        if abs(size - expected) / expected > 0.015:
            bad.append(f"{size} (nearest ~{expected:.2f})")

    if bad:
        failures.append("modular typography steps outside 1.5% tolerance: " + ", ".join(bad))
    else:
        passed.append("declared modular typography math is internally consistent")


def _validate_evidence(findings, require_ids, failures, warnings, passed):
    if findings is None:
        return set()
    if not isinstance(findings, list):
        failures.append("evidence/findings must be a list")
        return set()

    ids = set()
    checked = 0
    for i, item in enumerate(findings):
        if not isinstance(item, dict):
            failures.append(f"evidence[{i}] must be an object")
            continue

        prefix = f"evidence[{i}]"
        claim = item.get("claim")
        kind = str(item.get("kind", "")).strip()
        source = item.get("source")
        evidence_id = str(item.get("id", "")).strip()
        state = str(item.get("status", item.get("state", ""))).strip()

        if not _nonblank(claim):
            failures.append(f"{prefix}.claim is missing")
        if kind not in VALID_EVIDENCE_KINDS:
            failures.append(f"{prefix}.kind must be fact, observation or hypothesis")
        if not _nonblank(source):
            failures.append(f"{prefix}.source is missing")
        if require_ids:
            if not evidence_id:
                failures.append(f"{prefix}.id is missing")
            elif evidence_id in ids:
                failures.append(f"{prefix}.id is duplicate: {evidence_id}")
            else:
                ids.add(evidence_id)
            if state not in VALID_EVIDENCE_STATES:
                failures.append(f"{prefix}.status/state is invalid")
        elif evidence_id:
            if evidence_id in ids:
                failures.append(f"{prefix}.id is duplicate: {evidence_id}")
            ids.add(evidence_id)

        checked += 1

    if checked:
        passed.append(f"evidence records structurally checked: {checked}")
    elif findings:
        warnings.append("evidence list exists but has no usable records")
    return ids


def _validate_evidence_refs(spec, ids, failures):
    paths = (
        "strategy.brand_job.evidence_refs",
        "strategy.offer_truth.evidence_refs",
        "strategy.position.evidence_refs",
        "strategy.right_to_win.evidence_refs",
    )
    for path in paths:
        refs = _get(spec, path)
        if refs is None:
            continue
        if not isinstance(refs, list) or not all(isinstance(x, str) and x.strip() for x in refs):
            failures.append(f"{path} must be a list of evidence IDs")
            continue
        for ref in refs:
            if ref not in ids:
                failures.append(f"{path} references unknown evidence id: {ref}")


def _validate_tokens_and_contrast(spec, failures, warnings, passed):
    tokens = _get(spec, "visual.tokens")
    if tokens:
        token_errors = []
        _walk_tokens(tokens, "visual.tokens", token_errors)
        failures.extend(token_errors)
        if not token_errors:
            passed.append("declared design tokens are structurally resolvable")

    pairs = _get(spec, "visual.contrast_pairs")
    if pairs is None:
        return
    if not isinstance(pairs, list):
        failures.append("visual.contrast_pairs must be a list")
        return

    for i, pair in enumerate(pairs):
        if not isinstance(pair, dict):
            failures.append(f"visual.contrast_pairs[{i}] must be an object")
            continue
        fg, e1 = resolve_token(spec, pair.get("text", ""))
        bg, e2 = resolve_token(spec, pair.get("background", ""))
        if e1 or e2:
            failures.append(f"contrast pair {i} unresolved: {e1 or e2}")
            continue
        if not (isinstance(fg, str) and isinstance(bg, str) and HEX.fullmatch(fg) and HEX.fullmatch(bg)):
            failures.append(f"contrast pair {i} must resolve to hex colors")
            continue
        usage = pair.get("usage", "body")
        result = check_pair(fg, bg, usage)
        if result["wcag_aa"]:
            passed.append(f"contrast pair {i} passes WCAG AA ({usage}): {result['wcag_ratio']}:1")
        else:
            failures.append(f"contrast pair {i} fails WCAG AA ({usage}): {result['wcag_ratio']}:1")
        if not result["apca_ok"]:
            warnings.append(
                f"contrast pair {i} has low APCA/Lc signal: {result['apca_lc']} (advisory, not compliance)"
            )


def _validate_typography(spec, failures, passed):
    hierarchy = _get(spec, "visual.typography.hierarchy")
    if hierarchy is None:
        return
    if not isinstance(hierarchy, dict):
        failures.append("visual.typography.hierarchy must be an object")
        return
    mode = str(hierarchy.get("mode", "")).strip().lower()
    if mode not in VALID_HIERARCHY:
        failures.append("visual.typography.hierarchy.mode must be modular, custom or fluid")
    elif mode == "modular":
        _validate_modular_scale(hierarchy, failures, passed)
    else:
        rules = hierarchy.get("rules")
        if _nonempty_list(rules):
            passed.append(f"typography hierarchy mode={mode} has explicit rules")
        else:
            failures.append(f"typography hierarchy mode={mode} requires explicit rules")


def _validate_logo(spec, tier, failures, warnings, passed):
    production = _get(spec, "visual.logo.production")
    if production is None:
        return
    if not isinstance(production, dict):
        failures.append("visual.logo.production must be an object")
        return
    status = str(production.get("status", "")).strip()
    if status not in VALID_PRODUCTION:
        failures.append("visual.logo.production.status invalid")
        return
    if status == "final":
        if _nonblank(production.get("master_format")) and _nonblank(production.get("master_path")):
            passed.append("final logo declares reproducible master path/format")
        else:
            failures.append("final logo requires production.master_format and production.master_path")
    elif status == "external_craft_required":
        if _nonblank(production.get("production_brief")):
            passed.append("external logo craft dependency declares a production brief")
        else:
            failures.append("external_craft_required logo needs production.production_brief")
    elif tier == "full":
        warnings.append("full-tier contract still declares logo production.status=concept")


def _validate_optional_enums(spec, failures, passed):
    model = _get(spec, "architecture.model", _get(spec, "meta.architecture.model"))
    if model is not None:
        if model not in VALID_ARCHITECTURE:
            failures.append("architecture model is invalid")
        else:
            passed.append(f"architecture model declared: {model}")

    clearance = _get(spec, "naming.clearance")
    if clearance is not None:
        if not isinstance(clearance, dict):
            failures.append("naming.clearance must be an object")
        else:
            status = str(clearance.get("status", "")).strip()
            allowed = {
                "not_searched", "no_apparent_collision", "collision", "uncertain",
                "filed", "registered", "not_applicable",
            }
            if status and status not in allowed:
                failures.append("naming.clearance.status invalid")
            elif status:
                passed.append(f"naming clearance state declared: {status}")


def _validate_portfolio_projection(spec, failures, passed):
    color = _get(spec, "portfolio_summary.primary_color_oklch")
    if color is None:
        return
    if not isinstance(color, dict):
        failures.append("portfolio_summary.primary_color_oklch must be an object or null")
        return
    try:
        values = [float(color[key]) for key in ("L", "C", "H")]
    except (KeyError, TypeError, ValueError):
        failures.append("portfolio_summary.primary_color_oklch requires numeric L, C and H")
        return
    if not (0 <= values[0] <= 1 and values[1] >= 0 and 0 <= values[2] <= 360):
        failures.append("portfolio_summary.primary_color_oklch values out of range")
    else:
        passed.append("portfolio OKLCH projection is structurally valid (H=0 is valid)")


def _validate_v4(spec, failures, warnings, passed):
    tier = str(_get(spec, "meta.tier", "")).strip().lower()
    if tier not in VALID_TIERS:
        failures.append("meta.tier must be provisional or full")
    else:
        passed.append(f"tier declared: {tier}")

    if not _nonblank(_get(spec, "meta.brand_name")):
        failures.append("meta.brand_name is missing")

    touchpoints = _get(spec, "meta.touchpoints")
    if not _nonempty_list(touchpoints):
        failures.append("meta.touchpoints must contain at least one declared touchpoint")

    required_strings = (
        "strategy.brand_job.statement",
        "strategy.audience.primary",
        "strategy.offer_truth.statement",
        "strategy.position.statement",
        "strategy.right_to_win.statement",
        "strategy.desired_meaning",
        "creative_direction.thesis",
        "creative_direction.signature",
    )
    for path in required_strings:
        if not _nonblank(_get(spec, path)):
            failures.append(f"required contract field missing: {path}")

    principles = _get(spec, "creative_direction.principles")
    if not _nonempty_list(principles):
        failures.append("creative_direction.principles must contain at least one operating principle")

    findings = _get(spec, "evidence", [])
    ids = _validate_evidence(findings, True, failures, warnings, passed)
    _validate_evidence_refs(spec, ids, failures)
    _validate_tokens_and_contrast(spec, failures, warnings, passed)
    _validate_typography(spec, failures, passed)
    _validate_logo(spec, tier, failures, warnings, passed)
    _validate_optional_enums(spec, failures, passed)
    _validate_portfolio_projection(spec, failures, passed)


def _validate_legacy(spec, major, failures, warnings, passed):
    warnings.append(
        f"legacy v{major or 'pre-versioned'} contract accepted; compress to sparse schema v4 on the next meaningful CREATE/EVOLVE operation"
    )

    tier = str(_get(spec, "meta.tier", "")).strip().lower()
    if tier and tier not in VALID_TIERS:
        failures.append("meta.tier must be provisional or full when declared")

    findings = _get(spec, "research.findings")
    require_ids = major >= 3
    _validate_evidence(findings, require_ids, failures, warnings, passed)
    _validate_tokens_and_contrast(spec, failures, warnings, passed)
    _validate_typography(spec, failures, passed)
    _validate_logo(spec, tier, failures, warnings, passed)
    _validate_optional_enums(spec, failures, passed)
    _validate_portfolio_projection(spec, failures, passed)


def validate(spec):
    failures, warnings, passed = [], [], []

    if not isinstance(spec, dict):
        return {
            "verdict": "STRUCTURALLY_INVALID",
            "failures": ["spec root must be an object"],
            "warnings": [],
            "passed": [],
        }

    brand_version = str(_get(spec, "meta.version", "")).strip()
    if brand_version and not SEMVER.fullmatch(brand_version):
        failures.append("meta.version must be semantic version x.y.z")

    schema_version = _schema_version(spec)
    if schema_version is not None:
        if schema_version != SCHEMA_VERSION:
            failures.append(
                f"meta.schema_version={schema_version} is unsupported by this validator; expected {SCHEMA_VERSION}"
            )
        else:
            passed.append(f"brand-spec schema version detected: {schema_version}")
            _validate_v4(spec, failures, warnings, passed)
    else:
        legacy_major = _major(brand_version)
        _validate_legacy(spec, legacy_major, failures, warnings, passed)

    return {
        "verdict": "STRUCTURALLY_INVALID" if failures else "STRUCTURALLY_VALID",
        "failures": failures,
        "warnings": warnings,
        "passed": passed,
        "method_note": (
            "Structural validity covers only machine-checkable file properties. "
            "It does not establish strategic, creative, perceptual or market quality."
        ),
    }


def main(path):
    try:
        with open(path, encoding="utf-8") as handle:
            spec = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"verdict": "STRUCTURALLY_INVALID", "failures": [str(exc)]}, indent=2))
        return 1

    report = validate(spec)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["verdict"] == "STRUCTURALLY_VALID" else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: validate_structure.py spec.json")
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))
