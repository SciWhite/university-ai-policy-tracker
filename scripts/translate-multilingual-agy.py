"""Generate private translation candidates; never promotes or edits public policy data."""
import argparse
import concurrent.futures
import collections
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import time

MODEL = "gemini-3.8-flash-high"
NUMERIC_CONTROLS = ("Keep every literal digit sequence exactly as written and with exactly the source occurrence count. "
                    "For example Article 19 and Article 20 must retain 19 and 20, never Chinese numeral characters. "
                    "A numbered rule such as Rule No.79 must contain 79 only once: do not duplicate it in a translated label plus an English parenthetical gloss. "
                    "Apply these controls to your final corrections as well as the initial translation.")
LANGUAGES = {"zh": "Simplified Chinese", "fr": "French", "pl": "Polish", "es": "Spanish", "nl": "Dutch", "ms": "Malay", "ja": "Japanese", "ko": "Korean", "pt": "Portuguese, neutral across Portugal and Brazil", "ar": "Modern Standard Arabic", "ru": "Russian", "de": "German", "it": "Italian", "cs": "Czech", "tr": "Turkish", "fi": "Finnish", "sv": "Swedish", "da": "Danish", "nb": "Norwegian Bokmal", "hu": "Hungarian", "lt": "Lithuanian", "id": "Indonesian", "vi": "Vietnamese", "th": "Thai", "fa": "Persian", "he": "Hebrew", "hi": "Hindi", "ur": "Urdu", "bn": "Bengali", "uk": "Ukrainian", "el": "Greek", "zh-Hant": "Traditional Chinese"}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def parse_response(response):
    if not isinstance(response, str):
        return response, 1
    # Accept a single whole JSON code block only when the entire result is
    # enclosed. Never recover a truncated object or discard surrounding prose.
    fenced = re.fullmatch(r"\s*```(?:json)?[ \t]*\n([\s\S]*?)\n```\s*", response)
    if fenced:
        response = fenced.group(1)
    # The CLI has emitted the same complete schema result twice in one response.
    # Recover only identical, independently complete documents, never partial JSON.
    decoder = json.JSONDecoder()
    index, documents = 0, []
    while index < len(response):
        if response[index:].isspace():
            break
        index += len(response[index:]) - len(response[index:].lstrip())
        value, index = decoder.raw_decode(response, index)
        documents.append(value)
    if not documents or any(value != documents[0] for value in documents[1:]):
        raise ValueError("Empty or conflicting JSON result documents")
    return documents[0], len(documents)


def protected(text, immutable_ids=()):
    patterns = [r"\{[^{}]+\}", r"https?://[^\s<>\"']+", r"(?<![a-zA-Z0-9])[a-f0-9]{64}(?![a-zA-Z0-9])", r"\bcc-[a-zA-Z0-9_-]+", r"\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b", r"\b(?:ChatGPT(?: Edu)?|Microsoft 365 Copilot|Copilot|UTOL|UTokyo|HGSE|T[0-5]|AI\+X|PARTIAL|UNVERIFIED)\b", r"\b\d{4}-\d{2}-\d{2}(?:T[0-9:.]+Z)?\b"]
    tokens = set(token for pattern in patterns for token in re.findall(pattern, text))
    # Claim IDs come from the frozen inventory, not a prefix guess that also
    # mistakes ordinary prose such as "claim-level" for an identifier.
    tokens.update(token for token in immutable_ids if token in text)
    return sorted(tokens)


def validate(strings, units, immutable_ids=()):
    if not isinstance(strings, dict) or set(strings) != set(units):
        raise ValueError("Incomplete or unexpected JSON fields")
    for key, source in units.items():
        target = strings[key]
        if not isinstance(target, str) or not target.strip():
            raise ValueError("Empty translation: " + key)
        if re.search("[\u202a-\u202e\u2066-\u2069]", target):
            raise ValueError("Bidi control characters: " + key)
        for token in protected(source, immutable_ids):
            brand = re.fullmatch(r"ChatGPT(?: Edu)?|Microsoft 365 Copilot|Copilot|UTOL|UTokyo|HGSE", token)
            if token not in target or (not brand and source.count(token) != target.count(token)):
                raise ValueError("Protected token mismatch: " + key + " " + token)
        def numbers(value):
            for token in sorted(protected(value, immutable_ids), key=len, reverse=True):
                value = value.replace(token, " ")
            return collections.Counter(re.findall(r"(?<![A-Za-z0-9_])\d+(?:[.,:/-]\d+)*(?![A-Za-z0-9_])", value))
        # A written-out source number may naturally become a digit in a target
        # language. Require existing literal amounts/counts to survive; the
        # semantic review checks any additional target numerals against prose.
        target_numbers = numbers(target)
        if any(target_numbers[number] != count for number, count in numbers(source).items()):
            raise ValueError("Numeric amount, duration or count mismatch: " + key)
    return strings


