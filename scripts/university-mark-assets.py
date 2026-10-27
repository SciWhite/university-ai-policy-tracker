#!/usr/bin/env python3
"""Resolve a university mark from the frozen full library, without mutating it."""
import argparse
import hashlib
import json
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def resolve(pointer, slug, role, slot, dpr):
    binding = json.loads(pointer.read_text())
    manifest = Path(binding["manifest"])
    if digest(manifest) != binding["manifestSha256"]:
        raise ValueError("Full-library manifest hash differs from the frozen pointer")
    data = json.loads(manifest.read_text())
    matches = [x for x in data["catalogBindings"] if x["slug"] == slug]
    identities = {x["id"] for x in matches}
    if not identities:
        identities = {x["id"] for x in data["entries"] if x.get("canonicalSlug") == slug or x["id"] == slug
                      or any(a["id"] == slug for a in x.get("identityAliases", []))}
    if len(identities) != 1:
        raise ValueError("University identity is absent or ambiguous: " + slug)
    school = next(x for x in data["entries"] if x["id"] in identities)
    resource = school["roles"][role]
    minimum = resource.get("minimumWidth", 32)
    if slot < minimum:
        return {"available": False, "id": school["id"], "role": role,
                "reason": "slot_below_minimum", "minimumSlot": minimum}
    maximum = resource.get("maximumWidth")
    if maximum and slot > maximum:
        return {"available": False, "id": school["id"], "role": role,
                "reason": "slot_above_native_display_limit", "maximumSlot": maximum}
    variants = [v for v in resource["variants"] if max(v["width"], v["height"]) >= slot * dpr]
    if not variants:
        return {"available": False, "id": school["id"], "role": role,
                "reason": "insufficient_native_pixels", "requestedSlot": slot, "dpr": dpr,
                "availableDimensions": resource["maxAvailableDimensions"]}
    variant = min(variants, key=lambda v: max(v["width"], v["height"]))
    root = manifest.parent.resolve()
    relative = Path(variant["path"])
    path = (root / relative).resolve()
    if relative.is_absolute() or ".." in relative.parts or root not in path.parents:
        raise ValueError("Asset path escapes the frozen package")
    if digest(path) != variant["sha256"]:
        raise ValueError("Selected asset hash mismatch")
    return {"available": True, "id": school["id"], "name": school["name"], "role": role,
            "path": str(path), "sha256": variant["sha256"], "width": variant["width"],
            "height": variant["height"], "backing": resource["requiredBacking"],
            "minimumSlot": minimum, "limitations": resource.get("limitations", []),
            "publicationApproved": resource.get("publicationApproved", False),
            "manifestSha256": binding["manifestSha256"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug", help="Canonical university slug or explicit library identity")
    parser.add_argument("--role", choices=["title", "compact"], default="compact")
    parser.add_argument("--slot", type=int, default=32, help="CSS square slot long side")
    parser.add_argument("--dpr", type=float, default=1)
    parser.add_argument("--pointer", type=Path, default=Path(__file__).resolve().parents[1] / ".local/university-marks/current.json")
    args = parser.parse_args()
    if args.slot <= 0 or args.dpr <= 0:
        parser.error("slot and dpr must be positive")
    result = resolve(args.pointer, args.slug, args.role, args.slot, args.dpr)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
