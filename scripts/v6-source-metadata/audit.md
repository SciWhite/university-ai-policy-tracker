Independently audit final metadata records about university AI-policy documents. Work ONLY from this file; no web, no other files:
{file}

Each document sits between "===== DOC <docId> =====" and "----- TEXT END <docId> -----", with its FINAL record and the source TEXT. For every docId return {"docId", "displayDateCorrect", "datesCorrect", "issuerCorrect", "approvedByCorrect", "finding"}: booleans judged against the TEXT and the rules below, and "finding" as one line naming each wrong or missed value with the supporting quote ("none" if all correct). Do not rewrite records.

{rules}
