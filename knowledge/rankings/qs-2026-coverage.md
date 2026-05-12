---
title: QS 2026 Coverage
authoritativeLevel: derived_snapshot
generatedAt: 2026-05-12T10:19:46-04:00
sourceFiles:
  - data/rankings/qs-world-university-rankings-2026-top-100.json
  - data/rankings/qs-world-university-rankings-2026-top-1000.json
  - data/public-releases/current.json
  - staging/uapt-runs/
  - apps/web/lib/university-index-records.ts
sourceCommands:
  - pnpm audit:public-data
  - local QS coverage comparison over public records and staging directories
refreshCadence: after each public release promotion or ranking source update
canonicalBoundary: Ranking coverage is crawl-planning metadata only and cannot create public claims.
---

# QS 2026 Coverage

This snapshot tracks coverage against `QS World University Rankings 2026` top
100 targets. QS 2026 must remain separate from THE 2026, ARWU 2025, U.S. News
2025-2026, and CWTS Leiden 2025.

## Source Boundary

- Ranking source: QS World University Rankings
- Ranking year: 2026
- Scope used here: top 100
- Source file: `data/rankings/qs-world-university-rankings-2026-top-100.json`
- Ranking rows are target metadata, not policy evidence.

## Summary

| Status | Count |
| --- | ---: |
| Public | 50 |
| Staging only / unpromoted | 9 |
| Missing | 41 |
| Total QS top 100 rows | 100 |

The public dataset itself reports `qs=50/50 public` because every public
university currently has QS metadata. This file asks a different question:
coverage of the QS top 100 target list.

## Immediate Crawl/Review Queue

| Priority | QS rank | University | Status | Recommended action |
| ---: | ---: | --- | --- | --- |
| 1 | 50 | Yonsei University | staging only | Review limited-source staged run and decide whether to promote |
| 2 | 51 | University of Bristol | staging only | Review validated unpromoted run |
| 3 | 52 | Carnegie Mellon University | staging only | Review validated repaired run |
| 4 | 54 | The Hong Kong Polytechnic University | staging only | Review validated unpromoted run |
| 5 | 55 | New York University (NYU) | staging only, validator failing | Repair artifact schema/hashes before review |
| 6 | 56 | The London School of Economics and Political Science (LSE) | staging only | Review validated unpromoted run |
| 7 | 57 | Kyoto University | staging only | Review Japanese original-language evidence in validated unpromoted run |
| 8 | 58 | Ludwig-Maximilians-Universitat Munchen | staging only | Review German/English evidence handling in validated unpromoted run |
| 9 | 58 | Universiti Malaya (UM) | staging only | Review validated unpromoted run |
| 10 | 60 | KU Leuven | missing | New source-discovery crawl; expect Dutch/French/English source variants |

## Top 100 Coverage Table

