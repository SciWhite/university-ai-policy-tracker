# Tulsa V5 bounded runtime-content release

Scope: University of Tulsa's seven public university routes only. This app
reuses the 622e996 production layout/components, loads one reviewed public
content package at runtime, and runs as a separate loopback Next service.
No whole-site build or primary UAPT service cutover is required. No other nine
schools, canonical API records, policy snapshots or dataset release are promoted.

The human publication instruction authorizes the six Tulsa evidence records
as scoped website supplements. Original private candidate inventory is unchanged.
Private candidate paths/decisions are excluded from the public payload. Evidence
text, hashes, scope and gaps remain intact; this is not a university-wide policy
or new verified formal misconduct deadline. Five locales retain explicit English
body fallback; English/Chinese summaries are provided.

Build apps/tulsa-zone once on OCI from a frozen Git SHA. Point
UAPT_TULSA_CONTENT_ROOT at a revisioned directory outside the code release.
The selected content must match the reviewed canonical claim fingerprint.
Never serve content/current.json or source records as public static files.

Nginx routes only the seven exact university paths and /tulsa-v5 assets to the
zone. All other pages/APIs stay on uapt-web.service. Distinct assetPrefix and
hard document navigation prevent mixing Next deployments. Incoming RSC requests
on those seven paths return a non-RSC response, making Next use document
navigation; browser navigation must be checked from the main site's links.
Do not publicly proxy the zone's refresh API. Invoke it only on loopback with a
private token after validating a candidate content revision.

Rollback: restore the saved nginx snippet, nginx -t and reload; primary app
remains the known-good 622e996 artifact. Stop the zone only after traffic returns
to the primary service. No rebuild. Future compatible Tulsa content revisions
need pointer selection plus targeted revalidation, not application rebuild.

Current preflight/acceptance evidence and final deployment status are recorded
separately after actual results; this file does not itself claim successful live
cutover. Candidate tests must cover full V5 shell, hero/Do/Don't/story, tools,
evidence, reviewed claims, source links, seven-language metadata, images, mobile,
dark/print, RSC-to-document navigation and controls.
