"""Retired by R1-b: monthly reports are content, not source edits.

Publishing a report now adds its spec to data/monthly-reports/registry.json,
moves `current`, builds a content release and switches the content pointer
(docs/content-release.md). /llms.txt, feeds, sitemaps and report routes read
the registry at request time, so no program build is involved.
"""
raise SystemExit("Retired: publish monthly reports as content releases; see docs/content-release.md")
