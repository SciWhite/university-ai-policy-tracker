import importlib.util
import json
import pathlib
import tempfile
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


if __name__ == "__main__":
    unittest.main()
