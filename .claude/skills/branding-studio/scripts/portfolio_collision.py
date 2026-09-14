#!/usr/bin/env python3
"""Advisory portfolio comparison for Branding Studio.

This tool reports transparent per-dimension similarities. It does not calculate a
universal brand-distance score, assign risk severities, prove distinctiveness, or
estimate legal/consumer confusion. Interpretation depends on declared architecture
and professional/contextual judgment.
"""

from __future__ import annotations

import difflib
import json
import re
import sys
import unicodedata


DEFAULT_POLICIES = {
    "house-of-brands": {
        "name": "usually_separate",
        "morphology": "usually_separate",
        "color": "contextual",
        "creative_territory": "usually_separate",
    },
    "endorsed": {
        "name": "usually_separate",
        "morphology": "contextual",
        "color": "may_share_parent_cues",
        "creative_territory": "contextual",
    },
    "branded-house": {
        "name": "related_expected",
        "morphology": "related_expected",
        "color": "related_expected",
        "creative_territory": "related_expected",
    },
    "hybrid": {
        "name": "custom_policy_required",
        "morphology": "custom_policy_required",
        "color": "custom_policy_required",
        "creative_territory": "custom_policy_required",
    },
}


def _normalize_text(value):
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _tags(value):
    if not isinstance(value, list):
        return None
    out = {_normalize_text(item) for item in value if _normalize_text(item)}
    return out or None


def jaccard_similarity(a, b):
    a, b = _tags(a), _tags(b)
    if a is None or b is None:
        return None
    union = a | b
    return len(a & b) / len(union) if union else None


def _rounded_jaccard(a, b):
    value = jaccard_similarity(a, b)
    return None if value is None else round(value, 3)


def name_signals(a, b):
    if not isinstance(a, dict) or not isinstance(b, dict):
        return {
            "exact_normalized_match": None,
            "lexical_similarity": None,
            "same_approach": None,
            "same_construct": None,
        }

    n1 = _normalize_text(a.get("name"))
    n2 = _normalize_text(b.get("name"))
    lexical = difflib.SequenceMatcher(None, n1, n2).ratio() if n1 and n2 else None

    def same(key):
        v1 = _normalize_text(a.get(key))
        v2 = _normalize_text(b.get(key))
        return None if not (v1 and v2) else v1 == v2

    return {
        "exact_normalized_match": None if not (n1 and n2) else n1 == n2,
        "lexical_similarity": None if lexical is None else round(lexical, 3),
        "same_approach": same("approach"),
        "same_construct": same("construct"),
    }


def color_signals(a, b):
    if not isinstance(a, dict) or not isinstance(b, dict):
        return {"delta_L": None, "delta_C": None, "delta_H_degrees": None}
    try:
        l1, c1, h1 = float(a["L"]), float(a["C"]), float(a["H"])
        l2, c2, h2 = float(b["L"]), float(b["C"]), float(b["H"])
    except (KeyError, TypeError, ValueError):
        return {"delta_L": None, "delta_C": None, "delta_H_degrees": None}

    dh = abs(h1 - h2) % 360
    dh = min(dh, 360 - dh)
    return {
        "delta_L": round(abs(l1 - l2), 4),
        "delta_C": round(abs(c1 - c2), 4),
        "delta_H_degrees": round(dh, 2),
    }


def _candidate_summary(candidate):
    return candidate.get("portfolio_summary", candidate) if isinstance(candidate, dict) else {}


def _architecture_model(candidate, portfolio):
    if not isinstance(candidate, dict):
        return "house-of-brands"
    model = (
        candidate.get("architecture", {}).get("model")
        if isinstance(candidate.get("architecture"), dict)
        else None
    )
    if model not in DEFAULT_POLICIES:
        model = (
            candidate.get("meta", {}).get("architecture", {}).get("model")
            if isinstance(candidate.get("meta"), dict)
            else None
        )
    if model in DEFAULT_POLICIES:
        return model
    studio_default = portfolio.get("studio", {}).get("default_architecture")
    return studio_default if studio_default in DEFAULT_POLICIES else "house-of-brands"


def _policy(candidate, portfolio, model):
    candidate_arch = candidate.get("architecture", {}) if isinstance(candidate, dict) else {}
    custom = candidate_arch.get("collision_policy") if isinstance(candidate_arch, dict) else None
    if not custom and isinstance(candidate, dict):
        custom = candidate.get("meta", {}).get("architecture", {}).get("collision_policy")
    if isinstance(custom, dict) and custom:
        return custom, "candidate architecture policy"

    portfolio_policy = (
        portfolio.get("studio", {}).get("relationship_policies", {}).get(model)
        if isinstance(portfolio, dict)
        else None
    )
    if isinstance(portfolio_policy, dict) and portfolio_policy:
        return portfolio_policy, f"portfolio relationship policy: {model}"
    return DEFAULT_POLICIES[model], f"advisory default context: {model}"


def compare(candidate_summary, sister_summary, policy=None):
    policy = policy or {}
    return {
        "name": {
            **name_signals(candidate_summary.get("name"), sister_summary.get("name")),
            "architecture_context": policy.get("name"),
        },
        "morphology": {
            "tag_jaccard": _rounded_jaccard(
                candidate_summary.get("logo_morphology"),
                sister_summary.get("logo_morphology"),
            ),
            "architecture_context": policy.get("morphology"),
        },
        "color": {
            **color_signals(
                candidate_summary.get("primary_color_oklch"),
                sister_summary.get("primary_color_oklch"),
            ),
            "architecture_context": policy.get("color"),
        },
        "creative_territory": {
            "tag_jaccard": _rounded_jaccard(
                candidate_summary.get("creative_territory"),
                sister_summary.get("creative_territory"),
            ),
            "architecture_context": policy.get("creative_territory"),
        },
    }


def main(portfolio_path, candidate_path):
    with open(portfolio_path, encoding="utf-8") as handle:
        portfolio = json.load(handle)
    with open(candidate_path, encoding="utf-8") as handle:
        candidate = json.load(handle)

    model = _architecture_model(candidate, portfolio)
    policy, policy_source = _policy(candidate, portfolio, model)
    candidate_summary = _candidate_summary(candidate)

    comparisons = []
    for sister in portfolio.get("brands", []):
        sister_summary = sister.get("portfolio_summary", sister)
        comparisons.append(
            {
                "brand": sister.get("brand_name")
                or sister_summary.get("name", {}).get("name")
                or "?",
                "signals": compare(candidate_summary, sister_summary, policy),
            }
        )

    output = {
        "verdict": "ADVISORY_COMPARISON",
        "candidate": candidate_summary.get("name", {}).get("name", "?"),
        "architecture_model": model,
        "policy_context": policy,
        "policy_source": policy_source,
        "comparisons": comparisons,
        "method_note": (
            "Values are transparent descriptive signals only. No threshold, composite score, risk severity, "
            "distinctiveness verdict or legal/confusion conclusion is produced. Missing data stays null."
        ),
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: portfolio_collision.py portfolio.json candidate-spec.json")
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1], sys.argv[2]))
