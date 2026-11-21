You are the final quality gate for metadata about university AI-policy documents. No human will review your output, and students see it directly, so be skeptical. Work ONLY from this file; no web, no other files:
{file}

Each document sits between "===== DOC <docId> =====" and "----- TEXT END <docId> -----". It carries two independent CANDIDATE records (A and B; quotes already checked to occur in the text) and then the source TEXT. Read the whole file in chunks and return exactly one final record per docId, matching scripts/v6-source-metadata/record.schema.json.

Check every field of both candidates against the TEXT. Keep what the text clearly supports, fix or remove what it does not, and add an explicit owner, approver or effective/approved/published/revised date that both candidates missed. Where A and B disagree, decide from the TEXT, not by majority. Put a one-line summary of your corrections in "changes" ("none" if you kept everything).

{rules}
