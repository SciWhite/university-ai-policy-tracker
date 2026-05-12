---
title: PLSC EdTechAI Policy V4 Reference Summary
authoritativeLevel: non_authoritative_benchmark
generatedAt: 2026-05-12T10:00:33-04:00
originalFilePath: /Users/newvolume/Documents/OpenClaw/PLSC-EdTechAI_Policy_V4.xlsx
sourceFileName: PLSC-EdTechAI_Policy_V4.xlsx
sheetNames:
  - Summary
  - General
  - Academic Integrity
  - Copyright
  - Research
  - Teaching
  - Privacy
  - DeepSeek (Institution List)
  - Approved AI Tools (List)
  - Approved AI Tools (Matrix)
selectedSheet: workbook-wide summary
sha256: a2fe2ee26f06f395167339a0f97272d13b8664f2451a6e18782c203f77b74e9b
sourceCommands:
  - pandas ExcelFile workbook inspection
  - pandas read_excel with bounded sheet summaries
refreshCadence: when the source workbook changes
canonicalBoundary: This workbook is a non-authoritative benchmark only and cannot create public claims.
---

# PLSC EdTechAI Policy V4 Reference Summary

Status: non-authoritative benchmark only.

This workbook can help find likely coverage gaps and compare broad taxonomy
coverage. It is not official university evidence, not a citation source, and
not a basis for public claims.

## Source File

| Field | Value |
| --- | --- |
| Original file | `/Users/newvolume/Documents/OpenClaw/PLSC-EdTechAI_Policy_V4.xlsx` |
| File name | `PLSC-EdTechAI_Policy_V4.xlsx` |
| SHA-256 | `a2fe2ee26f06f395167339a0f97272d13b8664f2451a6e18782c203f77b74e9b` |
| Workbook sheets | 10 |
| Unique normalized institution names across sheets | 102-129 depending on alias handling |
| Main benchmark basis | Human/manual policy spreadsheet; many sheets use THE-style rank fields |

The workbook mixes policy themes, AI-tool lists, and DeepSeek status fields.
Do not mix its ranking basis with the QS 2026 coverage file.

## Workbook Shape

| Sheet | Rows inspected | Institution rows | Unique institutions | Notes |
| --- | ---: | ---: | ---: | --- |
| `Summary` | 72 | n/a | n/a | workbook summary/count sheet |
| `General` | 101 | 101 | 101 | general AI policy URLs/statuses |
| `Academic Integrity` | 101 | 101 | 101 | academic-integrity URLs/statuses |
| `Copyright` | 101 | 101 | 101 | copyright policy URLs/statuses |
| `Research` | 101 | 101 | 101 | research policy URLs/statuses |
| `Teaching` | 101 | 101 | 101 | teaching policy URLs/statuses |
| `Privacy` | 114 | 101 | 101 | privacy sheet includes extra rows for some institutions |
| `DeepSeek (Institution List)` | 101 | 101 | 101 | DeepSeek status benchmark |
| `Approved AI Tools (List)` | 101 | 101 | 101 | approved-tool list benchmark |
| `Approved AI Tools (Matrix)` | 116 | 101 | 101 | tool matrix with extra non-institution rows |

## Policy Status Counts By Theme

| Sheet | Formally approved | Informal/advisory | External | Notes |
| --- | ---: | ---: | ---: | --- |
| `General` | 24 | 68 | 4 | 5 rows have no counted status in bounded summary |
| `Academic Integrity` | 64 | 26 | 1 | 10 rows have no counted status in bounded summary |
| `Copyright` | 54 | 36 | 0 | 11 rows have no counted status in bounded summary |
| `Research` | 34 | 57 | 1 | 9 rows have no counted status in bounded summary |
| `Teaching` | 18 | 80 | 1 | 2 rows have no counted status in bounded summary |
| `Privacy` | 84 | 26 | 0 | includes duplicate/extra privacy rows |

## DeepSeek Benchmark Counts

These are benchmark labels in the workbook, not verified public claims.

| DeepSeek status | Count |
| --- | ---: |
| Restricted | 49 |
| Allowed w/ restrictions | 27 |
| Allowed | 16 |
| Blocked | 9 |

## Rough Comparison To Current Public Release

The current public release has 50 universities. A rough normalized-name match
against this workbook found 26 public universities in common. This is only a
recall signal because:

- the workbook appears to use a different ranking basis than the QS 2026 target
  list;
- several university names require aliases or localized variants;
- the workbook is not an official source;
- public release coverage is evidence-first and cannot be completed from Excel.

Use this comparison to ask which institutions or themes may need source
discovery. Do not use it to patch public data directly.

## Allowed Uses

- Recall comparison after a crawl batch.
- Source-discovery planning.
- Identifying possible taxonomy gaps, especially DeepSeek and approved-tool
  treatment.
- Finding candidate institutions that should be crawled from official sources.

## Prohibited Uses

- Public claim generation.
- Public JSON generation.
- Official source attribution.
- Citation examples.
- Replacing `sourceUrl`, `sourceLanguage`, `snapshotHash`, or
  `evidenceSnippetOriginal`.
