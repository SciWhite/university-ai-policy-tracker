"""Create a deterministic review ZIP; --submission requires a real demo URL."""
import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument("--submission", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
source = root / "plugins/university-ai-policy-tracker"
manifest = json.loads((source / "plugin.json").read_text())
interface = manifest["extensions"]["com.openai"]["interface"]
assert len(interface["displayName"]) <= 30
assert len(interface["shortDescription"]) <= 30
review = manifest["extensions"]["com.openai"]["review"]
assert len(review["test_cases"]["positive"]) == 5
assert len(review["test_cases"]["negative"]) == 3
demo = os.environ.get("UAPT_PLUGIN_DEMO_URL")
if demo:
    assert urlparse(demo).scheme == "https" and urlparse(demo).netloc
    review["demo_recording_url"] = demo
if args.submission and not demo:
    raise SystemExit("Submission blocked: record a real supported-client demo and provide UAPT_PLUGIN_DEMO_URL.")
out = root / ".local/plugin-build/university-ai-policy-tracker.zip"
out.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(out, "w", compression=ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob("*")):
        if not file.is_file():
            continue
        name = file.relative_to(source).as_posix()
        info = ZipInfo(name, date_time=(2026, 10, 3, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        data = json.dumps(manifest, ensure_ascii=False, indent=2).encode() if name == "plugin.json" else file.read_bytes()
        archive.writestr(info, data)
print(json.dumps({"zip": str(out), "stage": "submission-package" if args.submission else "draft-package", "demoIncluded": bool(demo)}))
