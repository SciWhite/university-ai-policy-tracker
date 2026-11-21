#!/usr/bin/env python3
"""Install an uploaded content release into a content root without copying bytes twice.

Usage (as the content-root owner, on the host):
  install-tree.py <content-root> <content-id> <staged-manifest.json> [--switch-plan <file>]

Requires every object listed in the manifest to be present under <content-root>/objects
(new ones uploaded beforehand). Builds releases/<id>/tree as hard links to those objects,
checks every hash and size, then writes manifest.json (0444) last. Refuses an existing
release. Never touches current.json or pointer-history.jsonl.
"""
import hashlib, json, os, shutil, sys

def sha_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()

def main():
    if len(sys.argv) < 4: raise SystemExit(__doc__)
    root, cid, staged = os.path.realpath(sys.argv[1]), sys.argv[2], sys.argv[3]
    plan = sys.argv[sys.argv.index("--switch-plan") + 1] if "--switch-plan" in sys.argv else None
    raw = open(staged, "rb").read(); manifest = json.loads(raw)
    if manifest.get("schemaVersion") != "uapt-content-release-v1" or manifest.get("contentId") != cid: raise SystemExit("manifest identity mismatch")
    final = os.path.join(root, "releases", cid)
    if os.path.exists(final): raise SystemExit("release already exists: " + final)
    work = final + ".installing-%d" % os.getpid()
    os.makedirs(os.path.join(work, "tree"))
    try:
        missing = [f for f in manifest["files"] if not os.path.exists(os.path.join(root, "objects", f[1][:2], f[1]))]
        if missing: raise SystemExit("missing objects: %d (first %s)" % (len(missing), missing[0][0]))
        for rel, digest, size in manifest["files"]:
            if rel.startswith("/") or ".." in rel.split("/"): raise SystemExit("unsafe path " + rel)
            obj = os.path.join(root, "objects", digest[:2], digest)
            if os.path.getsize(obj) != size or sha_file(obj) != digest: raise SystemExit("object mismatch " + rel)
            target = os.path.join(work, "tree", rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            os.link(obj, target)
        with open(os.path.join(work, "manifest.json"), "wb") as f: f.write(raw)
        os.chmod(os.path.join(work, "manifest.json"), 0o444)
        if plan: shutil.copyfile(plan, os.path.join(work, os.path.basename(plan)))
        os.rename(work, final)
    except BaseException:
        shutil.rmtree(work, ignore_errors=True); raise
    print(json.dumps({"installed": final, "files": len(manifest["files"]), "manifestSha256": hashlib.sha256(raw).hexdigest()}))

if __name__ == "__main__": main()
