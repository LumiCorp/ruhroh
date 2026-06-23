from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tarfile
import time
import uuid
from pathlib import Path
from typing import Any


RESULT_MARKER_PREFIX = "RUHROH_RESULT_JSON_BASE64:"
DEFAULT_DATASET = "ruhroh@local"
DEFAULT_ADAPTER = "ruhroh-harbor"
DEFAULT_MAX_ITERATIONS = 3
SKIP_WORKSPACE_TAR_NAMES = {"node_modules", ".next", "dist", "build", ".git"}
COMPLETION_TERMINAL_FAILURE_REASONS = {"cannot_satisfy", "policy_blocked", "out_of_scope", "runtime_failure", "infra_failure"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instruction-base64", required=True)
    parser.add_argument("--scenario-id", required=True)
    parser.add_argument("--max-iterations", type=int, default=read_max_iterations())
    args = parser.parse_args()

    load_run_env_file()
    load_repo_dotenv()
    instruction = base64.b64decode(args.instruction_base64).decode("utf-8")
    scenario_id = safe_id(args.scenario_id)
    result = run_ruhroh_trial(
        instruction=instruction,
        scenario_id=scenario_id,
        max_iterations=max(1, args.max_iterations),
        workspace_root=Path(resolve_workspace_root()),
        installed_dir=Path("/installed-agent"),
    )
    emit_result(result)
    return 0 if result.get("status") == "completed" else 1


def run_ruhroh_trial(
    instruction: str,
    scenario_id: str,
    max_iterations: int,
    workspace_root: Path,
    installed_dir: Path,
) -> dict[str, Any]:
    started_at = time.monotonic()
    installed_dir.mkdir(parents=True, exist_ok=True)
    workspace_root.mkdir(parents=True, exist_ok=True)
    run_root = installed_dir / "ruhroh-loop"
    run_root.mkdir(parents=True, exist_ok=True)
    runs_path = installed_dir / "ruhroh-loop-iterations.jsonl"
    journey_path = installed_dir / "ruhroh-loop-journey.json"
    eval_result_path = installed_dir / "ruhroh-loop-eval.json"
    result_path = installed_dir / "ruhroh-loop-result.json"
    workspace_tarball_path = installed_dir / "ruhroh-workspace.tar.gz"
    events_tarball_path = installed_dir / "ruhroh-loop-events.tar.gz"
    transcripts_tarball_path = installed_dir / "ruhroh-loop-transcripts.tar.gz"
    eval_workspace_root = run_root / "eval-workspace"

    implementation_runs: list[dict[str, Any]] = []
    implementation_stopped_reason = "max_iterations"
    adapter = build_run_agent_adapter(
        adapter_id=read_run_agent_adapter(),
        scenario_id=scenario_id,
        workspace_root=workspace_root,
        installed_dir=installed_dir,
        run_root=run_root,
    )
    session_handle = "unstarted"
    run_agent_manifest: dict[str, Any] = {
        "adapterId": adapter.id,
        "continuityLevel": adapter.continuity_level,
        "sessionHandle": session_handle,
        "runIds": [],
        "transcriptPaths": [],
        "eventLogPaths": [],
        "artifactPaths": {},
    }
    try:
        adapter.prepare()
        session = adapter.start_session()
        session_handle = session["sessionHandle"]

        for iteration in range(1, max_iterations + 1):
            message = build_iteration_message(instruction, iteration, adapter.completion_instruction())
            turn_result = adapter.run_turn(iteration=iteration, message=message)
            completion_status = adapter.detect_completion(turn_result)
            implementation_run = build_implementation_run_record_from_turn(turn_result, completion_status)
            implementation_runs.append(implementation_run)
            append_jsonl(runs_path, implementation_run)

            if completion_status.get("state") == "done":
                implementation_stopped_reason = str(completion_status.get("reason") or "done")
                break
            if completion_status.get("state") == "terminal_failure":
                implementation_stopped_reason = str(completion_status.get("reason") or "terminal_failure")
                break

        run_agent_manifest = adapter.collect_artifacts()
        journey = {
            "version": "ruhroh_implementation_journey_v1",
            "scenarioId": scenario_id,
            "userPrompt": instruction,
            "implementationStoppedReason": implementation_stopped_reason,
            "implementationIterationsUsed": len(implementation_runs),
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "workspacePath": str(workspace_root),
            "implementationRuns": implementation_runs,
        }
        journey.update(adapter.legacy_journey_fields())
        journey_path.write_text(json.dumps(journey, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        copy_workspace_for_eval(workspace_root, eval_workspace_root)
        eval_result = run_eval_agent(
            scenario_id=scenario_id,
            eval_workspace_root=eval_workspace_root,
            original_workspace_root=workspace_root,
            journey_path=journey_path,
            eval_output_path=eval_result_path,
        )
        write_workspace_tarball(workspace_root, workspace_tarball_path)
        adapter_artifact_paths = run_agent_manifest.get("artifactPaths") if isinstance(run_agent_manifest.get("artifactPaths"), dict) else {}
        event_log_dir = Path(str(adapter_artifact_paths.get("eventLogDir") or run_root / "events"))
        transcript_dir = Path(str(adapter_artifact_paths.get("transcriptDir") or run_root / "transcripts"))
        write_directory_tarball(event_log_dir, events_tarball_path)
        write_directory_tarball(transcript_dir, transcripts_tarball_path)

        verdict = derive_final_verdict(implementation_runs, eval_result)
        final_result = {
            "version": "ruhroh_loop_result_v1",
            "adapter": result_adapter(),
            "dataset": result_dataset(),
            "scenarioId": scenario_id,
            "task_id": scenario_id,
            "status": verdict["status"],
            "failure_kind": verdict["failure_kind"],
            "failureBucket": verdict["failure_kind"],
            "score": verdict["score"],
            "iterationsUsed": len(implementation_runs),
            "implementationIterationsUsed": len(implementation_runs),
            "implementationStoppedReason": implementation_stopped_reason,
            "stoppedReason": implementation_stopped_reason,
            "duration_ms": round((time.monotonic() - started_at) * 1000),
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "implementationRuns": implementation_runs,
            "evalResult": eval_result,
            "artifactPaths": {
                "result": str(result_path),
                "implementationRuns": str(runs_path),
                "journey": str(journey_path),
                "evalResult": str(eval_result_path),
                "bridgeLog": str(adapter_artifact_paths.get("bridgeLogPath", "")),
                "workspaceTarball": str(workspace_tarball_path),
                "eventsTarball": str(events_tarball_path),
                "transcriptsTarball": str(transcripts_tarball_path),
                "evalWorkspace": str(eval_workspace_root),
            },
        }
        final_result.update(adapter.legacy_result_fields(run_agent_manifest))
        result_path.write_text(json.dumps(final_result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return final_result
    except Exception as error:
        final_result = {
            "version": "ruhroh_loop_result_v1",
            "adapter": result_adapter(),
            "dataset": result_dataset(),
            "scenarioId": scenario_id,
            "task_id": scenario_id,
            "status": "failed",
            "failure_kind": "infra_failed",
            "failureBucket": "infra_failed",
            "score": 0,
            "iterationsUsed": len(implementation_runs),
            "implementationIterationsUsed": len(implementation_runs),
            "implementationStoppedReason": "exception",
            "stoppedReason": "exception",
            "duration_ms": round((time.monotonic() - started_at) * 1000),
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "implementationRuns": implementation_runs,
            "failure_details": {"message": str(error), "type": type(error).__name__},
        }
        final_result.update(adapter.legacy_result_fields(run_agent_manifest))
        result_path.write_text(json.dumps(final_result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return final_result
    finally:
        adapter.cleanup()


class RunAgentAdapter:
    id = "base"
    continuity_level = "workspace_only"

    def __init__(self, scenario_id: str, workspace_root: Path, installed_dir: Path, run_root: Path) -> None:
        self.scenario_id = scenario_id
        self.workspace_root = workspace_root
        self.installed_dir = installed_dir
        self.run_root = run_root
        self.session_handle = f"{self.id}-{scenario_id}-{uuid.uuid4().hex[:8]}"
        self.turns: list[dict[str, Any]] = []

    def prepare(self) -> dict[str, Any]:
        return {"artifactPaths": {}}

    def start_session(self) -> dict[str, Any]:
        return {"sessionHandle": self.session_handle, "artifactPaths": {}}

    def run_turn(self, *, iteration: int, message: str) -> dict[str, Any]:
        raise NotImplementedError

    def detect_completion(self, turn_result: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def collect_artifacts(self) -> dict[str, Any]:
        return {
            "adapterId": self.id,
            "continuityLevel": self.continuity_level,
            "sessionHandle": self.session_handle,
            "runIds": [
                str(turn["runId"])
                for turn in self.turns
                if isinstance(turn.get("runId"), str)
            ],
            "transcriptPaths": [
                str(turn["transcriptPath"])
                for turn in self.turns
                if isinstance(turn.get("transcriptPath"), str)
            ],
            "eventLogPaths": [
                str(turn["eventLogPath"])
                for turn in self.turns
                if isinstance(turn.get("eventLogPath"), str)
            ],
            "artifactPaths": {},
        }

    def cleanup(self) -> None:
        return None

    def completion_instruction(self) -> str:
        return "If the goal is complete, emit the adapter completion signal for goal_satisfied. If the goal is not complete, keep working in this same session."

    def legacy_journey_fields(self) -> dict[str, Any]:
        return {}

    def legacy_result_fields(self, manifest: dict[str, Any]) -> dict[str, Any]:
        del manifest
        return {}


class CommandRunAgentAdapter(RunAgentAdapter):
    continuity_level = "workspace_only"

    def __init__(
        self,
        scenario_id: str,
        workspace_root: Path,
        installed_dir: Path,
        run_root: Path,
        adapter_id: str,
        command_env_key: str = "RUHROH_RUN_AGENT_COMMAND",
        completion_protocol_env_key: str = "RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
    ) -> None:
        self.id = adapter_id
        self.command_env_key = command_env_key
        self.completion_protocol_env_key = completion_protocol_env_key
        super().__init__(scenario_id, workspace_root, installed_dir, run_root)

    def run_turn(self, *, iteration: int, message: str) -> dict[str, Any]:
        command = os.environ.get(self.command_env_key)
        if command is None or command.strip() == "":
            raise RuntimeError(f"{self.command_env_key} is required for Ruhroh adapter {self.id}")
        transcript_path = self.run_root / "transcripts" / f"iteration-{iteration}.log"
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        goal_path = self.run_root / "custom-shell" / f"goal-{iteration}.md"
        result_path = self.run_root / "custom-shell" / f"result-{iteration}.json"
        goal_path.parent.mkdir(parents=True, exist_ok=True)
        goal_path.write_text(message, encoding="utf-8")
        env = {
            **os.environ,
            "RUHROH_MESSAGE": message,
            "RUHROH_ITERATION": str(iteration),
            "RUHROH_WORKSPACE": str(self.workspace_root),
            "RUHROH_GOAL_PATH": str(goal_path),
            "RUHROH_MESSAGE_PATH": str(goal_path),
            "RUHROH_WORKSPACE_PATH": str(self.workspace_root),
            "RUHROH_RESULT_PATH": str(result_path),
            "RUHROH_SESSION_HANDLE": self.session_handle,
            "RUHROH_SCENARIO_ID": self.scenario_id,
            "RUHROH_RUN_ROOT": str(self.run_root),
            "RUHROH_ADAPTER_ID": self.id,
        }
        completed = subprocess.run(
            command,
            cwd=str(self.workspace_root),
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=read_iteration_timeout_sec(),
            shell=True,
        )
        transcript_path.write_text(completed.stdout, encoding="utf-8")
        parsed_result = read_json_file(result_path)
        if not isinstance(parsed_result, dict):
            parsed_result = {}
        status = "completed" if completed.returncode == 0 else "failed"
        turn = {
            "version": "ruhroh_run_agent_turn_v1",
            "adapterId": self.id,
            "continuityLevel": self.continuity_level,
            "iteration": iteration,
            "status": status,
            "failureKind": "none" if status == "completed" else "custom_shell_failed",
            "sessionHandle": self.session_handle,
            "runId": parsed_result.get("runId") if isinstance(parsed_result.get("runId"), str) else f"{self.session_handle}-{iteration}",
            "threadId": parsed_result.get("threadId") if isinstance(parsed_result.get("threadId"), str) else None,
            "eventLogPath": parsed_result.get("eventLogPath") if isinstance(parsed_result.get("eventLogPath"), str) else None,
            "jobInputPath": parsed_result.get("jobInputPath") if isinstance(parsed_result.get("jobInputPath"), str) else None,
            "jobOutputPath": parsed_result.get("jobOutputPath") if isinstance(parsed_result.get("jobOutputPath"), str) else None,
            "finalizedPayload": parsed_result.get("finalizedPayload"),
            "returnCode": completed.returncode,
            "transcriptPath": str(transcript_path),
            "artifactPaths": {
                "goal": str(goal_path),
                "transcript": str(transcript_path),
                "result": str(result_path),
                "message": str(goal_path),
                **(parsed_result.get("artifacts") if isinstance(parsed_result.get("artifacts"), dict) else {}),
            },
            "notes": completed.stdout[-2000:],
        }
        self.turns.append(turn)
        return turn

    def detect_completion(self, turn_result: dict[str, Any]) -> dict[str, Any]:
        evidence = completion_evidence_for_turn(turn_result)
        if turn_result.get("status") != "completed":
            return {"state": "terminal_failure", "reason": "runtime_failure", "evidenceRefs": evidence}
        protocol = os.environ.get(self.completion_protocol_env_key, "json-final-line")
        artifact_paths = turn_result.get("artifactPaths")
        result_path = artifact_paths.get("result") if isinstance(artifact_paths, dict) else None
        if isinstance(result_path, str):
            parsed_result = read_json_file(Path(result_path))
            if isinstance(parsed_result, dict):
                status = parsed_result.get("status")
                if status == "goal_satisfied":
                    return {
                        "state": "done",
                        "reason": "goal_satisfied",
                        "confidence": "adapter_inferred",
                        "evidenceRefs": evidence,
                    }
                if status in COMPLETION_TERMINAL_FAILURE_REASONS:
                    return {"state": "terminal_failure", "reason": status, "evidenceRefs": evidence}
                if status == "continue":
                    return {"state": "not_done", "reason": "partial_progress", "evidenceRefs": evidence}
        notes = str(turn_result.get("notes") or "")
        if protocol == "json-final-line":
            for line in reversed(notes.splitlines()):
                try:
                    parsed = json.loads(line)
                except Exception:
                    continue
                if isinstance(parsed, dict) and parsed.get("status") == "goal_satisfied":
                    return {
                        "state": "done",
                        "reason": "goal_satisfied",
                        "confidence": "adapter_inferred",
                        "evidenceRefs": evidence,
                    }
        return {"state": "not_done", "reason": "missing_completion_signal", "evidenceRefs": evidence}

    def completion_instruction(self) -> str:
        return (
            "If the goal is complete, end your response with one JSON line: "
            "{\"status\":\"goal_satisfied\"}. If the goal is not complete, keep working in this same workspace."
        )


class CustomShellRunAgentAdapter(CommandRunAgentAdapter):
    def __init__(self, scenario_id: str, workspace_root: Path, installed_dir: Path, run_root: Path) -> None:
        super().__init__(
            scenario_id,
            workspace_root,
            installed_dir,
            run_root,
            adapter_id="custom-shell",
            command_env_key="RUHROH_RUN_AGENT_COMMAND",
            completion_protocol_env_key="RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
        )

    def completion_instruction(self) -> str:
        return CommandRunAgentAdapter.completion_instruction(self)


def build_run_agent_adapter(
    *,
    adapter_id: str,
    scenario_id: str,
    workspace_root: Path,
    installed_dir: Path,
    run_root: Path,
) -> RunAgentAdapter:
    if adapter_id == "custom-shell":
        return CustomShellRunAgentAdapter(scenario_id, workspace_root, installed_dir, run_root)
    return CommandRunAgentAdapter(scenario_id, workspace_root, installed_dir, run_root, adapter_id=adapter_id)


def read_run_agent_adapter() -> str:
    return os.environ.get("RUHROH_RUN_AGENT_ADAPTER") or os.environ.get("RUHROH_RUN_AGENT_ADAPTER") or "custom-shell"


def completion_evidence_for_turn(turn_result: dict[str, Any]) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for kind, key in (("transcript", "transcriptPath"), ("event_log", "eventLogPath"), ("job_output", "jobOutputPath")):
        value = turn_result.get(key)
        if isinstance(value, str):
            refs.append({"kind": kind, "ref": value, "summary": f"{kind} for iteration {turn_result.get('iteration')}"})
    return refs


def build_implementation_run_record_from_turn(turn_result: dict[str, Any], completion_status: dict[str, Any]) -> dict[str, Any]:
    stop_reason = completion_status.get("reason") or "not_done"
    record = {
        "version": "ruhroh_implementation_run_v1",
        "iteration": turn_result.get("iteration"),
        "adapterId": turn_result.get("adapterId"),
        "continuityLevel": turn_result.get("continuityLevel"),
        "status": turn_result.get("status"),
        "failureKind": turn_result.get("failureKind"),
        "sessionHandle": turn_result.get("sessionHandle"),
        "completionStatus": completion_status,
        "stopReason": stop_reason,
        "returnCode": turn_result.get("returnCode"),
        "artifactPaths": turn_result.get("artifactPaths", {}),
        "notes": str(turn_result.get("notes") or "")[-2000:],
    }
    for key in (
        "sessionId",
        "runId",
        "threadId",
        "finalizationStatus",
        "finalizedPayload",
        "jobInputPath",
        "jobOutputPath",
        "transcriptPath",
        "eventLogPath",
    ):
        value = turn_result.get(key)
        if value is not None:
            record[key] = value
    return record


def build_iteration_message(
    instruction: str,
    iteration: int,
    completion_instruction: str = "If the goal is complete, emit the adapter completion signal for goal_satisfied. If the goal is not complete, keep working in this same session.",
    previous_eval: dict[str, Any] | None = None,
) -> str:
    del previous_eval
    if iteration == 1:
        return instruction
    return (
        "Continue the same app-development task in the existing workspace.\n\n"
        f"Original user goal:\n{instruction}\n\n"
        f"This is Ruhroh implementation continuation {iteration}. Do not restart or create a separate project. "
        "Inspect the current workspace, continue any unfinished work, and verify the final delivered state. "
        f"{completion_instruction}"
    )


def copy_workspace_for_eval(workspace_root: Path, eval_workspace_root: Path) -> None:
    if eval_workspace_root.exists():
        shutil.rmtree(eval_workspace_root)
    if not workspace_root.exists():
        eval_workspace_root.mkdir(parents=True, exist_ok=True)
        return
    shutil.copytree(
        workspace_root,
        eval_workspace_root,
        ignore=shutil.ignore_patterns(*SKIP_WORKSPACE_TAR_NAMES),
    )


def run_eval_agent(
    scenario_id: str,
    eval_workspace_root: Path,
    original_workspace_root: Path,
    journey_path: Path,
    eval_output_path: Path,
) -> dict[str, Any]:
    fixture = read_eval_fixture()
    if fixture is not None:
        fixture.setdefault("artifacts", {})
        if isinstance(fixture["artifacts"], dict):
            fixture["artifacts"].setdefault("workspacePath", str(eval_workspace_root))
            fixture["artifacts"].setdefault("originalWorkspacePath", str(original_workspace_root))
            fixture["artifacts"].setdefault("journeyPath", str(journey_path))
        eval_output_path.write_text(json.dumps(fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return fixture
    command = os.environ.get("RUHROH_EVAL_COMMAND")
    if command is not None and command.strip() != "":
        env = {
            **os.environ,
            "RUHROH_EVAL_SCENARIO_ID": scenario_id,
            "RUHROH_EVAL_WORKSPACE_PATH": str(eval_workspace_root),
            "RUHROH_EVAL_ORIGINAL_WORKSPACE_PATH": str(original_workspace_root),
            "RUHROH_EVAL_JOURNEY_PATH": str(journey_path),
            "RUHROH_EVAL_OUTPUT_PATH": str(eval_output_path),
        }
        completed = subprocess.run(
            command,
            cwd=str(eval_workspace_root),
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=int(os.environ.get("RUHROH_EVAL_TIMEOUT_SEC", "300")),
            shell=True,
        )
        if completed.returncode != 0:
            return synthetic_eval_infra_failure(
                scenario_id=scenario_id,
                eval_workspace_root=eval_workspace_root,
                eval_output_path=eval_output_path,
                diagnostics=completed.stdout[-4000:],
            )
        parsed = read_json_file(eval_output_path)
        if isinstance(parsed, dict):
            return parsed
        for line in reversed(completed.stdout.splitlines()):
            try:
                parsed_line = json.loads(line)
            except Exception:
                continue
            if isinstance(parsed_line, dict):
                eval_output_path.write_text(json.dumps(parsed_line, indent=2, sort_keys=True) + "\n", encoding="utf-8")
                return parsed_line
        return synthetic_eval_infra_failure(
            scenario_id=scenario_id,
            eval_workspace_root=eval_workspace_root,
            eval_output_path=eval_output_path,
            diagnostics="RUHROH_EVAL_COMMAND completed but did not write or print a JSON eval result.",
        )
    return synthetic_eval_infra_failure(
        scenario_id=scenario_id,
        eval_workspace_root=eval_workspace_root,
        eval_output_path=eval_output_path,
        diagnostics="Package-owned Ruhroh runtime requires RUHROH_EVAL_RESULT_FIXTURE, RUHROH_EVAL_RESULT_FIXTURE_PATH, or RUHROH_EVAL_COMMAND.",
    )


def read_eval_fixture() -> dict[str, Any] | None:
    raw = os.environ.get("RUHROH_EVAL_RESULT_FIXTURE")
    if raw:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    path = os.environ.get("RUHROH_EVAL_RESULT_FIXTURE_PATH")
    if not path:
        return None
    parsed = read_json_file(Path(path))
    return parsed if isinstance(parsed, dict) else None


def synthetic_eval_infra_failure(
    scenario_id: str,
    eval_workspace_root: Path,
    eval_output_path: Path,
    diagnostics: str,
) -> dict[str, Any]:
    result = {
        "version": "ruhroh_eval_result_v1",
        "status": "infra_failed",
        "goalMet": False,
        "confidence": "high",
        "reasons": ["Eval-agent failed to produce a usable terminal judgment."],
        "unmetCriteria": ["Eval-agent failed."],
        "evidenceRefs": [{"kind": "environment", "ref": str(eval_output_path), "summary": diagnostics[-1000:]}],
        "commandsRun": [],
        "artifacts": {"workspacePath": str(eval_workspace_root), "evalOutputPath": str(eval_output_path)},
        "finalSummary": f"Eval-agent failed for {scenario_id}.",
    }
    eval_output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result


def derive_final_verdict(implementation_runs: list[dict[str, Any]], eval_result: dict[str, Any]) -> dict[str, Any]:
    runtime_failure = next(
        (
            run
            for run in implementation_runs
            if run.get("status") != "completed"
        ),
        None,
    )
    if runtime_failure is not None:
        return {
            "status": "failed",
            "failure_kind": runtime_failure.get("failureKind") or "runtime_failure",
            "score": 0,
        }
    eval_status = eval_result.get("status")
    if eval_status == "passed":
        return {"status": "completed", "failure_kind": "none", "score": 1}
    if eval_status == "review":
        return {"status": "failed", "failure_kind": "review_required", "score": 0}
    if eval_status == "infra_failed":
        return {"status": "failed", "failure_kind": "infra_failed", "score": 0}
    return {"status": "failed", "failure_kind": "goal_mismatch", "score": 0}


def write_workspace_tarball(workspace_root: Path, output_path: Path) -> None:
    with tarfile.open(output_path, "w:gz") as tar:
        if not workspace_root.exists():
            return
        for path in workspace_root.rglob("*"):
            if any(part in SKIP_WORKSPACE_TAR_NAMES for part in path.relative_to(workspace_root).parts):
                continue
            tar.add(path, arcname=str(path.relative_to(workspace_root)))


def write_directory_tarball(directory: Path, output_path: Path) -> None:
    with tarfile.open(output_path, "w:gz") as tar:
        if not directory.exists():
            return
        for path in directory.rglob("*"):
            tar.add(path, arcname=str(path.relative_to(directory)))


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, sort_keys=True) + "\n")


def read_json_file(path: Path) -> Any | None:
    try:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def emit_result(result: dict[str, Any]) -> None:
    encoded = base64.b64encode(json.dumps(result, sort_keys=True).encode("utf-8")).decode("ascii")
    print(f"{RESULT_MARKER_PREFIX}{encoded}", flush=True)


def resolve_workspace_root() -> str:
    configured = os.environ.get("RUHROH_WORKSPACE_ROOT") or os.environ.get("KESTREL_TBENCH_WORKSPACE_ROOT")
    if configured and Path(configured).is_dir():
        return configured
    if Path("/app").is_dir():
        return "/app"
    cwd = Path.cwd()
    if cwd.is_dir() and str(cwd) != "/":
        return str(cwd)
    return "/app"


def read_max_iterations() -> int:
    raw = os.environ.get("RUHROH_MAX_ITERATIONS")
    if raw is None:
        return DEFAULT_MAX_ITERATIONS
    try:
        return max(1, int(raw))
    except ValueError:
        return DEFAULT_MAX_ITERATIONS


def read_iteration_timeout_sec() -> int:
    raw = os.environ.get("RUHROH_ITERATION_TIMEOUT_SEC")
    if raw is None:
        return 1200
    try:
        return max(1, int(raw))
    except ValueError:
        return 1200


def load_repo_dotenv() -> None:
    for env_path in (Path.cwd() / ".env",):
        if not env_path.exists():
            continue
        for key, value in parse_dotenv(env_path.read_text(encoding="utf-8")).items():
            os.environ.setdefault(key, value)
        return


def load_run_env_file() -> None:
    env_path = os.environ.get("RUHROH_ENV_FILE")
    if not env_path:
        return
    path = Path(env_path)
    if not path.exists():
        return
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(parsed, dict):
        return
    for key, value in parsed.items():
        if isinstance(key, str) and isinstance(value, str):
            os.environ[key] = value


def parse_dotenv(content: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in content.splitlines():
        parsed = parse_dotenv_line(line)
        if parsed is not None:
            key, value = parsed
            values[key] = value
    return values


def parse_dotenv_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None
    if stripped.startswith("export "):
        stripped = stripped[len("export "):].strip()
    if "=" not in stripped:
        return None
    key, value = stripped.split("=", 1)
    key = key.strip()
    if not key:
        return None
    if not key.replace("_", "").isalnum() or key[0].isdigit():
        return None
    return key, unquote_dotenv_value(value.strip())


def unquote_dotenv_value(value: str) -> str:
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1].replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    marker = value.find(" #")
    return (value[:marker] if marker >= 0 else value).strip()


def result_adapter() -> str:
    return os.environ.get("RUHROH_RESULT_ADAPTER") or DEFAULT_ADAPTER


def result_dataset() -> str:
    return os.environ.get("RUHROH_RESULT_DATASET") or DEFAULT_DATASET


def safe_id(value: str) -> str:
    stripped = value.strip().split("/")[-1]
    if not stripped.replace("-", "").replace("_", "").replace(".", "").isalnum():
        raise ValueError(f"Unsafe Ruhroh scenario id: {value}")
    return stripped


if __name__ == "__main__":
    sys.exit(main())
