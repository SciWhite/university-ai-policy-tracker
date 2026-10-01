# Twenty-university policy scene candidate

## AI-citation and traffic-informed five: local V3 candidate

Queensland, Johannesburg, ANU, Durham and Auckland now use the shared V3
student page layout. The selection combines the sampled Bing AI Performance
page-citation export, read-only first-party visits and AI-source referrals,
and Bing Webmaster search traffic. Detailed ranges, counts and limits are in
`docs/policy-hero-candidates/ai-citation-five-v3/traffic-and-content-basis.md`.
Each school has a two-panel hero, Do / Don't guide and evidence-linked student
scenes. Johannesburg has two additional scenes; Queensland and Durham have
three each; ANU and Auckland have four each. Four claims-only pages keep the
explicit no-reviewed-student-snapshot notice; Auckland requires its effective
strong snapshot. All five require a pinned reviewed-claims basis. Antigravity's
native image tool returned a 429; the existing New API endpoint generated the
selected art. The new batch is local only, with no full production build or
deployment.

## Previous five: direct V1 to V3 local pages

The illustrated V3 layout has been extended directly from the V1 detail page to
Surrey, Imperial, Adelaide, De La Salle, and UBC. These are local candidates;
no production build or deployment has been made. The first ten pages remain the
earlier V3 cohort. The same components serve all fifteen, but the five new
image sets and action labels are keyed to each school's retained reviewed
claims. Surrey has no effective reviewed student snapshot and continues to
display that notice, with links to its five reviewed claims. The other four
new schools use the effective strong snapshot and linked dimensions.

Each new school has a two-panel hero and an evidence-linked Do / Don't guide.
Surrey has two additional student scenes; Imperial and Adelaide have three
each; De La Salle and UBC have four each. De La Salle's fourth scene addresses
the reviewed detector-evidence claim, without inventing a detector threshold.
No reviewed policy data, public API response, or hidden search-only text is
changed. The illustrations are explanatory signposts; the adjacent native
copy and expandable reviewed evidence remain the source of complete scope.

Generation and lettering QA are recorded in
`docs/policy-hero-candidates/next-five-v3/`. The native Antigravity image
tool made the hero set before its quota response; the existing New API image
endpoint made the remaining accepted candidates. Raw candidates stay in that
directory and selected optimized JPEGs go into
`apps/web/public/assets/policy-scenes/`. No credential is stored in Git.
Read-only first-party and Bing selection data, together with limits on what
those metrics can show, are in
`docs/policy-hero-candidates/next-five-v3/traffic-and-content-basis.md`.

## Ten compact pages (current local candidate)

All ten illustrated pilot pages now put a short, evidence-linked Do / Don't guide directly
after the hero. Each side has one illustrated, hand-lettered comic and three
larger native action links. The images use only shared Harvard starting checks
or Manchester claims-based examples; HGSE and HMS rules remain in scoped
sections, and Manchester retains its no-reviewed-student-snapshot notice.
The school header keeps its update date and omits the QS ranking. Repeated hero
guidance and the visible "Reviewed policy snapshot" summary are removed in
Harvard; its dimension cards show one-line decisions and keep full context
inside each evidence disclosure. Manchester's four existing scene cards are
visible above the reviewed record, even while the claims are collapsed.
Reviewed claim groups and official source lists are collapsed by default;
claim hashes open their containing group. Source candidates, exact lettering,
rejected variants and optimized assets are recorded in
`docs/policy-hero-candidates/quick-guides/README.md`.

This is a local design candidate for the fixed ten-school cohort only. No reviewed claim,
policy snapshot, public API record, or search metadata was changed.

## Distributed policy scenes (local candidate)

The current local iteration places each student scene at the snapshot
dimension or reviewed claim it illustrates. A compact link strip after the
quick-read comic helps students jump to those scenes. Harvard, UNSW, Oxford,
Manchester, and Edinburgh have one quick-read comic plus four scenes; Sydney,
NUS, Utrecht, Bristol, and Deakin have one comic plus three. Harvard, Utrecht,
Bristol, and Deakin keep one research-specific scene in a collapsed disclosure
for the default student view. The number of scenes follows distinct reviewed
student decisions rather than a fixed per-school quota. Ten new image assets,
their source candidates, exact prompts, and policy placement are recorded in
`docs/policy-hero-candidates/distributed-scenes/`.

