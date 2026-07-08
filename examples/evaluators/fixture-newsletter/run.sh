#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import json
import os
from pathlib import Path

workspace = Path(os.environ["RUHROH_EVAL_WORKSPACE_PATH"])
output_path = Path(os.environ["RUHROH_EVAL_OUTPUT_PATH"])
index_path = workspace / "index.html"

html = index_path.read_text(encoding="utf-8") if index_path.exists() else ""
story_count = html.lower().count("<article")
passed = index_path.exists() and "newsletter" in html.lower() and story_count >= 3

result = {
    "version": "ruhroh_eval_result_v1",
    "status": "passed" if passed else "failed",
    "goalMet": passed,
    "confidence": "high",
    "reasons": ["Fixture newsletter page exists with three story articles."] if passed else ["Fixture newsletter page was missing or incomplete."],
    "unmetCriteria": [] if passed else ["Create a local newsletter page with three sample stories."],
    "evidenceRefs": [
        {
            "kind": "file",
            "ref": str(index_path),
            "summary": f"index.html exists={index_path.exists()} article_count={story_count}",
        }
    ],
    "commandsRun": [],
    "artifacts": {
        "workspacePath": str(workspace),
        "indexHtml": str(index_path),
    },
    "finalSummary": "Fixture evaluator passed the generated newsletter." if passed else "Fixture evaluator did not find a complete newsletter.",
    "criteriaResults": [
        {
            "id": "newsletter-page",
            "description": "Workspace contains a local newsletter page with three sample stories.",
            "status": "passed" if passed else "failed",
            "score": 1 if passed else 0,
            "evidenceRefs": [
                {
                    "kind": "file",
                    "ref": str(index_path),
                    "summary": f"article_count={story_count}",
                }
            ],
        }
    ],
    "subscores": {
        "functionality": 1 if passed else 0,
        "workflow": 1 if passed else 0,
        "buildRun": 1,
        "persistence": 0,
        "constraintCompliance": 1 if passed else 0,
        "evidenceQuality": 1,
    },
    "judge": {
        "kind": "fixture",
        "version": "fixture-newsletter-v1",
    },
}

output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY
