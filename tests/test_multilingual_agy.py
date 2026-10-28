import importlib.util
import json
import pathlib
import tempfile
import sys
import contextlib
import io
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("agy_batch", pathlib.Path(__file__).resolve().parents[1] / "scripts/translate-multilingual-agy.py")
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)


class AgyOutputAcceptance(unittest.TestCase):
    def test_truncated_or_conflicting_success_payload_is_rejected(self):
        for payload in ['{"u0":"x"', '{"u0":"x"}\n{"u0":', '{"u0":"x"}\n{"u0":"y"}', '']:
            with self.assertRaises(ValueError):
                batch.parse_response(payload)

    def test_cli_duplicate_result_requires_two_identical_complete_objects(self):
        parsed, count = batch.parse_response('{"u0":"x"}\n{"u0": "x"}')
        self.assertEqual(parsed, {"u0": "x"})
        self.assertEqual(count, 2)

    def test_fenced_json_is_recovered_only_when_it_is_one_complete_whole_result(self):
        self.assertEqual(batch.parse_response('```json\n{"u0":"x"}\n```'), ({"u0": "x"}, 1))
        for value in ['Here it is:\n```json\n{"u0":"x"}\n```', '```json\n{"u0":"x"\n```', '```json\n{"u0":"x"}\n```\nextra']:
            with self.assertRaises(ValueError): batch.parse_response(value)

    def test_incomplete_fields_and_lost_identifiers_are_rejected(self):
        source = {"u0": "Open {count} sources for cc-ku-010 at https://example.edu/policy on 2026-10-28"}
        for target in [{}, {"u0": "Open sources"}, {"u0": source["u0"].replace("2026-10-28", "2026-10-29")}, {"u0": source["u0"] + "\u202e"}]:
            with self.assertRaises(ValueError):
                batch.validate(target, source)

    def test_claim_identity_uses_frozen_ids_not_ordinary_hyphenated_prose(self):
        batch.validate({"u0": "au niveau des affirmations"}, {"u0": "claim-level"})
        with self.assertRaises(ValueError):
            batch.validate({"u0": "Voir claim-wrong"}, {"u0": "See claim-uma-student-exam-ai-guidance"}, {"claim-uma-student-exam-ai-guidance"})

    def test_brand_gloss_can_repeat_name_but_ids_cannot_be_duplicated(self):
        batch.validate({"u0": "ChatGPT（ChatGPT workshop）"}, {"u0": "ChatGPT workshop"})
        with self.assertRaises(ValueError):
            batch.validate({"u0": "cc-ku-010 cc-ku-010"}, {"u0": "cc-ku-010"})

    def test_amounts_and_durations_cannot_change_during_translation(self):
        source = {"u0": "Pay 25 for 30 days; 3 accounts use Microsoft 365 Copilot."}
        batch.validate({"u0": "Payer 25 pour 30 jours ; 3 comptes utilisent Microsoft 365 Copilot."}, source)
        batch.validate({"u0": "25円・30日・3件 Microsoft 365 Copilot"}, source)
        batch.validate({"u0": "3つ"}, {"u0": "three scenarios"})
        for text in ["Payer 25 pour 60 jours ; 3 comptes utilisent Microsoft 365 Copilot.", "Payer 25 pour 30 jours ; les comptes utilisent Microsoft 365 Copilot."]:
            with self.assertRaises(ValueError): batch.validate({"u0": text}, source)

    def test_status_identifiers_keep_their_original_code(self):
        batch.validate({"u0": "Statut : conditionally_allowed"}, {"u0": "Status: conditionally_allowed"})
        with self.assertRaises(ValueError):
            batch.validate({"u0": "Statut : autorisé sous conditions"}, {"u0": "Status: conditionally_allowed"})

    def test_openclaw_envelope_requires_the_requested_gemini_model(self):
        correct = {"ok": True, "status": "ok", "model": "cliproxy/gemini-3.8-flash-high", "final": '{"u0":"x"}'}
        self.assertEqual(batch.model_response(correct, "openclaw")[0], {"u0": "x"})
        with self.assertRaises(ValueError): batch.model_response({**correct, "model": "other-model"}, "openclaw")

    def reviewed_fixture(self, directory):
        units, ids, source_sha = {"u0": "Rule 19 and 20."}, {"u0": "a" * 64}, "b" * 64
        def save(name, value):
            (directory / name).write_text(json.dumps(value) + "\n")
            return batch.sha((directory / name).read_bytes())
        prompt = "Previous frozen generation prompt"
        (directory / "prompt.txt").write_text(prompt)
        save("input.json", {"locale": "zh", "sourceSha256": source_sha, "strings": units, "sourceIds": ids})
        target_sha = save("translations.json", {"u0": "Synthetic fixture 19; 20."})
        accepted_sha = save("reviewed-translations.json", {"u0": "Synthetic reviewed fixture 19; 20."})
        (directory / "semantic-review").mkdir()
        (directory / "semantic-review/prompt.txt").write_text("Previous frozen review prompt")
        save("semantic-review/review.json", {"checkedIds": ["u0"], "unresolvedIds": [], "issues": []})
        save("receipt.json", {"locale": "zh", "model": batch.MODEL, "backend": "openclaw", "thinking": "low", "sourceSha256": source_sha, "promptSha256": batch.sha(prompt.encode()), "structuralStatus": "PASS", "translationsSha256": target_sha})
        save("semantic-receipt.json", {"locale": "zh", "model": batch.MODEL, "backend": "openclaw", "thinking": "low", "sourceSha256": source_sha, "structuralStatus": "PASS", "semanticStatus": "machine_review_complete", "checkedStrings": 1, "inputTranslationsSha256": target_sha, "reviewedTranslationsSha256": accepted_sha, "promptSha256": batch.sha((directory / "semantic-review/prompt.txt").read_bytes())})
        return directory, "zh", units, ids, source_sha, set()

    def test_stronger_prompt_reuses_only_intact_complete_review_without_model_calls(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = self.reviewed_fixture(pathlib.Path(temporary))
            with patch.object(batch.subprocess, "run", side_effect=AssertionError("Unexpected model invocation")):
                self.assertEqual(batch.run_job(job, 900, "openclaw", "unused", "low")["structuralStatus"], "PASS")
                self.assertEqual(batch.review_job(job, 900, "openclaw", "unused", "low")["checkedStrings"], 1)

    def test_prompt_upgrade_rejects_changed_inputs_and_tampered_or_incomplete_reviews(self):
        for change in ["source", "reviewed_bytes", "review_coverage", "review_prompt", "missing_review"]:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as temporary:
                directory = pathlib.Path(temporary)
                job = self.reviewed_fixture(directory)
                if change == "source":
                    value = json.loads((directory / "input.json").read_text()); value["strings"]["u0"] += " changed"
                    (directory / "input.json").write_text(json.dumps(value))
                elif change == "reviewed_bytes":
                    (directory / "reviewed-translations.json").write_text('{"u0":"Synthetic altered fixture 19; 20."}')
                elif change == "review_coverage":
                    (directory / "semantic-review/review.json").write_text('{"checkedIds":[],"unresolvedIds":[],"issues":[]}')
                elif change == "review_prompt":
                    (directory / "semantic-review/prompt.txt").write_text("Changed review prompt")
                else:
                    (directory / "semantic-receipt.json").unlink()
                with patch.object(batch.subprocess, "run", side_effect=AssertionError("Unexpected model invocation")):
                    with self.assertRaises((ValueError, FileNotFoundError)):
                        batch.run_job(job, 900, "openclaw", "unused", "low")

    def numeric_fixture(self):
        units = {"u0": "Rule No.79."}
        units.update({"u" + str(i): "Synthetic display text." for i in range(1, 20)})
        target = {**units, "u0": "Fixture 79 (Rule No.79)."}
        return units, target

    def model_result(self, value):
        wrapper = {"ok": True, "status": "ok", "model": "cliproxy/" + batch.MODEL, "final": json.dumps(value), "bridgeCalls": {}}
        return SimpleNamespace(returncode=0, stdout=json.dumps(wrapper).encode(), stderr=b"")

    def test_openclaw_numeric_repair_is_one_bounded_call_and_generation_stays_review_pending(self):
        units, target = self.numeric_fixture()
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary) / "batch"
            job = directory, "ru", units, {key: key for key in units}, "a" * 64, set()
            with patch.object(batch.subprocess, "run", side_effect=[self.model_result(target), self.model_result({"u0": "Synthetic fixture No.79."})]) as model:
                receipt = batch.run_job(job, 900, "openclaw", "unused", "low")
            self.assertEqual(model.call_count, 2)  # One generation plus one correction, never a loop.
            self.assertEqual(receipt["structuralStatus"], "PASS")
            self.assertEqual(receipt["semanticStatus"], "pending")
            self.assertEqual(receipt["repairedKeys"], ["u0"])
            self.assertEqual(json.loads((directory / "stdout.json").read_text())["final"], json.dumps(target))
            accepted = json.loads((directory / "translations.json").read_text())
            batch.validate(accepted, units)
            self.assertNotEqual(accepted["u0"], target["u0"])
            self.assertFalse((directory / "reviewed-translations.json").exists())

    def test_numeric_repair_refuses_incomplete_dense_or_non_numeric_defects_without_model_calls(self):
        units, target = self.numeric_fixture()
        cases = [({}, units), ({"u0": "Fixture"}, {"u0": "Preserve {name} and 79."}),
                 ({"u0": "1", "u1": "1"}, {"u0": "2", "u1": "2"})]
        for targets, sources in cases:
            with tempfile.TemporaryDirectory() as temporary, patch.object(batch.subprocess, "run", side_effect=AssertionError("Unexpected model invocation")):
                with self.assertRaises(ValueError):
                    batch.repair_numeric_output(pathlib.Path(temporary), "ru", targets, sources, set(), "a" * 64, 900, "unused", "low")

    def test_invalid_numeric_correction_is_preserved_and_never_retried_automatically(self):
        units, target = self.numeric_fixture()
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            with patch.object(batch.subprocess, "run", return_value=self.model_result({"u0": "Still 79 twice 79."})) as model:
                with self.assertRaises(ValueError):
                    batch.repair_numeric_output(directory, "ru", target, units, set(), "a" * 64, 900, "unused", "low")
                with self.assertRaises(FileExistsError):
                    batch.repair_numeric_output(directory, "ru", target, units, set(), "a" * 64, 900, "unused", "low")
            self.assertEqual(model.call_count, 1)
            self.assertEqual(json.loads((directory / "numeric-repair/receipt.json").read_text())["structuralStatus"], "FAIL")
            self.assertTrue((directory / "numeric-repair/stdout.json").exists())

    def test_queue_defers_failed_results_and_exceptions_but_dispatches_every_later_job(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            source = {"units": {batch.sha(text.encode()): {"source": text, "sourceSha256": batch.sha(text.encode())} for text in ["First display.", "Second display.", "Third display."]}}
            source_path, output = root / "source.json", root / "out"
            source_path.write_text(json.dumps(source))
            argv = ["batch", "--source", str(source_path), "--output", str(output), "--locales", "ja,fr", "--batch-chars", "1", "--concurrency", "2", "--semantic-review"]
            called = []
            def generate(job, *args):
                directory, locale = job[:2]
                called.append((locale, directory.name))
                directory.mkdir(parents=True, exist_ok=True)
                (directory / "stdout.json").write_text('{"original":"preserved"}')
                if directory.name == "batch-0000":
                    if locale == "ja": raise ValueError("Synthetic incomplete model output")
                    return {"structuralStatus": "FAIL", "error": "Synthetic unresolved semantic review"}
                return {"structuralStatus": "PASS", "semanticStatus": "machine_review_complete", "checkedStrings": 1}
            with patch.object(sys, "argv", argv), patch.object(batch, "generate_and_review", side_effect=generate), contextlib.redirect_stdout(io.StringIO()):
                batch.main()
            self.assertEqual(len(called), 6)
            progress = json.loads((output / "progress.json").read_text())
            self.assertEqual(progress["stage"], "generation_finished_with_review_backlog")
            self.assertEqual(progress["completedJobs"], 4)
            self.assertEqual(progress["completedStrings"], 4)
            self.assertEqual(progress["deferredJobs"], 2)
            self.assertEqual(progress["deferredStrings"], 2)
            backlog = json.loads((output / "review-backlog.json").read_text())
            self.assertEqual(len(backlog["items"]), 2)
            self.assertTrue(all(item["sourceSha256"] == batch.sha(source_path.read_bytes()) for item in backlog["items"]))
            self.assertEqual((output / "ja/batch-0000/stdout.json").read_text(), '{"original":"preserved"}')
            # Reconciliation only removes a deferred job after a successful validated result.
            with patch.object(sys, "argv", argv), patch.object(batch, "generate_and_review", return_value={"structuralStatus": "PASS", "semanticStatus": "machine_review_complete", "checkedStrings": 1}), contextlib.redirect_stdout(io.StringIO()):
                batch.main()
            progress = json.loads((output / "progress.json").read_text())
            self.assertEqual(progress["stage"], "complete")
            self.assertEqual(progress["completedJobs"], 6)
            self.assertEqual(progress["deferredJobs"], 0)
            events = [json.loads(line) for line in (output / "review-backlog-events.jsonl").read_text().splitlines()]
            self.assertEqual(sum(event["event"] == "deferred_for_operator_review" for event in events), 2)
            self.assertEqual(sum(event["event"] == "resolved_after_validation" for event in events), 2)

    def test_explicit_pause_still_prevents_dispatch(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary); output = root / "out"; output.mkdir()
            text = "Synthetic display."
            source = root / "source.json"; source.write_text(json.dumps({"units": {batch.sha(text.encode()): {"source": text, "sourceSha256": batch.sha(text.encode())}}}))
            (output / "PAUSE").write_text("Operator instruction")
            with patch.object(sys, "argv", ["batch", "--source", str(source), "--output", str(output), "--locales", "ja"]), patch.object(batch, "generate_and_review", side_effect=AssertionError("Paused queue dispatched a job")), contextlib.redirect_stdout(io.StringIO()):
                batch.main()
            self.assertEqual(json.loads((output / "progress.json").read_text())["stage"], "paused_before_dispatch")

    def test_operator_can_borrow_one_slot_while_remaining_jobs_continue(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary); output = root / "out"; output.mkdir()
            text = "Synthetic display."
            source = root / "source.json"; source.write_text(json.dumps({"units": {batch.sha(text.encode()): {"source": text, "sourceSha256": batch.sha(text.encode())}}}))
            (output / "OPERATOR_REPAIR_SLOT").write_text("One operator repair in progress")
            active, peak, calls = 0, 0, 0
            lock = threading.Lock()
            def generate(*args):
                nonlocal active, peak, calls
                with lock:
                    active += 1; calls += 1; peak = max(peak, active)
                time.sleep(0.02)
                with lock: active -= 1
                return {"structuralStatus": "PASS", "checkedStrings": 1}
            argv = ["batch", "--source", str(source), "--output", str(output), "--locales", "ja,fr,pl,es,nl,ms", "--concurrency", "4"]
            with patch.object(sys, "argv", argv), patch.object(batch, "generate_and_review", side_effect=generate), contextlib.redirect_stdout(io.StringIO()):
                batch.main()
            self.assertEqual(calls, 6)
            self.assertLessEqual(peak, 3)
            progress = json.loads((output / "progress.json").read_text())
            self.assertTrue(progress["operatorRepairSlotReserved"])
            self.assertEqual(progress["stage"], "complete")

    def test_prior_failed_generation_is_deferred_with_its_original_error_without_model_calls(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            job = self.reviewed_fixture(directory)
            (directory / "translations.json").unlink()
            receipt = json.loads((directory / "receipt.json").read_text())
            receipt.update(structuralStatus="FAIL", error="Protected token mismatch: u0 ChatGPT Edu")
            (directory / "receipt.json").write_text(json.dumps(receipt))
            with patch.object(batch.subprocess, "run", side_effect=AssertionError("Unexpected model invocation")):
                result = batch.run_job(job, 900, "openclaw", "unused", "low")
            self.assertEqual(result["error"], receipt["error"])
            self.assertEqual(result["structuralStatus"], "FAIL")


if __name__ == "__main__":
    unittest.main()
