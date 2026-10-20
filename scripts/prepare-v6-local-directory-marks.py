#!/usr/bin/env python3
"""Export a frozen, explicitly selected compact-mark set for development only.

This copies hash-verified WebP bytes without modifying originals, approvals or
the accepted public registry. The selection record retains private provenance.
"""
import argparse
import hashlib
import json
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked(base, relative, expected):
    relative = Path(relative)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Unsafe package path")
    target = base / relative
    if target.is_symlink() or base.resolve() not in target.resolve().parents:
        raise ValueError("Path escapes frozen resource root")
    if digest(target) != expected:
        raise ValueError(f"Hash mismatch: {target}")
    return target


def retained_limits(record):
    result = []
    # Current decision restrictions supplement, never erase, source restrictions.
    for obj in [record, record.get("manifest", {}), record.get("acceptance", {}),
                record.get("decision", {})]:
        if not isinstance(obj, dict):
            continue
        for key in ["knownLimitations", "limitationsRetained", "limitations", "limits", "notes"]:
            values = obj.get(key, [])
            if isinstance(values, list):
                result.extend(v for v in values if isinstance(v, str))
    return sorted(set(result))


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--selection", type=Path, required=True)
    cli.add_argument("--package", type=Path, required=True)
    cli.add_argument("--baseline", type=Path, required=True)
    cli.add_argument("--output", type=Path, required=True)
    cli.add_argument("--registry", type=Path, required=True)
    cli.add_argument("--legacy-registry", type=Path, required=True)
    cli.add_argument("--display-overrides", type=Path)
    args = cli.parse_args()
    selection = json.loads(args.selection.read_text())
    legacy = json.loads(args.legacy_registry.read_text())
    overrides = json.loads(args.display_overrides.read_text()) if args.display_overrides else {}
    package = args.package.resolve()
    baseline_hash = digest(args.baseline)
    if baseline_hash != "230bfb47023da38e8b23d8995d40f5401123dfd3f3db485e2ff0b4f01bb1c5a4":
        raise ValueError("Unexpected frozen original-role baseline")
    baseline = json.loads(args.baseline.read_text())
    package_roles = json.loads((package / "manifest.json").read_text())["roles"]
    manifest_hash = digest(package / "manifest.json")
    if manifest_hash != "1b78097f130c9ada84311df68436956a3c32ef43b37890d50d2e6fd79fbe37e9":
        raise ValueError("Unexpected frozen package manifest")
    for item in json.loads((package / "file-hashes.json").read_text()):
        checked(package, item["path"], item["sha256"])
    assets = args.output / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    entries, selections, gaps = {}, [], list(selection["gaps"])
    for item in selection["selected"]:
        slug, record = item["slug"], item["record"]
        if slug in legacy or slug in entries:
            raise ValueError(f"Duplicate or existing accepted mark: {slug}")
        delta = item["kind"] == "delta"
        if record not in (package_roles if delta else baseline):
            raise ValueError(f"Selected role differs from frozen input: {slug}")
        data = record if delta else record["manifest"]
        if data.get("role", data.get("assetRole")) != "compact":
            raise ValueError("Title assets cannot substitute for compact assets")
        base = package if delta else Path(record["directory"]).resolve()
        checked(base, data["original"], data.get("originalSha256", data.get("hash")))
        if delta:
            checked(base, data["master"], data["masterSha256"])
        variants = [v for v in data["variants"] if v.get("format", "webp") == "webp"
                    and v.get("width") and v.get("height")]
        for variant in variants:
            checked(base, variant.get("path", variant.get("relativePath")), variant["sha256"])
        variant = max(variants, key=lambda v: v["width"] * v["height"])
        native = data.get("derivedNativeDimensions", data.get("nativeDimensions"))
        vector = data.get("scalableVector") or "svg" in data.get("originalMime", "")
        if not vector and native and all(isinstance(n, (int, float)) and n > 0 for n in native):
            if variant["width"] > native[0] or variant["height"] > native[1]:
                raise ValueError(f"Native raster cap conflict: {slug}")
        source = checked(base, variant.get("path", variant.get("relativePath")), variant["sha256"])
        filename = variant["sha256"] + ".webp"
        (assets / filename).write_bytes(source.read_bytes())
        limits = retained_limits(record)
        acceptance = record.get("acceptance", {})
        backing = data.get("requiredBacking") or (
            "dark" if any("dark_required" in v or "dark_backing" in v for v in limits) else "light")
        entry = {
            "file": filename, "width": variant["width"], "height": variant["height"],
            "minimumWidth": data.get("minimumCompactWidth", acceptance.get("minimumDisplayWidth", 32)),
            "maximumWidth": acceptance.get("maximumDisplayWidth"),
            "actual32Accepted": data.get("actual32Accepted", True),
            "backing": backing, "role": "compact", "limitations": limits,
            "publicationApproved": False, "publicUseReviewRequired": True,
        }
        review = overrides.get(slug)
        if review:
            # Additional presentation restrictions never rewrite frozen source decisions.
            if set(review) - {"backing", "reason", "evidence"} or review.get("backing") not in {"light", "dark"}:
                raise ValueError(f"Unsupported local display override: {slug}")
            if not review.get("reason") or not review.get("evidence"):
                raise ValueError(f"Unsubstantiated local display override: {slug}")
            entry["backing"] = review["backing"]
            entry["limitations"].append("additional_local_backing_review_" + review["backing"])
        entries[slug] = entry
        selections.append({**item, "selectedVariant": variant, "localEntry": entry,
                           "localDisplayReview": review,
                           "sourceManifestSha256": manifest_hash if delta else None})
    args.registry.write_text(json.dumps({"schema": "uapt-local-compact-marks-v1",
        "developmentOnly": True, "publicationApproved": False, "entries": entries},
        ensure_ascii=False, indent=2) + "\n")
    (args.output / "selected-roles.json").write_text(json.dumps({
        "selectionSha256": digest(args.selection), "packageManifestSha256": manifest_hash,
        "baselineRegistrySha256": baseline_hash,
        "publicationApproved": False, "selected": selections, "unresolved": gaps,
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"exportedCompactRoles": len(entries), "unresolvedIdentities": len(gaps),
                      "existingAcceptedRolesPreserved": len(legacy), "developmentOnly": True}))


if __name__ == "__main__":
    main()