| QS rank | University | Country/region | Status | Public slug or staging run |
| ---: | --- | --- | --- | --- |
| 1 | Massachusetts Institute of Technology (MIT) | United States | public | `massachusetts-institute-of-technology` |
| 2 | Imperial College London | United Kingdom | public | `imperial-college-london` |
| 3 | Stanford University | United States | public | `stanford-university` |
| 4 | University of Oxford | United Kingdom | public | `university-of-oxford` |
| 5 | Harvard University | United States | public | `harvard-university` |
| 6 | University of Cambridge | United Kingdom | public | `university-of-cambridge` |
| 7 | ETH Zurich | Switzerland | public | `eth-zurich` |
| 8 | National University of Singapore (NUS) | Singapore | public | `national-university-of-singapore` |
| 9 | UCL | United Kingdom | public | `ucl` |
| 10 | California Institute of Technology (Caltech) | United States | public | `california-institute-of-technology` |
| 11 | The University of Hong Kong | Hong Kong SAR | public | `university-of-hong-kong` |
| 12 | Nanyang Technological University, Singapore (NTU Singapore) | Singapore | public | `nanyang-technological-university` |
| 13 | University of Chicago | United States | public | `university-of-chicago` |
| 14 | Peking University | China (Mainland) | public | `peking-university` |
| 15 | University of Pennsylvania | United States | public | `university-of-pennsylvania` |
| 16 | Cornell University | United States | public | `cornell-university` |
| 17 | Tsinghua University | China (Mainland) | public | `tsinghua-university` |
| 17 | University of California, Berkeley (UCB) | United States | public | `university-of-california-berkeley` |
| 19 | The University of Melbourne | Australia | public | `university-of-melbourne` |
| 20 | The University of New South Wales (UNSW Sydney) | Australia | public | `unsw-sydney` |
| 21 | Yale University | United States | public | `yale-university` |
| 22 | EPFL - Ecole polytechnique federale de Lausanne | Switzerland | public | `epfl` |
| 22 | Technical University of Munich | Germany | public | `technical-university-of-munich` |
| 24 | Johns Hopkins University | United States | public, needs review | `jhu`; separate unpromoted staging run exists at `staging/uapt-runs/uapt-johns-hopkins-university-20260510` |
| 25 | Princeton University | United States | public | `princeton-university` |
| 25 | The University of Sydney | Australia | public | `university-of-sydney` |
| 27 | McGill University | Canada | public | `mcgill-university` |
| 28 | Universite PSL | France | public | `universite-psl` |
| 29 | University of Toronto | Canada | public | `university-of-toronto` |
| 30 | Fudan University | China (Mainland) | public | `fudan-university` |
| 31 | King's College London | United Kingdom | public | `kcl` |
| 32 | Australian National University (ANU) | Australia | public | `anu` |
| 32 | The Chinese University of Hong Kong (CUHK) | Hong Kong SAR | public | `cuhk` |
| 34 | The University of Edinburgh | United Kingdom | public | `edinburgh` |
| 35 | The University of Manchester | United Kingdom | public | `manchester` |
| 36 | Monash University | Australia | public | `monash` |
| 36 | The University of Tokyo | Japan | public | `u-tokyo` |
| 38 | Columbia University | United States | public | `columbia` |
| 38 | Seoul National University | South Korea | public | `snu` |
| 40 | University of British Columbia | Canada | public | `ubc` |
| 41 | Institut Polytechnique de Paris | France | public | `institut-polytechnique-de-paris` |
| 42 | Northwestern University | United States | public | `northwestern-university` |
| 42 | The University of Queensland | Australia | public | `university-of-queensland` |
| 44 | The Hong Kong University of Science and Technology | Hong Kong SAR | public | `hkust` |
| 45 | University of Michigan-Ann Arbor | United States | public | `university-of-michigan-ann-arbor` |
| 46 | University of California, Los Angeles (UCLA) | United States | public | `ucla` |
| 47 | Delft University of Technology | Netherlands | public | `delft-university-of-technology` |
| 47 | Shanghai Jiao Tong University | China (Mainland) | public | `shanghai-jiao-tong-university` |
| 49 | Zhejiang University | China (Mainland) | public | `zhejiang-university` |
| 50 | Yonsei University | South Korea | staging only | `staging/uapt-runs/uapt-yonsei-university-20260512` |
| 51 | University of Bristol | United Kingdom | staging only | `staging/uapt-runs/uapt-university-of-bristol-20260512` |
| 52 | Carnegie Mellon University | United States | staging only | `staging/uapt-runs/uapt-carnegie-mellon-university-20260512` |
| 53 | University of Amsterdam | Netherlands | public | `university-of-amsterdam` |
| 54 | The Hong Kong Polytechnic University | Hong Kong SAR | staging only | `staging/uapt-runs/uapt-the-hong-kong-polytechnic-university-20260512` |
| 55 | New York University (NYU) | United States | staging only, validator failing | `staging/uapt-runs/uapt-new-york-university-20260512` |
| 56 | The London School of Economics and Political Science (LSE) | United Kingdom | staging only | `staging/uapt-runs/uapt-the-london-school-of-economics-and-political-science-20260512` |
| 57 | Kyoto University | Japan | staging only | `staging/uapt-runs/uapt-kyoto-university-20260512` |
| 58 | Ludwig-Maximilians-Universitat Munchen | Germany | staging only | `staging/uapt-runs/uapt-ludwig-maximilians-universitat-munchen-20260512` |
| 58 | Universiti Malaya (UM) | Malaysia | staging only | `staging/uapt-runs/uapt-universiti-malaya-20260512` |
| 60 | KU Leuven | Belgium | missing | `ku-leuven` |
| 61 | Korea University | South Korea | missing | `korea-university` |
| 62 | Duke University | United States | missing | `duke-university` |
| 63 | City University of Hong Kong (CityUHK) | Hong Kong SAR | missing | `city-university-of-hong-kong` |
| 63 | National Taiwan University (NTU) | Taiwan | missing | `national-taiwan-university` |
| 65 | The University of Auckland | New Zealand | missing | `the-university-of-auckland` |
| 66 | University of California, San Diego (UCSD) | United States | missing | `university-of-california-san-diego` |
| 67 | KFUPM | Saudi Arabia | missing | `kfupm` |
| 68 | University of Texas at Austin | United States | missing | `university-of-texas-at-austin` |
| 69 | Brown University | United States | missing | `brown-university` |
| 70 | University of Illinois Urbana-Champaign | United States | missing | `university-of-illinois-urbana-champaign` |
| 70 | Universite Paris-Saclay | France | missing | `universite-paris-saclay` |
| 72 | Lund University | Sweden | missing | `lund-university` |
| 72 | Sorbonne University | France | missing | `sorbonne-university` |
| 74 | The University of Warwick | United Kingdom | missing | `the-university-of-warwick` |
| 75 | Trinity College Dublin, The University of Dublin | Ireland | missing | `trinity-college-dublin-the-university-of-dublin` |
| 76 | University of Birmingham | United Kingdom | missing | `university-of-birmingham` |
| 77 | The University of Western Australia | Australia | missing | `the-university-of-western-australia` |
| 78 | KTH Royal Institute of Technology | Sweden | missing | `kth-royal-institute-of-technology` |
| 79 | University of Glasgow | United Kingdom | missing | `university-of-glasgow` |
| 80 | Universitat Heidelberg | Germany | missing | `universitat-heidelberg` |
| 81 | University of Washington | United States | missing | `university-of-washington` |
| 82 | Adelaide University | Australia | missing | `adelaide-university` |
| 82 | Pennsylvania State University | United States | missing | `pennsylvania-state-university` |
| 84 | Universidad de Buenos Aires (UBA) | Argentina | missing | `universidad-de-buenos-aires` |
| 85 | Tokyo Institute of Technology (Tokyo Tech) | Japan | missing | `tokyo-institute-of-technology` |
| 86 | University of Leeds | United Kingdom | missing | `university-of-leeds` |
| 87 | University of Southampton | United Kingdom | missing | `university-of-southampton` |
| 88 | Boston University | United States | missing | `boston-university` |
| 88 | Freie Universitaet Berlin | Germany | missing | `freie-universitaet-berlin` |
| 88 | Purdue University | United States | missing | `purdue-university` |
| 91 | Osaka University | Japan | missing | `osaka-university` |
| 92 | The University of Sheffield | United Kingdom | missing | `the-university-of-sheffield` |
| 93 | Uppsala University | Sweden | missing | `uppsala-university` |
| 94 | Durham University | United Kingdom | missing | `durham-university` |
| 94 | University of Alberta | Canada | missing | `university-of-alberta` |
| 96 | University of Technology Sydney | Australia | missing | `university-of-technology-sydney` |
| 97 | University of Nottingham | United Kingdom | missing | `university-of-nottingham` |
| 98 | KIT, Karlsruhe Institute of Technology | Germany | missing | `kit-karlsruhe-institute-of-technology` |
| 98 | Politecnico di Milano | Italy | missing | `politecnico-di-milano` |
| 100 | University of Zurich | Switzerland | missing | `university-of-zurich` |

## Coverage Caveats

- Slug matching is a planning aid. Canonical entity resolution must remain in
  the project data contract and public JSON.
- Public status means present in the current public dataset, not necessarily
  human-reviewed or institution-verified.
- `staging only` means a local staged run exists but is not promoted.
- Missing rows should be sent to source discovery, not filled from ranking
  metadata or reference sheets.
