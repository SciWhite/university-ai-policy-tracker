---
title: PLSC EdTechAI Policy V4 Column Dictionary
authoritativeLevel: non_authoritative_benchmark
generatedAt: 2026-05-12T10:00:33-04:00
originalFilePath: /Users/newvolume/Documents/OpenClaw/PLSC-EdTechAI_Policy_V4.xlsx
sourceFileName: PLSC-EdTechAI_Policy_V4.xlsx
sha256: a2fe2ee26f06f395167339a0f97272d13b8664f2451a6e18782c203f77b74e9b
sourceCommands:
  - pandas read_excel column inspection
refreshCadence: when the source workbook changes
canonicalBoundary: This column dictionary is a non-authoritative benchmark only.
---

# PLSC EdTechAI Policy V4 Column Dictionary

This file records workbook columns for retrieval and planning. It does not
normalize the workbook into the project claim/evidence schema.

## Theme Sheets

The following sheets share a similar structure after their title row:

- `General`
- `Academic Integrity`
- `Copyright`
- `Research`
- `Teaching`
- `Privacy`

Common columns:

| Column | Meaning in workbook | Use in this project |
| --- | --- | --- |
| `Rank (THE)` | Workbook ranking/order field | Benchmark grouping only; do not mix with QS 2026 |
| `University Name` | Institution name as written in workbook | Possible entity-resolution hint |
| `Region` | Country/region label | Possible coverage grouping hint |
| Theme URL column | `General Policy`, `Academic Integrity`, `Copyright`, `Research`, `Teaching`, or `Privacy` | Candidate URL hint only; must be independently crawled and validated |
| `Status` | Workbook policy status label | Benchmark taxonomy hint only |
| `Issuing Agency` | Workbook issuer label | Possible source-discovery hint |
| `Issuer Type` | Workbook issuer type label | Possible taxonomy hint |
| `Level` | Workbook level label | Possible document-status hint |
| `Last Reviewed` | Workbook date-like field | Benchmark metadata only; not a public checked date |

Theme URL column names:

| Sheet | Theme URL column |
| --- | --- |
| `General` | `General Policy` |
| `Academic Integrity` | `Academic Integrity` |
| `Copyright` | `Copyright` |
| `Research` | `Research` |
| `Teaching` | `Teaching` |
| `Privacy` | `Privacy` |

## DeepSeek Sheet

Sheet: `DeepSeek (Institution List)`

| Column | Use |
| --- | --- |
| `Rank` | Benchmark grouping only |
| `University` | Possible entity-resolution hint |
| `Country` | Coverage grouping hint |
| `DeepSeek Status` | Benchmark AI-service treatment hint |
| `Implementation Details` | Do not publish; use only to frame verification questions |
| `Approved AI Tools` | Candidate tool/source-discovery hint |
| `DeepSeek Related Links` | Candidate URL hint; must be independently fetched and validated |

## Approved AI Tools List

Sheet: `Approved AI Tools (List)`

| Column | Use |
| --- | --- |
| `Rank (THE)` | Benchmark grouping only |
| `University Name` | Possible entity-resolution hint |
| `Region` | Coverage grouping hint |
| `Approved AI Tools` | Candidate AI service list; not canonical |
| `Source 1` | Candidate URL hint; must be independently fetched and validated |

## Approved AI Tools Matrix

Sheet: `Approved AI Tools (Matrix)`

| Column | Use |
| --- | --- |
| `Rank` | Benchmark grouping only |
| `University` | Possible entity-resolution hint |
| `Country` | Coverage grouping hint |
| `Microsoft Copilot` | Candidate service treatment hint |
| `ChatGPT` | Candidate service treatment hint |
| `Claude` | Candidate service treatment hint |
| `Gemini` | Candidate service treatment hint |
| `NotebookLM` | Candidate service treatment hint |
| `Zoom AI Companion` | Candidate service treatment hint |
| `Adobe Firefly` | Candidate service treatment hint |
| `DeepSeek` | Candidate service treatment hint |
| `Self-developed AI` | Candidate service treatment hint |
| `Others` | Candidate service treatment hint |

## Conversion Rules

- Preserve the workbook as a benchmark, not as evidence.
- If a URL appears useful, send it to source discovery and fetch it through the
  normal artifact chain.
- Do not copy workbook prose into claims or evidence snippets.
- Do not treat workbook `Last Reviewed` as `lastCheckedAt`.
- Do not treat workbook `Status` as `reviewState`.