The four schools without an effective reviewed student snapshot still say so
explicitly. All scene cards retain native summaries and evidence links; no
policy claim, snapshot, or source record changes in this visual iteration.


This is a narrow exception to the shared student-first detail-page rule against
university-specific hero art. Harvard and Manchester were the first deployed
sample. This local candidate extends the same component and recurring student
character to the other eight pages in the fixed ten-page index-recovery cohort.
No university outside that cohort receives a scene.

The current local candidate uses a student action and short embedded labels in
each three-image sequence. These labels are grounded in existing reviewed
claims and are not official university statements. Each hero renders only while its
pinned reviewed-claims basis still matches and the expected student snapshot
state holds. Harvard, UNSW, Sydney, NUS, Oxford, and Utrecht require an
effective strong snapshot. Bristol, Manchester, Edinburgh, and Deakin require
the existing curated claims summary and keep their explicit "No reviewed
summary yet" state and link to the reviewed claims.

Antigravity CLI generated the original two-school candidates as 1536 x 1024
PNGs; the selected Harvard and Manchester assets ship as optimized JPEGs. For
the local eight-page candidate, Antigravity generated first-pass PNGs for every
remaining school. Five improved second-pass variants were selected first.
After the image-model quota reset, Antigravity CLI generated distinct
replacements for Bristol, Edinburgh, and Deakin. Deakin's second pass contained
a numeral-like sketch, so a third pass with geometric sketches was selected.
All eight delivery JPEGs are 1536 x 1024. Original PNGs remain in the local
`docs/policy-hero-candidates/` directory for review and are not part of the
deployed asset set.

The earlier 1536 x 1024 JPEGs are retained as comparison assets; the current
three-image candidate uses square comics, except NUS's responsive hero. The
September 24 UNSW College ELICOS-only Mentor AI claim changed that page's
authored-content fingerprint. Its current 36 reviewed claims were rechecked
against the existing assessment-category title and snapshot summary, which do
not imply campus-wide Mentor AI permission. The pinned basis was updated to
include exactly that added claim. No policy claim, snapshot, source evidence,
or public API contract is changed by this visual candidate.

This ten-page three-image extension remains local until image and copy review
is accepted, then it can be submitted as one release to avoid repeated
whole-site builds.

## Earlier local Harvard and Manchester status-illustration prototype

A local candidate prototype extends the Harvard and Manchester scenes with
action-specific visual scenario checks integrated directly into the hero
illustration frame (`<figure>` and `<figcaption>`). The base images for Harvard
and Manchester are switched to `apps/web/public/assets/policy-scenes/harvard-status.jpg`
and `manchester-status.jpg` (1536x1024), while leaving all other eight university
scene configs unchanged without visual scenario checks.

The later three-image local prototype below replaces both status-card heroes
with generated comics. Their earlier assets remain available for comparison.

### Provenance and reviewed claims grounding

Visual scenario checks are strictly derived from the existing reviewed claims:

- **Harvard University**:
  - **Scenario 1**: Badge `Can, with limits`, Scope `HGSE only`, concise label `Use AI to brainstorm`, detail `Acknowledge permitted AI use in your submission.` Grounded in reviewed HGSE academic integrity and attribution claims (`clm-harvard-university-hgse-academic-integrity` and `clm-harvard-university-hgse-attribution` from `https://registrar.gse.harvard.edu/learning/policies-forms/ai-policy`).
  - **Scenario 2**: Badge `Do not`, Scope `Harvard-wide`, label `Put confidential data in public AI`. Grounded in the reviewed Harvard data-protection claim (`clm-harvard-university-data-protection` from `https://www.huit.harvard.edu/ai/guidelines`).
