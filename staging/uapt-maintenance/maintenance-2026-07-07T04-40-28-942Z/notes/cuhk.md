# Maintenance Note: cuhk — No Policy-Content Update

**Run:** `maintenance-2026-07-07T04-40-28-942Z`
**Entity slug:** `cuhk` (The Chinese University of Hong Kong)
**Source URL reviewed:** `https://www.itsc.cuhk.edu.hk/all-it/email-messaging-and-collaboration/ai-hub-cuhk/`
**Previous run:** `uapt-cuhk-20260510`

## Assessment

| Aspect | Finding |
|---|---|
| Source alive (HTTP 200) | ✅ Yes |
| Source type | Approved-tools portal / navigation hub page |
| Policy-specificity score (prior) | 0.75 (already low) |
| Policy-content update | ❌ None detected |
| Source relocation | ❌ Same URL, same final URL |
| Metadata/chrome/noise only | ✅ Minimal landing page, cookie notice, link to `cuhk.edu.hk/ai-hub` |

## Details

The ITSC AI Hub page was already captured as `source-candidate-007` in the prior run. It remains a concise portal/landing page — roughly one paragraph welcoming users to AI Hub @ CUHK, linking to `https://www.cuhk.edu.hk/ai-hub/#/aiCUHK`, and a cookie notice. There is no policy language, guidance text, or substantive AI policy content on this page.

The actual CUHK AI policy content in the tracker comes from the student guide PDF at `https://www.aqs.cuhk.edu.hk/documents/A-guide-for-students_use-of-AI-tools.pdf` (source-candidate-001), which was not the target of this maintenance check.

## Action Taken

- Write-only maintenance note (this file).
- No artifact bundle created under `staging/uapt-runs/`.
- No validation run needed.

## Recommendation

If the tracker intends to surface the AI Hub as an approved-tools source reference, the existing `source-candidate-007` record from `uapt-cuhk-20260510` is sufficient. No re-fetch or re-review of this URL is needed in the current cycle.