def model_command(directory, prompt, timeout, backend, config, thinking="high"):
    if backend == "openclaw":
        return [str(pathlib.Path.home() / ".local/bin/openclaw"), "agent", "exec", "--config", config, "--cwd", str(directory), "--model", "newapi/cliproxy/" + MODEL, "--thinking", thinking, "--message-file", str(directory / "prompt.txt"), "--json", "--timeout", str(timeout)]
    return [str(pathlib.Path.home() / ".local/bin/agy"), "--model", MODEL, "--mode", "plan", "--disable-slash-commands", "--output-format", "json", "--json-schema", str(directory / "schema.json"), "--print-timeout", str(timeout) + "s", "--print", prompt]


def model_response(wrapper, backend):
    if backend == "openclaw":
        if wrapper.get("ok") is not True or wrapper.get("status") != "ok" or wrapper.get("model") != "cliproxy/" + MODEL:
            raise ValueError("OpenClaw result failed or used an unexpected model")
        if any(wrapper.get("bridgeCalls", {}).values()): raise ValueError("Translation execution unexpectedly called tools")
        return parse_response(wrapper.get("final"))
    if wrapper.get("status") not in (None, "SUCCESS"):
        raise ValueError("Agy did not complete successfully")
    return parse_response(wrapper.get("response", wrapper))


def verified_review(directory, locale, units, source_sha, immutable_ids, backend, thinking):
    receipt = json.loads((directory / "semantic-receipt.json").read_text())
    review = json.loads((directory / "semantic-review/review.json").read_text())
    accepted = directory / "reviewed-translations.json"
    if (receipt.get("locale") != locale or receipt.get("model") != MODEL or receipt.get("backend") != backend or
            receipt.get("sourceSha256") != source_sha or receipt.get("thinking", "high") != thinking or
            receipt.get("structuralStatus") != "PASS" or receipt.get("semanticStatus") != "machine_review_complete" or
            receipt.get("checkedStrings") != len(units) or
            receipt.get("inputTranslationsSha256") != sha((directory / "translations.json").read_bytes()) or
            receipt.get("reviewedTranslationsSha256") != sha(accepted.read_bytes()) or
            receipt.get("promptSha256") != sha((directory / "semantic-review/prompt.txt").read_bytes()) or
            set(review.get("checkedIds", [])) != set(units) or len(review.get("checkedIds", [])) != len(units) or
            review.get("unresolvedIds") != []):
        raise ValueError("Semantic review basis or complete coverage changed: " + str(directory))
    validate(json.loads(accepted.read_text()), units, immutable_ids)
    return receipt


