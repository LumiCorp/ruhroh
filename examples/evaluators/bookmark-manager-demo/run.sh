#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import json
import os
import subprocess
from pathlib import Path

workspace = Path(os.environ["RUHROH_EVAL_WORKSPACE_PATH"])
output_path = Path(os.environ["RUHROH_EVAL_OUTPUT_PATH"])
index_path = workspace / "index.html"
bookmarks_path = workspace / "src" / "bookmarks.js"

commands_run = []

def run_command(args):
    completed = subprocess.run(args, cwd=workspace, text=True, capture_output=True, timeout=120)
    commands_run.append({
        "command": " ".join(args),
        "exitCode": completed.returncode,
        "stdout": completed.stdout[-2000:],
        "stderr": completed.stderr[-2000:],
    })
    return completed

test_result = run_command(["pnpm", "test"]) if (workspace / "package.json").exists() else None
html = index_path.read_text(encoding="utf-8") if index_path.exists() else ""
logic = bookmarks_path.read_text(encoding="utf-8") if bookmarks_path.exists() else ""
lower_html = html.lower()
lower_logic = logic.lower()

checks = [
    {
        "id": "app-entrypoint",
        "description": "Workspace contains a local HTML entrypoint.",
        "passed": index_path.exists() and "bookmark" in lower_html,
        "evidence": f"index.html exists={index_path.exists()}",
    },
    {
        "id": "add-list-search-delete",
        "description": "Included tests pass for add, list, search, delete, and persistence behavior.",
        "passed": test_result is not None and test_result.returncode == 0,
        "evidence": "pnpm test exit code=" + ("missing" if test_result is None else str(test_result.returncode)),
    },
    {
        "id": "browser-local-persistence",
        "description": "Implementation uses browser-local persistence.",
        "passed": "localstorage" in lower_logic or "localstorage" in lower_html,
        "evidence": "localStorage reference found=" + str("localstorage" in lower_logic or "localstorage" in lower_html),
    },
    {
        "id": "local-only",
        "description": "No backend or hosted service is required for the demo app.",
        "passed": not any(token in lower_logic for token in ["fetch(", "axios", "postgres", "mongodb", "supabase"]),
        "evidence": "no obvious backend/network dependency tokens found",
    },
]

passed_count = sum(1 for check in checks if check["passed"])
if passed_count == len(checks):
    status = "passed"
elif passed_count >= 2:
    status = "review"
else:
    status = "failed"

criteria_results = [
    {
        "id": check["id"],
        "description": check["description"],
        "status": "passed" if check["passed"] else "failed",
        "score": 1 if check["passed"] else 0,
        "evidenceRefs": [{
            "kind": "command" if check["id"] == "add-list-search-delete" else "file",
            "ref": "pnpm test" if check["id"] == "add-list-search-delete" else str(index_path if check["id"] == "app-entrypoint" else bookmarks_path),
            "summary": check["evidence"],
        }],
    }
    for check in checks
]

result = {
    "version": "ruhroh_eval_result_v1",
    "status": status,
    "goalMet": status == "passed",
    "confidence": "high" if status != "review" else "medium",
    "reasons": [check["description"] for check in checks if check["passed"]],
    "unmetCriteria": [check["description"] for check in checks if not check["passed"]],
    "evidenceRefs": [
        {"kind": "file", "ref": str(index_path), "summary": f"index.html exists={index_path.exists()}"},
        {"kind": "file", "ref": str(bookmarks_path), "summary": f"bookmarks.js exists={bookmarks_path.exists()}"},
    ],
    "commandsRun": commands_run,
    "artifacts": {
        "workspacePath": str(workspace),
        "indexHtml": str(index_path),
        "bookmarksJs": str(bookmarks_path),
    },
    "finalSummary": f"Bookmark manager demo evaluation returned {status} with {passed_count}/{len(checks)} checks passing.",
    "criteriaResults": criteria_results,
    "subscores": {
        "functionality": passed_count / len(checks),
        "workflow": 1 if test_result is not None else 0,
        "buildRun": 1 if test_result is not None and test_result.returncode == 0 else 0,
        "persistence": 1 if checks[2]["passed"] else 0,
        "constraintCompliance": 1 if checks[3]["passed"] else 0,
        "evidenceQuality": 1,
    },
    "judge": {
        "kind": "command",
        "version": "bookmark-manager-demo-v1",
    },
}

output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY
