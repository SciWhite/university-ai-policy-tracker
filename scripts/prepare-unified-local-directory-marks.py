#!/usr/bin/env python3
"""Bind the current full-library compact roles into an isolated local preview.

Preserves accepted frontend image bytes except explicit minimum-slot corrections.
Copies frozen WebP bytes; never downloads, edits an image or approves publication.
"""
import argparse
import hashlib
import json
from pathlib import Path


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked(root, obj):
    relative = Path(obj["path"])
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Unsafe package path")
    target = root / relative
    if target.is_symlink() or root.resolve() not in target.resolve().parents:
        raise ValueError("Asset escaped frozen package")
    if sha(target) != obj["sha256"]:
        raise ValueError(f"Hash mismatch: {target}")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pointer", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--legacy-registry", type=Path, required=True)
    parser.add_argument("--previous-registry", type=Path, required=True)
    args = parser.parse_args()
    pointer = json.loads(args.pointer.read_text())
    for key, expected in [("manifest", "manifestSha256"), ("runtimeManifest", "runtimeManifestSha256"),
                          ("runtimeZip", "runtimeZipSha256")]:
        if sha(Path(pointer[key])) != pointer[expected]:
            raise ValueError(f"Pointer binding failed: {key}")
    manifest_path = Path(pointer["manifest"])
    manifest = json.loads(manifest_path.read_text())
    root = manifest_path.parent
    runtime_root = Path(pointer["runtimeManifest"]).parent
    file_list = json.loads((runtime_root / "file-hashes.json").read_text())
    for obj in file_list:
        checked(runtime_root, obj)
    catalog = json.loads(args.catalog.read_text())
    bindings = manifest["catalogBindings"]
    if len({b["slug"] for b in bindings}) != len(bindings):
        raise ValueError("Duplicate catalog slug bindings")
    if {c["slug"] for c in catalog} != {b["slug"] for b in bindings}:
        raise ValueError("Full-library bindings differ from actual catalog")
    identities = {e["id"]: e for e in manifest["entries"]}
    legacy = json.loads(args.legacy_registry.read_text())
    previous = json.loads(args.previous_registry.read_text())["entries"]
    # These legacy images cannot meet the newly explicit compact geometry.
    exceptions = {"sabanci-university", "university-of-wollongong"}
    entries, selections, kept = {}, [], []
    assets = args.output / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    for binding in bindings:
        slug = binding["slug"]
        identity = identities[binding["id"]]
        role = identity["roles"]["compact"]
        if slug in legacy and slug not in exceptions:
            kept.append({"slug": slug, "id": identity["id"], "roleContract": role,
                         "decision": "preserve_existing_accepted_frontend_bytes"})
            continue
        variants = role["variants"] + role.get("alternativeVariantsRetained", [])
        for obj in variants:
            checked(root, obj)
        minimum = role.get("minimumWidth", 32)
        slot = role.get("minimumDisplaySlot")
        possible = variants
        if slug in exceptions:
            possible = [v for v in variants if v["width"] >= minimum]
        elif slug in previous:
            same = [v for v in variants if v["sha256"] + ".webp" == previous[slug]["file"]]
            if same:
                possible = same
        if not possible:
            raise ValueError(f"No native variant meets required width: {slug}")
        selected = max(possible, key=lambda v: v["width"] * v["height"])
        source = checked(root, selected)
        filename = selected["sha256"] + ".webp"
        (assets / filename).write_bytes(source.read_bytes())
        entry = {
            "file": filename, "width": selected["width"], "height": selected["height"],
            "minimumWidth": minimum, "maximumWidth": role.get("maximumWidth"),
            "minimumDisplaySlot": slot, "actual32Accepted": role.get("actual32Accepted", False),
            "backing": role["requiredBacking"], "role": "compact",
            "limitations": role.get("limitations", []), "identityId": identity["id"],
            "publicationApproved": False, "publicUseReviewRequired": True,
            "legacyGeometryCorrection": slug in exceptions,
            "nativeRasterUpscaleAllowed": False,
        }
        entries[slug] = entry
        selections.append({"binding": binding, "identityId": identity["id"],
            "selectedVariant": selected, "roleContract": role, "localEntry": entry})
    args.registry.write_text(json.dumps({"schema": "uapt-local-compact-marks-v1",
        "revision": pointer["revision"], "sourceManifestSha256": pointer["manifestSha256"],
        "developmentOnly": True, "publicationApproved": False, "entries": entries},
        ensure_ascii=False, indent=2) + "\n")
    (args.output / "selection.json").write_text(json.dumps({"sourcePointer": pointer,
        "selected": selections, "preservedFrontend": kept,
        "catalogRecords": len(bindings), "catalogDistinctUniversities": len({b["id"] for b in bindings}),
        "runtimeFilesVerified": len(file_list), "unmappedCatalogSlugs": [],
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"exportedLocalRoles": len(entries), "preservedFrontend": len(kept),
        "catalogRecords": len(bindings), "unmapped": 0, "runtimeFilesVerified": len(file_list)}))


if __name__ == "__main__":
    main()