def repair_numeric_output(directory, locale, strings, units, immutable_ids, source_sha, timeout, config, thinking):
    """One model correction for a small, completely inspected numeric-only failure."""
    if not isinstance(strings, dict) or set(strings) != set(units):
        raise ValueError("Numeric repair requires a complete original object")
    bad = {}
    for key, source in units.items():
        try:
            validate({key: strings[key]}, {key: source}, immutable_ids)
        except ValueError as error:
            if not str(error).startswith("Numeric amount, duration or count mismatch:"):
                raise
            bad[key] = source
    if not bad or len(bad) > max(1, len(units) // 20):
        raise ValueError("Numeric repair exceeds the small numeric-only correction scope")
    repair_dir = directory / "numeric-repair"
    repair_dir.mkdir(exist_ok=False)  # An existing attempt requires operator inspection.
    prompt = ("Correct these complete translations into " + LANGUAGES[locale] +
              ". Return ONLY one complete JSON object keyed by the supplied IDs. No tools, browsing, commands, edits or subagents. "
              "Preserve every policy fact, modality, negation, audience, scope, condition, uncertainty and evidence gap. "
              "Fix the numeric rendering without adding English numbered glosses. Keep URLs, placeholders, Claim IDs, hashes and code identifiers exactly. "
              "No Markdown, HTML or bidi control characters. " + NUMERIC_CONTROLS + "\n" +
              json.dumps({key: {"source": source, "translation": strings[key]} for key, source in bad.items()}, ensure_ascii=False))
    (repair_dir / "prompt.txt").write_text(prompt)
    (repair_dir / "input.json").write_text(json.dumps(bad, ensure_ascii=False, indent=2) + "\n")
    receipt = {"locale": locale, "sourceSha256": source_sha, "promptSha256": sha(prompt.encode()),
               "repairedKeys": list(bad), "attempt": 1, "publicationApproved": False}
    started = time.monotonic()
    try:
        result = subprocess.run(model_command(repair_dir, prompt, timeout, "openclaw", config, thinking),
                                cwd=repair_dir, capture_output=True, timeout=timeout + 30)
        (repair_dir / "stdout.json").write_bytes(result.stdout)
        (repair_dir / "stderr.txt").write_bytes(result.stderr)
        if result.returncode:
            raise ValueError("Numeric correction CLI failed")
        corrected, _ = model_response(json.loads(result.stdout), "openclaw")
        validate(corrected, bad, immutable_ids)
        merged = {**strings, **corrected}
        validate(merged, units, immutable_ids)
        target = repair_dir / "translations.json"
        target.write_text(json.dumps(corrected, ensure_ascii=False, indent=2) + "\n")
        receipt.update(structuralStatus="PASS", translationsSha256=sha(target.read_bytes()))
        return merged, receipt
    except subprocess.TimeoutExpired as error:
        (repair_dir / "stdout.json").write_bytes(error.stdout or b"")
        (repair_dir / "stderr.txt").write_bytes(error.stderr or b"")
        receipt.update(structuralStatus="FAIL", error="Numeric correction process timeout")
        raise ValueError("Numeric correction process timeout") from error
    except Exception as error:
        receipt.update(structuralStatus="FAIL", error=str(error))
        raise
    finally:
        receipt.update(elapsedSeconds=round(time.monotonic() - started, 2), completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
        (repair_dir / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")


def run_job(job, timeout, backend="agy", config=None, thinking="high"):
    directory, locale, units, ids, source_sha, immutable_ids = job
    prompt = ("You are a precise professional translator for a university AI-policy tracker. Translate EVERY supplied string into " + LANGUAGES[locale] + ". Use no tools, no browsing, no commands, no edits, no subagents. Return ONLY the complete JSON object required by the schema. This is translation, not policy authoring. Preserve every sentence, modality (may/should/must), negation, conditions, uncertainty, audience, school/unit/course/assessment scope, dates, and evidence gaps. Never infer permission from absence of evidence or access to tools. Coursework means AI use in assignments/assessment, not studying AI courses. 'Not established' and 'reviewed evidence did not establish' are evidentiary findings: explicitly retain that the materials examined did not establish the rule, NEVER say that the university did not enact/adopt a rule. 'Reviewed' means examined, NEVER revised/amended. Tool availability is not assessment permission. Keep product names, acronyms, T0-T5, AI+X, PARTIAL and IDs exactly. Preserve EVERY URL, {placeholder}, numeric amount, date, duration, source hash and Claim ID byte-for-byte, including any English code labels. Do not translate original quotations: none are supplied as translation targets. If a supplied string quotes a policy term inside explanatory prose, retain the quoted term exactly when it is a code, named category or product. Do not add Markdown, HTML, bidi control characters or factual content. Translate naturally with standard target-language punctuation and spacing. Output strings keyed by the immutable input keys.\n\n" + json.dumps(units, ensure_ascii=False))
    prompt += "\nIMPORTANT QUALITY CONTROLS: Translate natural-language tool conditions and eligibility descriptions, even when an English table/category label is embedded in explanatory prose. Preserve only genuine product names, acronyms and code/status identifiers, not entire English condition sentences. Ordinary meanings such as Paid, Required, Recommended and Unavailable must be translated; they are not immutable code markers. A previous Japanese candidate incorrectly made 'students should clarify' into a necessity: preserve 'should' as a recommendation, never an obligation. Do not copy long English fragments into a translated paragraph."
    prompt += "\nSnake_case identifiers such as conditionally_allowed are genuine code markers: preserve them byte-for-byte, including underscores. Translate surrounding human-readable labels and explanations."
    prompt += "\n" + NUMERIC_CONTROLS
    schema = {"type": "object", "properties": {key: {"type": "string", "minLength": 1} for key in units}, "required": list(units), "additionalProperties": False}
    if backend == "openclaw": prompt += "\nRequired complete JSON schema:\n" + json.dumps(schema)
    prompt_sha = sha(prompt.encode())
    result_path = directory / "translations.json"
    if directory.exists() and not result_path.exists():
        previous = json.loads((directory / "receipt.json").read_text())
        saved = json.loads((directory / "input.json").read_text())
        if (previous.get("structuralStatus") != "FAIL" or previous.get("sourceSha256") != source_sha or
                previous.get("locale") != locale or saved.get("strings") != units or saved.get("sourceIds") != ids):
            raise ValueError("Existing interrupted candidate requires operator review: " + str(directory))
        return previous  # Keep its evidence and defer it, rather than retrying in place.
    if result_path.exists():
        previous = json.loads((directory / "receipt.json").read_text())
        saved = json.loads((directory / "input.json").read_text())
        if (previous.get("sourceSha256") != source_sha or previous.get("thinking", "high") != thinking or
                previous.get("locale") != locale or previous.get("model") != MODEL or previous.get("backend") != backend or
                previous.get("structuralStatus") != "PASS" or saved.get("locale") != locale or
                saved.get("sourceSha256") != source_sha or saved.get("strings") != units or saved.get("sourceIds") != ids or
                previous.get("promptSha256") != sha((directory / "prompt.txt").read_bytes()) or
                previous.get("translationsSha256") != sha(result_path.read_bytes())):
            raise ValueError("Existing candidate has a different frozen basis: " + str(directory))
        validate(json.loads(result_path.read_text()), units, immutable_ids)
        if previous.get("promptSha256") != prompt_sha:
            # A stronger prompt does not invalidate already reviewed exact-source
            # translations. Reuse only with intact full-batch review evidence.
            verified_review(directory, locale, units, source_sha, immutable_ids, backend, thinking)
        return previous
    directory.mkdir(parents=True, exist_ok=False)
    (directory / "schema.json").write_text(json.dumps(schema))
    (directory / "input.json").write_text(json.dumps({"locale": locale, "model": MODEL, "sourceSha256": source_sha, "sourceIds": ids, "strings": units}, ensure_ascii=False, indent=2) + "\n")
    (directory / "prompt.txt").write_text(prompt)
    started = time.time()
    command = model_command(directory, prompt, timeout, backend, config, thinking)
    receipt = {"locale": locale, "model": MODEL, "backend": backend, "thinking": thinking, "sourceSha256": source_sha, "promptSha256": prompt_sha, "semanticStatus": "pending", "publicationApproved": False}
    try:
        result = subprocess.run(command, cwd=directory, capture_output=True, timeout=timeout + 30)
        (directory / "stdout.json").write_bytes(result.stdout)
        (directory / "stderr.txt").write_bytes(result.stderr)
        receipt.update(returnCode=result.returncode, stdoutBytes=len(result.stdout))
        wrapper = json.loads(result.stdout)
        response, document_count = model_response(wrapper, backend)
        if result.returncode:
            raise ValueError("CLI did not complete successfully")
        try:
            strings = validate(response, units, immutable_ids)
        except ValueError as error:
            if backend != "openclaw" or not str(error).startswith("Numeric amount, duration or count mismatch:"):
                raise
            strings, repair = repair_numeric_output(directory, locale, response, units, immutable_ids, source_sha, timeout, config, thinking)
            receipt.update(numericRepairReceiptSha256=sha((directory / "numeric-repair/receipt.json").read_bytes()), repairedKeys=repair["repairedKeys"])
        result_path.write_text(json.dumps(strings, ensure_ascii=False, indent=2) + "\n")
        raw_response = wrapper.get("final" if backend == "openclaw" else "response")
        receipt.update(structuralStatus="PASS", translatedStrings=len(strings), wrapperStatus=wrapper.get("status"), completeResultDocuments=document_count, completeJsonCodeFence=isinstance(raw_response, str) and raw_response.strip().startswith("```"), translationsSha256=sha(result_path.read_bytes()), usage=wrapper.get("usage"), actualModel=wrapper.get("model", MODEL), provider=wrapper.get("provider"))
    except subprocess.TimeoutExpired as error:
        (directory / "stdout.json").write_bytes(error.stdout or b"")
        (directory / "stderr.txt").write_bytes(error.stderr or b"")
        receipt.update(structuralStatus="FAIL", error="CLI process timeout")
    except (ValueError, TypeError, KeyError) as error:
        receipt.update(structuralStatus="FAIL", error=str(error))
    receipt.update(elapsedSeconds=round(time.time() - started, 2), completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    (directory / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"job": str(directory), **receipt}), flush=True)
    return receipt


def review_job(job, timeout, backend="agy", config=None, thinking="high"):
    directory, locale, units, ids, source_sha, immutable_ids = job
    generation = json.loads((directory / "receipt.json").read_text())
    target_path = directory / "translations.json"
    target_sha = sha(target_path.read_bytes())
    receipt_path = directory / "semantic-receipt.json"
    if receipt_path.exists():
        return verified_review(directory, locale, units, source_sha, immutable_ids, backend, thinking)
    translations = json.loads(target_path.read_text())
    review_dir = directory / "semantic-review"
    review_dir.mkdir(exist_ok=False)
    schema = {"type": "object", "properties": {"checkedIds": {"type": "array", "items": {"type": "string"}}, "unresolvedIds": {"type": "array", "items": {"type": "string"}}, "issues": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "reasonEn": {"type": "string"}, "translation": {"type": "string"}}, "required": ["id", "reasonEn", "translation"], "additionalProperties": False}}}, "required": ["checkedIds", "unresolvedIds", "issues"], "additionalProperties": False}
    (review_dir / "schema.json").write_text(json.dumps(schema))
    prompt = ("Independently review EVERY paired university AI-policy/display translation into " + LANGUAGES[locale] + ". No tools, commands, browsing, edits or subagents. Return ONLY a complete JSON object matching the schema. Check every sentence and ID for equivalence, modality, negation, conditions, audience, unit/course/assessment scope, uncertainty, evidence gaps, dates, durations, amounts, identifiers and placeholders. Include all input IDs exactly once in checkedIds. Use unresolvedIds for any item you cannot assess. For every defect include its ID, a specific English reason and the complete corrected target translation. Internally recheck each correction before returning it. Do not include faithful translations in issues. Preserve URLs, {placeholders}, Claim IDs, hashes, product names, T0-T5, AI+X, PARTIAL and other genuine code markers exactly. Snake_case identifiers such as conditionally_allowed must remain byte-for-byte; translate their surrounding human-readable labels and explanations. Translate natural-language tool conditions and ordinary Paid/Required/Recommended/Unavailable labels fully; do not leave English sentences untranslated. 'Should' is a recommendation, not a mandatory rule. 'Not established' is a finding from materials examined, not a claim that a university enacted no policy. 'Reviewed' means examined, not revised/amended. Coursework means AI use in assignments/assessment, not studying AI courses. Tool availability is not assessment permission. Keep teacher/student and university/unit/course scope distinct. The inputs are explanatory display prose, not original evidence quotations. Do not add factual content, Markdown, HTML or bidi controls. Review ordinary UI strings and dynamic placeholders for natural grammar as well.\n" + json.dumps({key: {"source": source, "translation": translations[key]} for key, source in units.items()}, ensure_ascii=False))
    prompt += "\n" + NUMERIC_CONTROLS
    if backend == "openclaw": prompt += "\nRequired complete JSON schema:\n" + json.dumps(schema)
    (review_dir / "prompt.txt").write_text(prompt)
    receipt = {"locale": locale, "model": MODEL, "backend": backend, "thinking": thinking, "sourceSha256": source_sha, "promptSha256": sha(prompt.encode()), "inputTranslationsSha256": target_sha, "nativeSpeakerAcceptance": False, "publicationApproved": False}
    started = time.time()
    try:
        result = subprocess.run(model_command(review_dir, prompt, timeout, backend, config, thinking), cwd=review_dir, capture_output=True, timeout=timeout + 30)
        (review_dir / "stdout.json").write_bytes(result.stdout)
        (review_dir / "stderr.txt").write_bytes(result.stderr)
        receipt.update(returnCode=result.returncode, stdoutBytes=len(result.stdout))
        wrapper = json.loads(result.stdout)
        review, documents = model_response(wrapper, backend)
        if result.returncode: raise ValueError("Semantic CLI did not complete successfully")
        if set(review["checkedIds"]) != set(units) or len(review["checkedIds"]) != len(units): raise ValueError("Incomplete semantic field coverage")
        if not set(review["unresolvedIds"]) <= set(units): raise ValueError("Unknown unresolved IDs")
        seen = set()
        for issue in review["issues"]:
            key = issue["id"]
            if key not in units or key in seen or not issue["reasonEn"].strip(): raise ValueError("Invalid semantic issue identity")
            seen.add(key)
            translations[key] = issue["translation"]
        validate(translations, units, immutable_ids)
        (review_dir / "review.json").write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n")
        if review["unresolvedIds"]: raise ValueError("Unresolved semantic IDs: " + ",".join(review["unresolvedIds"]))
        accepted = directory / "reviewed-translations.json"
        accepted.write_text(json.dumps(translations, ensure_ascii=False, indent=2) + "\n")
        raw_response = wrapper.get("final" if backend == "openclaw" else "response")
        receipt.update(structuralStatus="PASS", semanticStatus="machine_review_complete", checkedStrings=len(units), issuesCorrected=len(seen), completeResultDocuments=documents, completeJsonCodeFence=isinstance(raw_response, str) and raw_response.strip().startswith("```"), reviewedTranslationsSha256=sha(accepted.read_bytes()), usage=wrapper.get("usage"))
    except subprocess.TimeoutExpired as error:
        (review_dir / "stdout.json").write_bytes(error.stdout or b"")
        (review_dir / "stderr.txt").write_bytes(error.stderr or b"")
        receipt.update(structuralStatus="FAIL", semanticStatus="pending", error="Semantic CLI process timeout")
    except (ValueError, KeyError, TypeError) as error:
        receipt.update(structuralStatus="FAIL", semanticStatus="pending", error=str(error))
    receipt.update(elapsedSeconds=round(time.time() - started, 2), completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"stage": "semantic-review", "job": str(directory), **receipt}), flush=True)
    return receipt


