# Operator Summary: maintenance-2026-07-07T04-40-28-942Z

Run mode: `qs200`

Reviewed from OCI maintenance output on 2026-07-07. This summary intentionally
does not include raw source text.

## Outcome

- Queued `content_policy_delta` rows in the run: 61
- Unique queued entities in the run: 34
- Lightweight source reviews attempted in this pass: 34
- Conclusive no-promote notes copied locally: 30
- Validated staged artifact bundles created: 3
- Invalid staged artifact candidates held back: 0
- Timeout/inconclusive blocker notes: 1
- Release promotion: `university-of-pennsylvania`, `durham-university`,
  and `the-university-of-western-australia`

The `university-of-pennsylvania`, `durham-university`, and
`the-university-of-western-australia` reviews now have valid
`openclaw-artifact-v1` staged artifact bundles.

## Reviewed Sources

The following entity-level source reviews completed with no-promote notes:

- `brown-university`
- `chalmers-university-of-technology`
- `cuhk`
- `delft-university-of-technology`
- `fudan-university`
- `kcl`
- `king-saud-university`
- `kit-karlsruhe-institute-of-technology`
- `nanyang-technological-university-singapore-ntu-singapore`
- `national-tsing-hua-university`
- `national-yang-ming-chiao-tung-university`
- `pohang-university-of-science-and-technology`
- `queens-university-belfast`
- `snu`
- `technical-university-of-munich`
- `the-hong-kong-polytechnic-university`
- `tongji-university`
- `ubc`
- `university-of-auckland`
- `university-of-california-berkeley`
- `university-of-cape-town`
- `university-of-helsinki`
- `university-of-hong-kong`
- `university-of-north-carolina-at-chapel-hill`
- `university-of-queensland`
- `university-of-sydney`
- `university-of-washington`
- `wageningen-university-and-research`
- `waseda-university`

The following source reviews produced policy-update candidates and validated
after local repair review:

- `university-of-pennsylvania`: valid `openclaw-artifact-v1` bundle.
- `durham-university`: valid repaired `openclaw-artifact-v1` bundle. The
  Microsoft AI Skills Centre candidate from the remote bundle was excluded from
  release because it is contextual news rather than a policy boundary.
- `the-university-of-western-australia`: valid repaired `openclaw-artifact-v1`
  bundle.

These reviews found source-health, metadata, extractor, chrome, landing-page,
or discovery-lead differences rather than confirmed policy-content changes,
except for the validated University of Pennsylvania, Durham University, and
University of Western Australia updates.

## Held Back

`duke-university` remains inconclusive. Its DeepSeek review unit ran for more
than 20 minutes without writing log output, notes, or artifacts, so it was
stopped and a blocker note was written. It must not be treated as either a
no-change result or a policy-content update until a future retry completes.

The reviewed `technical-university-of-munich` row is a discovery lead: the
press release points toward a broader TUM AI Strategy, but the reviewed URL
does not itself carry enough policy content to justify a staged artifact.

## Model/Runner Notes

The first OpenClaw launch used the configured default `nvidia/z-ai/glm-5.1` and
failed for all 10 review units with provider 410 errors before producing notes
or artifacts.

A requested `nvidia/z-ai/glm-5.2` trial was attempted by temporarily adding the
model to the local OpenClaw allowlist/catalog. The provider returned a 400
error, so the OpenClaw configuration was restored from its pre-test backup.

The completed reviews used `deepseek/deepseek-v4-flash` in local embedded
mode.

## Promotion Decision

Promote only the validated University of Pennsylvania, Durham University, and
University of Western Australia bundles. Do not promote the inconclusive Duke
row or any no-promote/source-health notes. HTTP metadata changes, extractor
drift, landing-page changes, source-health signals, and discovery leads are not
publishable policy changes.
