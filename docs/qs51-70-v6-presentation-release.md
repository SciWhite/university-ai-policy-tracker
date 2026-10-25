# QS rows 51–70 V6 presentation release

This bounded shared-zone release adds twenty V6 presentations to the accepted fifty-school cohort. The existing 208 public Claims for the added schools are retained verbatim; this is not promotion of the private audit corrections. Public JSON and the unchanged MCP catalog use those same records. Institution audits remain PARTIAL.

The new public field allowlist is deliberately limited to school identity, original source quotation rows (explicitly typed as sources), their URLs, declared hashes, language, location and retrieval annotations. Topic interpretations and status conclusions are replaced by pending-verification labels. Private Claim proposals, held audit objects, tool candidates, analysis projections and unapproved student action summaries are excluded. No new snapshot is approved or repinned. Missing public tool records do not establish absence of an institutional service.

The new presentation adapters retain `publicationApproved:false`; the enclosing immutable public package has a separate presentation release authorization. Existing fifty-school adapters, their Claim/tool/snapshot/held/history fields and all seven locale projections are unchanged. Their accepted composition is retained through the legacy shared bundle composition. The common FAQ language fix, source language handling and failed-image fallback remain shared.

Changes uses synchronization contract 2.1.0. The event projection preserves the 791 existing events and adds twenty explicit record-maintenance events with unchanged old/new policy records. It does not publish AI-written change summaries or manufacture substantive policy changes. A missing prior school history remains an explicit gap.

The release uses a single supported lifecycle cutover of one accepted shared-zone artifact; the previously requested 2+18 public canary sequence was cancelled. Production acceptance, BUILD_ID, hashes, capacity and retirement receipts are recorded separately after execution. This document does not claim that a local check or packaging receipt is a production deployment.