def generate_and_review(job, timeout, semantic_review, backend="agy", config=None, review_thinking="high", thinking="high"):
    receipt = run_job(job, timeout, backend, config, thinking)
    if semantic_review and receipt["structuralStatus"] == "PASS": return review_job(job, timeout, backend, config, review_thinking)
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--locales", required=True)
    parser.add_argument("--concurrency", type=int, default=4, choices=range(1, 5))
    parser.add_argument("--batch-chars", type=int, default=12000)
    parser.add_argument("--limit-jobs", type=int)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--semantic-review", action="store_true")
    parser.add_argument("--backend", choices=["agy", "openclaw"], default="agy")
    parser.add_argument("--openclaw-config")
    parser.add_argument("--review-thinking", choices=["low", "medium", "high"], default="high")
    parser.add_argument("--thinking", choices=["low", "medium", "high"], default="high")
    args = parser.parse_args()
    if args.backend == "openclaw" and not args.openclaw_config: parser.error("--openclaw-config is required for the isolated OpenClaw backend")
    if args.backend != "openclaw" and (args.review_thinking != "high" or args.thinking != "high"): parser.error("Thinking controls are supported only by the OpenClaw backend")
    locales = args.locales.split(",")
    if len(set(locales)) != len(locales) or any(locale not in LANGUAGES for locale in locales):
        parser.error("Unknown or duplicate translation locale")
    source_raw = args.source.read_bytes()
    source_sha = sha(source_raw)
    source = json.loads(source_raw)
    immutable_ids = set(claim_id for school in source.get("schools", []) for claim_id in school.get("publicClaimIds", []))
    batches, batch, size = [], [], 0
    for full_id, unit in source["units"].items():
        text = unit["source"]
        if sha(text.encode()) != unit["sourceSha256"] or full_id != unit["sourceSha256"]:
            raise ValueError("Source identity mismatch")
        if batch and size + len(text) > args.batch_chars:
            batches.append(batch)
            batch, size = [], 0
        batch.append((full_id, text))
        size += len(text)
    if batch:
        batches.append(batch)
    jobs = []
    for index, batch in enumerate(batches):
        units = {"u" + str(i): text for i, (_, text) in enumerate(batch)}
        ids = {"u" + str(i): full_id for i, (full_id, _) in enumerate(batch)}
        for locale in locales:
            jobs.append((args.output.resolve() / locale / ("batch-" + str(index).zfill(4)), locale, units, ids, source_sha, immutable_ids))
    if args.limit_jobs:
        jobs = jobs[:args.limit_jobs]
    args.output.mkdir(parents=True, exist_ok=True)
    completed, failures, pending = [], [], {}
    backlog_path = args.output / "review-backlog.json"
    backlog = {}
    if backlog_path.exists():
        saved = json.loads(backlog_path.read_text())
        if saved.get("schemaVersion") != "uapt-translation-review-backlog-v1" or saved.get("sourceSha256") != source_sha:
            raise ValueError("Review backlog has a different frozen source")
        backlog = {item["job"]: item for item in saved["items"]}

    def record_backlog(event, item):
        with (args.output / "review-backlog-events.jsonl").open("a") as ledger:
            ledger.write(json.dumps({"event": event, "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), **item}) + "\n")

    def progress(stage):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        pending_review = {"schemaVersion": "uapt-translation-review-backlog-v1", "sourceSha256": source_sha, "updatedAt": now, "items": list(backlog.values()), "publicationApproved": False}
        temporary = args.output / "review-backlog.next.json"
        temporary.write_text(json.dumps(pending_review, indent=2) + "\n")
        temporary.replace(backlog_path)
        state = {"stage": stage, "updatedAt": now, "backend": args.backend, "model": MODEL, "thinking": args.thinking, "reviewThinking": args.review_thinking, "implementationSha256": sha(pathlib.Path(__file__).read_bytes()), "sourceSha256": source_sha, "totalJobs": len(jobs), "completedJobs": len(completed), "completedStrings": sum(row.get("checkedStrings", row.get("translatedStrings", 0)) for row in completed), "failedJobs": failures, "deferredJobs": len(backlog), "deferredStrings": sum(row["strings"] for row in backlog.values()), "activeJobs": len(pending), "operatorRepairSlotReserved": (args.output / "OPERATOR_REPAIR_SLOT").exists(), "concurrency": args.concurrency, "publicationApproved": False}
        temporary = args.output / "progress.next.json"
        temporary.write_text(json.dumps(state, indent=2) + "\n")
        temporary.replace(args.output / "progress.json")
    if (args.output / "PAUSE").exists():
        progress("paused_before_dispatch")
        return
    progress("running")
    print(json.dumps({"event": "queue-started", "sourceSha256": source_sha, "locales": locales, "batchCount": len(batches), "jobCount": len(jobs), "concurrency": args.concurrency, "candidateOnly": True}), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        iterator = iter(jobs)
        def fill_pending():
            # The operator can borrow one slot for a deferred repair while the
            # other workers continue. Never launch the repair until progress
            # confirms this reservation and the reduced active-job count.
            limit = max(1, args.concurrency - int((args.output / "OPERATOR_REPAIR_SLOT").exists()))
            while len(pending) < limit and not (args.output / "PAUSE").exists():
                job = next(iterator, None)
                if job is None: break
                pending[pool.submit(generate_and_review, job, args.timeout, args.semantic_review, args.backend, args.openclaw_config, args.review_thinking, args.thinking)] = job
        fill_pending()
        progress("running_with_review_backlog" if backlog else "running")
        while pending:
            done, _ = concurrent.futures.wait(pending, return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                finished_job = pending.pop(future)
                try:
                    receipt = future.result()
                except Exception as error:
                    receipt = {"structuralStatus": "FAIL", "error": str(error)}
                key = str(finished_job[0])
                if receipt["structuralStatus"] == "PASS":
                    completed.append(receipt)
                    resolved = backlog.pop(key, None)
                    if resolved: record_backlog("resolved_after_validation", resolved)
                else:
                    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    failure = {"job": key, "locale": finished_job[1], "batch": finished_job[0].name,
                               "sourceSha256": source_sha, "strings": len(finished_job[2]),
                               "error": receipt.get("error", "Output not accepted"),
                               "firstFailedAt": backlog.get(key, {}).get("firstFailedAt", now), "lastFailedAt": now}
                    backlog[key] = failure
                    failures.append(failure)
                    record_backlog("deferred_for_operator_review", failure)
                fill_pending()
                progress("pausing" if (args.output / "PAUSE").exists() else "running_with_review_backlog" if backlog else "running")
        progress("paused" if (args.output / "PAUSE").exists() else "generation_finished_with_review_backlog" if backlog else "complete")


if __name__ == "__main__":
    main()