- **University of Manchester**:
  - **Scenario 1**: Badge `Can, with limits`, Scope `Manchester`, label `Use AI for grammar or spelling`, detail `Keep the meaning unchanged; check your unit rule.` Grounded in reviewed claims CL-009 (spelling and grammar correction permitted without substantive change to content/meaning) and CL-008 (School-level broadening/narrowing for specific units/assignments).
  - **Scenario 2**: Badge `Do not`, Scope `Manchester`, label `Submit AI work as your own`. Grounded in reviewed claim CL-006 (submitting generative AI work as one's own constitutes plagiarism under the Academic Malpractice Procedure).

### Action-specific semantics and presentation guarantees

- **Action-specific state labels**: Badges ("Can, with limits", "Do not") explicitly apply to discrete student actions under defined scopes (e.g. HGSE only vs Harvard-wide; Manchester unit rules), rather than communicating blanket institution-wide permission or prohibition.
- **Accessible native text**: Check cards are rendered as native DOM text within the illustration frame (`figure`/`figcaption`), ensuring full accessibility for assistive technologies rather than embedding text into static images.
- **Legibility and responsive framing**:
  - On desktop viewports, scenario cards sit at the bottom of the illustration frame over the desk area. Verify face visibility in the actual page before release.
  - On mobile viewports (including 390px), the illustration frame stacks the image wrap and caption vertically, ensuring the artwork remains fully visible while cards span full width with high-contrast text and comfortable touch sizing.
  - Cards use the existing semantic color tokens; contrast still needs visual and automated review in both themes before release.
- **Snapshot notice and evidence link preservation**: Manchester retains its explicit "No reviewed student policy snapshot has been published yet." notice and `#claims` evidence link; Harvard retains its link to `#student-policy-heading`.
- **Local-only candidate**: This candidate remains local. No policy claims, snapshots, source evidence, index-recovery hashes, or API routes are modified.

## Local NUS action illustration

The initial Antigravity CLI NUS decision board was rejected as too text-heavy.
After Antigravity image generation returned HTTP 429, the replacement was
drawn with Codex's built-in image model. It shows the same student checking a
task brief and recording acknowledgement, then keeping a data folder away
from an AI screen. The only embedded text is: “CAN, WITH CONDITIONS”;
“AI in unsupervised take-home assessments”; “DO NOT”; and “Upload NUS data to
unapproved AI.” The first action is subject to the specific assessment rule
and acknowledgement requirement, explained in the native guidance and
reviewed snapshot below the image. The image is not a blanket permission.

The selected desktop and mobile PNGs are
`docs/policy-hero-candidates/nus-action-codex-v2.png` and
`nus-action-mobile-codex-v3.png`. Optimized 3:2 and square JPEGs are served
responsively; the words were inspected at approximate rendered sizes. The
complete meaning is repeated in `alt` text. The wording corresponds to the
reviewed NUS snapshot's `exams` and `privacy_data` dimensions, based on
`clm-nus-unsupervised-default-permitted` and `clm-nus-approved-tools-only`.
Any relevant policy change requires regenerating and checking the artwork;
the pinned reviewed-claims basis hides the scene when evidence changes.
This replacement remains a local candidate without a full production build
or release.

## Local NUS and Manchester three-image pages

The two-page layout now has one quick-read hero and two square scene cards per
school. NUS keeps its existing responsive two-panel hero. Manchester uses the
two-panel `manchester-comic.jpg` hero with short in-image action labels; the
earlier `manchester-status.jpg` asset is retained for comparison. The recurring
blue-hoodie student and drawn campus setting tie all six visible images
together. Image captions and linked reviewed evidence remain native page text.

- NUS: the new cards illustrate citing AI-generated content before submission
  and checking a supervised task's own AI rule. They link to the reviewed
  `disclosure` and `exams` snapshot dimensions.
- Manchester: the new cards illustrate checking the course unit and selecting
  university-approved enterprise AI when inappropriate disclosure is a risk.
  They link to reviewed claims CL-008 and CL-005. The page retains its explicit
  no-reviewed-student-snapshot notice ahead of the detailed claims.

The selected square sources are in
`docs/policy-hero-candidates/three-image-pilot/`; optimized delivery copies
are in `apps/web/public/assets/policy-scenes/`. The sources were generated
through the user-provided image API and visually reviewed. Early Manchester
variants had unwanted paper text and an invented URL, so corrected second
variants were selected. The selected NUS supervised image is also the corrected
second variant. No credentials are stored in the repository.

Cards are laid out side by side on desktop and stacked at 390px. The added
images load lazily below the reviewed snapshot or claims summary. This is a
local prototype only; no complete production build, push, or deployment has
been done for these two pages.

## Local extension to the other eight schools

Each of the other eight pilot pages now also presents a three-image sequence:
one square two-panel action comic in the hero and two square single-action
comics beside the relevant reviewed snapshot or claim summary. The same
blue-hoodie student and warm inked 2D style recur, while the action, setting,
camera angle, and short text differ by school. The story component uses
balanced, cascade, lead-left, and lead-right desktop card arrangements; all
stack without cropping at 390px. Harvard's earlier status-card hero is
superseded by its comic candidate, with the old asset retained.

| School | First added scene | Second added scene | Evidence |
| --- | --- | --- | --- |
| Harvard | HGSE acknowledgement | HMS research authorship | Reviewed disclosure and research dimensions |
| UNSW Sydney | Assessment source acknowledgement | Private information in prompts | Reviewed disclosure and privacy dimensions |
| University of Sydney | Generative translation acknowledgement | Sensitive data | Reviewed disclosure and privacy dimensions |
| Oxford | PGR thesis AI-use statement | Approved protected tools for confidential data | Reviewed disclosure and privacy dimensions |
| Utrecht | Student email for external AI accounts | Research data input | Reviewed privacy and research dimensions |
| Bristol | Translation-tool assessment limit | PGR thesis writing | Reviewed claims `claim-bristol-002` and `claim-bristol-004` |
| Edinburgh | AI agents inside VLE work | ELM access versus task permission | Reviewed claims `claim-edinburgh-004` and `CL-005` |
| Deakin | Record assessment AI use | HDR thesis copyediting limit | Reviewed claims `claim-deakin-acknowledge-genai` and `claim-deakin-hdr-thesis-genai` |

The selected hero sources are documented in
`docs/policy-hero-candidates/comic-api-batch/README.md`. The 16 new
single-action prompts and raw candidates are recorded in
`docs/policy-hero-candidates/three-image-pilot/eight-school-manifest.json` and
`remaining-eight/`. Thirteen were accepted from the user-provided image
gateway. The gateway returned HTTP 429 when three text-repair requests were
attempted; the Oxford PGR, Oxford confidential-data, and Bristol translation
images were corrected with the built-in image editor. The rejected first
versions remain local candidates; the optimized JPEGs in
`apps/web/public/assets/policy-scenes/` are the page assets. No API key is
stored in the repository.

Bristol, Edinburgh, and Deakin still show the explicit notice that no reviewed
student policy snapshot has been published. Their images link to individual
reviewed claims and do not present a new snapshot. All ten visual sequences
remain gated by the same pinned reviewed-claims basis. The extension is local
only; no full production build, push, or deployment has been performed.

The later local four-image extension adds one PGR plot-creation scene to
Oxford and one in-class third-party AI translation scene to Edinburgh. Both
use the same character and connect to existing reviewed evidence; Edinburgh
continues to display its no-snapshot notice. The story component now accepts
variable scene counts, with three compact columns on wide desktops and stacked
cards on mobile. See
`docs/policy-hero-candidates/three-image-pilot/four-image-extension-prompt.md`
for image wording, scope, and generation details.

## Student-first expansion

The next local batch adds one student decision each to Harvard (check the
specific course rule), UNSW (licensed tool access does not confer assessment
permission), and Manchester (cite or acknowledge AI outputs used in work).
The exact image briefs and credential-free regeneration instructions are in
`docs/policy-hero-candidates/student-first-batch/README.md`.

Image count follows distinct student decisions rather than a three-scene
quota. The overview comic comes first; common assessment decisions come next;
specialized research guidance can sit in a labelled expandable section.
Harvard's HMS authorship scene is the first example of that research section,
which is closed in the default student view and opens under the existing
`?for=researcher` role view. HGSE remains explicitly scoped to its school.
This does not change the
snapshot or reviewed-claims gates, and Manchester still states that no reviewed
student policy snapshot has been published.
