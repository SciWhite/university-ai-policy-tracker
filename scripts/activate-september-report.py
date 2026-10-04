"""Activate September immediately before the single combined production build."""
import argparse
from datetime import datetime
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument("--published-at", required=True)
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()
published_at = datetime.fromisoformat(args.published_at.replace("Z", "+00:00"))
if published_at.utcoffset() is None:
    raise SystemExit("Publication timestamp must include a timezone.")
args.published_at = published_at.isoformat(timespec="milliseconds")
root = Path(__file__).resolve().parent.parent
registry = root / "apps/web/lib/monthly-report-registry.ts"
text = registry.read_text()
if '"2026-09":' in text:
    raise SystemExit("September is already active; inspect the publication date before changing it.")
entry = '  "2026-09": { ...september2026ReportDraft, publishedAt: "' + args.published_at + '" },\n'
changes = {
    registry: 'import { september2026ReportDraft } from "./monthly-report-drafts";\n' + text.replace('export const monthlyReportRegistry = {', 'export const monthlyReportRegistry = {\n' + entry, 1),
    root / "apps/web/lib/reports.ts": (root / "apps/web/lib/reports.ts").read_text().replace('currentMonthlyReportSlug = "2026-08"', 'currentMonthlyReportSlug = "2026-09"'),
    root / "apps/web/public/llms.txt": (root / "apps/web/public/llms.txt").read_text().replace('/reports/monthly/2026-08', '/reports/monthly/2026-09'),
}
editorial = root / "content/reports/2026-09.mdx"
changes[editorial] = editorial.read_text().replace('Status: Draft for the next combined site release', 'Status: Published with the combined site release').replace('Published: Pending the combined release', 'Published: ' + args.published_at)
for file, updated in changes.items():
    if not args.dry_run:
        file.write_text(updated)
print(('Previewed' if args.dry_run else 'Activated') + ' September report and latest pointers: ' + args.published_at)
