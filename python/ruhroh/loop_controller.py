from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import platform
import shlex
import shutil
import subprocess
import sys
import tarfile
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


RESULT_MARKER_PREFIX = "RUHROH_RESULT_JSON_BASE64:"
DEFAULT_DATASET = "ruhroh@local"
DEFAULT_ADAPTER = "ruhroh-harbor"
DEFAULT_MAX_ITERATIONS = 3
SKIP_WORKSPACE_TAR_NAMES = {"node_modules", ".next", "dist", "build", ".git"}
WORKSPACE_SUMMARY_MAX_FILES = 200
WORKSPACE_SUMMARY_HASH_MAX_BYTES = 1024 * 1024
COMPLETION_TERMINAL_FAILURE_REASONS = {"cannot_satisfy", "policy_blocked", "out_of_scope", "runtime_failure", "infra_failure", "cancelled"}
SCHEMA_BASE_URL = "https://lumicorp.github.io/ruhroh/schemas"
EVAL_RESULT_SCHEMA_URL = f"{SCHEMA_BASE_URL}/eval-result-v1.schema.json"
LOOP_RESULT_SCHEMA_URL = f"{SCHEMA_BASE_URL}/loop-result-v1.schema.json"
RUN_MANIFEST_SCHEMA_URL = f"{SCHEMA_BASE_URL}/run-manifest-v1.schema.json"
WORKSPACE_SUMMARY_SCHEMA_URL = f"{SCHEMA_BASE_URL}/workspace-summary-v1.schema.json"


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
    started_at_wall = utc_now()
    ruhroh_run_id = f"{scenario_id}-{uuid.uuid4().hex[:12]}"
    installed_dir.mkdir(parents=True, exist_ok=True)
    workspace_root.mkdir(parents=True, exist_ok=True)
    run_root = installed_dir / "ruhroh-loop"
    run_root.mkdir(parents=True, exist_ok=True)
    runs_path = installed_dir / "ruhroh-loop-iterations.jsonl"
    manifest_path = installed_dir / "ruhroh-run-manifest.json"
    journey_path = installed_dir / "ruhroh-loop-journey.json"
    eval_result_path = installed_dir / "ruhroh-loop-eval.json"
    eval_input_path = installed_dir / "ruhroh-loop-eval-input.json"
    result_path = installed_dir / "ruhroh-loop-result.json"
    workspace_summary_path = installed_dir / "ruhroh-workspace-summary.json"
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
        journey_path.parent.mkdir(parents=True, exist_ok=True)
        journey_path.write_text(json.dumps(journey, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        copy_workspace_for_eval(workspace_root, eval_workspace_root)
        eval_result = run_eval_agent(
            scenario_id=scenario_id,
            eval_workspace_root=eval_workspace_root,
            original_workspace_root=workspace_root,
            journey_path=journey_path,
            eval_input_path=eval_input_path,
            eval_output_path=eval_result_path,
            installed_dir=installed_dir,
        )
        write_workspace_summary(workspace_root, workspace_summary_path)
        write_workspace_tarball(workspace_root, workspace_tarball_path)
        adapter_artifact_paths = run_agent_manifest.get("artifactPaths") if isinstance(run_agent_manifest.get("artifactPaths"), dict) else {}
        event_log_dir = Path(str(adapter_artifact_paths.get("eventLogDir") or run_root / "events"))
        transcript_dir = Path(str(adapter_artifact_paths.get("transcriptDir") or run_root / "transcripts"))
        write_directory_tarball(event_log_dir, events_tarball_path)
        write_directory_tarball(transcript_dir, transcripts_tarball_path)

        verdict = derive_final_verdict(implementation_runs, eval_result)
        duration_ms = round((time.monotonic() - started_at) * 1000)
        artifact_paths = {
            "result": str(result_path),
            "runManifest": str(manifest_path),
            "implementationRuns": str(runs_path),
            "journey": str(journey_path),
            "evalResult": str(eval_result_path),
            "evalInput": str(eval_input_path),
            "bridgeLog": str(adapter_artifact_paths.get("bridgeLogPath", "")),
            "workspaceSummary": str(workspace_summary_path),
            "workspaceTarball": str(workspace_tarball_path),
            "eventsTarball": str(events_tarball_path),
            "transcriptsTarball": str(transcripts_tarball_path),
            "evalWorkspace": str(eval_workspace_root),
        }
        run_manifest = build_run_manifest(
            ruhroh_run_id=ruhroh_run_id,
            scenario_id=scenario_id,
            started_at=started_at_wall,
            duration_ms=duration_ms,
            max_iterations=max_iterations,
            implementation_stopped_reason=implementation_stopped_reason,
            implementation_runs=implementation_runs,
            run_agent_manifest=run_agent_manifest,
            adapter=adapter,
            session_handle=session_handle,
            eval_result=eval_result,
            workspace_root=workspace_root,
            eval_workspace_root=eval_workspace_root,
            artifact_paths=artifact_paths,
        )
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(run_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        final_result = {
            "$schema": LOOP_RESULT_SCHEMA_URL,
            "version": "ruhroh_loop_result_v1",
            "runId": ruhroh_run_id,
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
            "duration_ms": duration_ms,
            "runManifest": run_manifest,
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "implementationRuns": implementation_runs,
            "evalResult": eval_result,
            "artifactPaths": artifact_paths,
        }
        final_result.update(adapter.legacy_result_fields(run_agent_manifest))
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(json.dumps(final_result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return final_result
    except Exception as error:
        duration_ms = round((time.monotonic() - started_at) * 1000)
        try:
            write_workspace_summary(workspace_root, workspace_summary_path)
        except Exception:
            pass
        artifact_paths = {
            "result": str(result_path),
            "runManifest": str(manifest_path),
            "implementationRuns": str(runs_path),
            "journey": str(journey_path),
            "workspaceSummary": str(workspace_summary_path),
        }
        run_manifest = build_run_manifest(
            ruhroh_run_id=ruhroh_run_id,
            scenario_id=scenario_id,
            started_at=started_at_wall,
            duration_ms=duration_ms,
            max_iterations=max_iterations,
            implementation_stopped_reason="exception",
            implementation_runs=implementation_runs,
            run_agent_manifest=run_agent_manifest,
            adapter=adapter,
            session_handle=session_handle,
            eval_result=None,
            workspace_root=workspace_root,
            eval_workspace_root=eval_workspace_root,
            artifact_paths=artifact_paths,
            failure_details={"message": str(error), "type": type(error).__name__},
        )
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(run_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        final_result = {
            "$schema": LOOP_RESULT_SCHEMA_URL,
            "version": "ruhroh_loop_result_v1",
            "runId": ruhroh_run_id,
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
            "duration_ms": duration_ms,
            "runManifest": run_manifest,
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "implementationRuns": implementation_runs,
            "failure_details": {"message": str(error), "type": type(error).__name__},
            "artifactPaths": artifact_paths,
        }
        final_result.update(adapter.legacy_result_fields(run_agent_manifest))
        result_path.parent.mkdir(parents=True, exist_ok=True)
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
        adapter_version = latest_turn_string(self.turns, "adapterVersion")
        model = latest_turn_record(self.turns, "model")
        usage = latest_turn_record(self.turns, "usage")
        return {
            "adapterId": self.id,
            **({"adapterVersion": adapter_version} if adapter_version is not None else {}),
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
            **({"model": model} if model is not None else {}),
            **({"usage": usage} if usage is not None else {}),
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
        materialize_inline_command(self.command_env_key, self.installed_dir)
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
        completed = run_command_capture(
            command_args(command, shell_env_key=f"{self.command_env_key}_SHELL"),
            cwd=str(self.workspace_root),
            env=env,
            timeout=read_iteration_timeout_sec(),
            shell=command_shell_enabled(f"{self.command_env_key}_SHELL"),
            stream_output=command_shell_enabled("RUHROH_STREAM_AGENT_OUTPUT"),
        )
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
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
            "adapterVersion": parsed_result.get("adapterVersion") if isinstance(parsed_result.get("adapterVersion"), str) else None,
            "model": parsed_result.get("model") if isinstance(parsed_result.get("model"), dict) else None,
            "usage": parsed_result.get("usage") if isinstance(parsed_result.get("usage"), dict) else None,
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


class KestrelCliRunAgentAdapter(CommandRunAgentAdapter):
    continuity_level = "native_session"

    def __init__(self, scenario_id: str, workspace_root: Path, installed_dir: Path, run_root: Path) -> None:
        super().__init__(
            scenario_id,
            workspace_root,
            installed_dir,
            run_root,
            adapter_id="kestrel-cli",
            command_env_key="RUHROH_RUN_AGENT_COMMAND",
            completion_protocol_env_key="RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
        )


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
    if adapter_id == "kestrel-cli":
        return KestrelCliRunAgentAdapter(scenario_id, workspace_root, installed_dir, run_root)
    return CommandRunAgentAdapter(scenario_id, workspace_root, installed_dir, run_root, adapter_id=adapter_id)


def read_run_agent_adapter() -> str:
    return os.environ.get("RUHROH_RUN_AGENT_ADAPTER") or "custom-shell"


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


def latest_turn_string(turns: list[dict[str, Any]], key: str) -> str | None:
    for turn in reversed(turns):
        value = turn.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def latest_turn_record(turns: list[dict[str, Any]], key: str) -> dict[str, Any] | None:
    for turn in reversed(turns):
        value = turn.get(key)
        if isinstance(value, dict) and value:
            return value
    return None


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
    eval_input_path: Path,
    eval_output_path: Path,
    installed_dir: Path | None = None,
) -> dict[str, Any]:
    installed_dir = installed_dir or eval_output_path.parent
    eval_input = build_eval_input(
        scenario_id=scenario_id,
        eval_workspace_root=eval_workspace_root,
        original_workspace_root=original_workspace_root,
        journey_path=journey_path,
        eval_output_path=eval_output_path,
    )
    eval_input_path.parent.mkdir(parents=True, exist_ok=True)
    eval_input_path.write_text(json.dumps(eval_input, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    fixture = read_eval_fixture()
    if fixture is not None:
        fixture = normalize_eval_result(fixture)
        fixture.setdefault("artifacts", {})
        if isinstance(fixture["artifacts"], dict):
            fixture["artifacts"].setdefault("workspacePath", str(eval_workspace_root))
            fixture["artifacts"].setdefault("originalWorkspacePath", str(original_workspace_root))
            fixture["artifacts"].setdefault("journeyPath", str(journey_path))
        eval_output_path.parent.mkdir(parents=True, exist_ok=True)
        eval_output_path.write_text(json.dumps(fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return fixture
    materialize_inline_command("RUHROH_EVAL_COMMAND", installed_dir)
    command = os.environ.get("RUHROH_EVAL_COMMAND")
    if command is not None and command.strip() != "":
        env = {
            **os.environ,
            "RUHROH_EVAL_SCENARIO_ID": scenario_id,
            "RUHROH_EVAL_WORKSPACE_PATH": str(eval_workspace_root),
            "RUHROH_EVAL_ORIGINAL_WORKSPACE_PATH": str(original_workspace_root),
            "RUHROH_EVAL_JOURNEY_PATH": str(journey_path),
            "RUHROH_EVAL_INPUT_PATH": str(eval_input_path),
            "RUHROH_EVAL_OUTPUT_PATH": str(eval_output_path),
        }
        completed = subprocess.run(
            command_args(command, shell_env_key="RUHROH_EVAL_COMMAND_SHELL"),
            cwd=str(eval_workspace_root),
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=int(os.environ.get("RUHROH_EVAL_TIMEOUT_SEC", "300")),
            shell=command_shell_enabled("RUHROH_EVAL_COMMAND_SHELL"),
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
            parsed = normalize_eval_result(parsed)
            eval_output_path.parent.mkdir(parents=True, exist_ok=True)
            eval_output_path.write_text(json.dumps(parsed, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            return parsed
        for line in reversed(completed.stdout.splitlines()):
            try:
                parsed_line = json.loads(line)
            except Exception:
                continue
            if isinstance(parsed_line, dict):
                parsed_line = normalize_eval_result(parsed_line)
                eval_output_path.parent.mkdir(parents=True, exist_ok=True)
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


def build_eval_input(
    scenario_id: str,
    eval_workspace_root: Path,
    original_workspace_root: Path,
    journey_path: Path,
    eval_output_path: Path,
) -> dict[str, Any]:
    return {
        "version": "ruhroh_eval_input_v1",
        "scenarioId": scenario_id,
        "workspacePath": str(eval_workspace_root),
        "originalWorkspacePath": str(original_workspace_root),
        "journeyPath": str(journey_path),
        "evalOutputPath": str(eval_output_path),
        "scenarioContext": read_json_env_array("RUHROH_EVAL_SCENARIO_CONTEXT_JSON"),
        "goalRubric": read_json_env_array("RUHROH_EVAL_GOAL_RUBRIC_JSON"),
        "evidenceGuidance": read_json_env_array("RUHROH_EVAL_EVIDENCE_GUIDANCE_JSON"),
        "calibrationCases": read_json_env_object_array("RUHROH_EVAL_CALIBRATION_CASES_JSON"),
        "privateAssets": read_json_env_array("RUHROH_EVAL_PRIVATE_ASSETS_JSON"),
    }


def read_json_env_array(key: str) -> list[str]:
    raw = os.environ.get(key)
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str)]


def read_json_env_object_array(key: str) -> list[dict[str, Any]]:
    raw = os.environ.get(key)
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]


def normalize_eval_result(result: dict[str, Any]) -> dict[str, Any]:
    status = result.get("status")
    if status not in {"passed", "failed", "review", "infra_failed"}:
        status = "infra_failed"
    normalized = {
        "$schema": EVAL_RESULT_SCHEMA_URL,
        "version": "ruhroh_eval_result_v1",
        "status": status,
        "goalMet": bool(result.get("goalMet")) if isinstance(result.get("goalMet"), bool) else status == "passed",
        "confidence": result.get("confidence") if result.get("confidence") in {"low", "medium", "high"} else "medium",
        "reasons": string_list(result.get("reasons")),
        "unmetCriteria": string_list(result.get("unmetCriteria")),
        "evidenceRefs": evidence_refs(result.get("evidenceRefs")),
        "commandsRun": command_records(result.get("commandsRun")),
        "artifacts": string_record(result.get("artifacts")),
        "finalSummary": result.get("finalSummary") if isinstance(result.get("finalSummary"), str) else f"Eval-agent status: {status}.",
    }
    for key in ("repairBrief", "criteriaResults", "subscores", "judge", "judgeVotes", "judgeAgreement"):
        if key in result:
            normalized[key] = result[key]
    return normalized


def string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def string_record(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(key): item for key, item in value.items() if isinstance(key, str) and isinstance(item, str)}


def evidence_refs(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    refs: list[dict[str, str]] = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("kind"), str) and isinstance(item.get("ref"), str):
            refs.append({
                "kind": item["kind"],
                "ref": item["ref"],
                "summary": item.get("summary") if isinstance(item.get("summary"), str) else "",
            })
    return refs


def command_records(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    records: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("command"), str):
            records.append({
                "command": item["command"],
                "exitCode": item.get("exitCode") if isinstance(item.get("exitCode"), int) else 0,
                "summary": item.get("summary") if isinstance(item.get("summary"), str) else "",
            })
    return records


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
        "$schema": EVAL_RESULT_SCHEMA_URL,
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
    eval_output_path.parent.mkdir(parents=True, exist_ok=True)
    eval_output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result


def derive_final_verdict(implementation_runs: list[dict[str, Any]], eval_result: dict[str, Any]) -> dict[str, Any]:
    runtime_failure = next(
        (
            run
            for run in implementation_runs
            if run.get("status") != "completed"
            or (
                isinstance(run.get("completionStatus"), dict)
                and run["completionStatus"].get("state") == "terminal_failure"
            )
        ),
        None,
    )
    if runtime_failure is not None:
        completion_status = runtime_failure.get("completionStatus")
        completion_reason = completion_status.get("reason") if isinstance(completion_status, dict) else None
        return {
            "status": "failed",
            "failure_kind": completion_reason or runtime_failure.get("failureKind") or "runtime_failure",
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
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output_path, "w:gz") as tar:
        if not workspace_root.exists():
            return
        for path in workspace_root.rglob("*"):
            if any(part in SKIP_WORKSPACE_TAR_NAMES for part in path.relative_to(workspace_root).parts):
                continue
            tar.add(path, arcname=str(path.relative_to(workspace_root)))


def write_workspace_summary(workspace_root: Path, output_path: Path) -> None:
    summary = summarize_workspace(workspace_root)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def summarize_workspace(workspace_root: Path) -> dict[str, Any]:
    top_level_entries: list[dict[str, Any]] = []
    sample_files: list[dict[str, Any]] = []
    project_markers: list[str] = []
    total_files = 0
    total_directories = 0
    total_bytes = 0
    skipped_paths = 0
    unreadable_paths = 0
    marker_names = {
        "package.json",
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "pyproject.toml",
        "requirements.txt",
        "Cargo.toml",
        "go.mod",
        "README.md",
        "index.html",
        "vite.config.ts",
        "next.config.js",
        "tsconfig.json",
    }
    if not workspace_root.exists():
        return {
            "$schema": WORKSPACE_SUMMARY_SCHEMA_URL,
            "version": "ruhroh_workspace_summary_v1",
            "generatedAt": utc_now(),
            "workspaceRoot": str(workspace_root),
            "exists": False,
            "totalFiles": 0,
            "totalDirectories": 0,
            "totalBytes": 0,
            "topLevelEntries": [],
            "projectMarkers": [],
            "sampleFiles": [],
            "truncated": False,
        }

    for child in sorted(workspace_root.iterdir(), key=lambda item: item.name):
        try:
            top_level_entries.append({
                "path": child.name,
                "type": "directory" if child.is_dir() else "file",
            })
        except OSError:
            unreadable_paths += 1

    for path in sorted(workspace_root.rglob("*"), key=lambda item: str(item.relative_to(workspace_root))):
        relative = path.relative_to(workspace_root)
        if any(part in SKIP_WORKSPACE_TAR_NAMES for part in relative.parts):
            skipped_paths += 1
            continue
        try:
            if path.is_dir():
                total_directories += 1
                continue
            if not path.is_file():
                continue
            stat = path.stat()
            total_files += 1
            total_bytes += stat.st_size
            relative_text = str(relative)
            if path.name in marker_names:
                project_markers.append(relative_text)
            if len(sample_files) < WORKSPACE_SUMMARY_MAX_FILES:
                file_summary: dict[str, Any] = {
                    "path": relative_text,
                    "sizeBytes": stat.st_size,
                }
                if stat.st_size <= WORKSPACE_SUMMARY_HASH_MAX_BYTES:
                    file_summary["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
                sample_files.append(file_summary)
        except OSError:
            unreadable_paths += 1

    return {
        "$schema": WORKSPACE_SUMMARY_SCHEMA_URL,
        "version": "ruhroh_workspace_summary_v1",
        "generatedAt": utc_now(),
        "workspaceRoot": str(workspace_root),
        "exists": True,
        "totalFiles": total_files,
        "totalDirectories": total_directories,
        "totalBytes": total_bytes,
        "topLevelEntries": top_level_entries[:100],
        "projectMarkers": sorted(project_markers),
        "sampleFiles": sample_files,
        "truncated": total_files > len(sample_files),
        "skippedPaths": skipped_paths,
        "unreadablePaths": unreadable_paths,
    }


def write_directory_tarball(directory: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output_path, "w:gz") as tar:
        if not directory.exists():
            return
        for path in directory.rglob("*"):
            tar.add(path, arcname=str(path.relative_to(directory)))


def build_run_manifest(
    *,
    ruhroh_run_id: str,
    scenario_id: str,
    started_at: str,
    duration_ms: int,
    max_iterations: int,
    implementation_stopped_reason: str,
    implementation_runs: list[dict[str, Any]],
    run_agent_manifest: dict[str, Any],
    adapter: RunAgentAdapter,
    session_handle: str,
    eval_result: dict[str, Any] | None,
    workspace_root: Path,
    eval_workspace_root: Path,
    artifact_paths: dict[str, str],
    failure_details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    scenario_metadata = read_json_env_object("RUHROH_SCENARIO_METADATA_JSON")
    manifest: dict[str, Any] = {
        "$schema": RUN_MANIFEST_SCHEMA_URL,
        "version": "ruhroh_run_manifest_v1",
        "runId": ruhroh_run_id,
        "scenario": {
            "id": scenario_id,
            **({"metadata": scenario_metadata} if scenario_metadata else {}),
            **({"scenarioVersion": scenario_metadata["scenarioVersion"]} if isinstance(scenario_metadata.get("scenarioVersion"), str) else {}),
            **({"runMode": optional_env("RUHROH_RUN_MODE")} if optional_env("RUHROH_RUN_MODE") else {}),
        },
        "benchmark": {
            "dataset": result_dataset(),
            "adapter": result_adapter(),
            "harborAgent": DEFAULT_ADAPTER,
        },
        "timing": {
            "startedAt": started_at,
            "endedAt": utc_now(),
            "durationMs": duration_ms,
        },
        "loop": {
            "maxIterations": max_iterations,
            "implementationIterationsUsed": len(implementation_runs),
            "stoppedReason": implementation_stopped_reason,
        },
        "sample": without_none_values({
            "id": optional_env("RUHROH_SAMPLE_ID"),
            "index": integer_env("RUHROH_RUN_INDEX"),
            "count": integer_env("RUHROH_RUN_COUNT"),
            "seed": optional_env("RUHROH_SAMPLE_SEED") or optional_env("RUHROH_RUN_SEED"),
        }),
        "runAgent": without_none_values({
            "adapterId": adapter.id,
            "adapterVersion": run_agent_manifest.get("adapterVersion") if isinstance(run_agent_manifest.get("adapterVersion"), str) else optional_env("RUHROH_RUN_AGENT_ADAPTER_VERSION"),
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "model": run_agent_manifest.get("model") if isinstance(run_agent_manifest.get("model"), dict) else model_manifest(prefix="RUHROH_AGENT"),
            "usage": run_agent_manifest.get("usage") if isinstance(run_agent_manifest.get("usage"), dict) else None,
            "command": command_manifest("RUHROH_RUN_AGENT_COMMAND"),
        }),
        "evaluator": without_none_values({
            "command": command_manifest("RUHROH_EVAL_COMMAND"),
            "fixtureConfigured": bool(os.environ.get("RUHROH_EVAL_RESULT_FIXTURE") or os.environ.get("RUHROH_EVAL_RESULT_FIXTURE_PATH")),
            "inputSummary": evaluator_input_summary(),
            "judge": eval_result.get("judge") if isinstance(eval_result, dict) and isinstance(eval_result.get("judge"), dict) else None,
            "model": model_manifest(prefix="RUHROH_EVAL"),
        }),
        "environment": without_none_values({
            "fingerprint": environment_fingerprint(),
            "pythonVersion": platform.python_version(),
            "platform": platform.platform(),
            "system": platform.system(),
            "machine": platform.machine(),
            "containerImage": optional_env("RUHROH_CONTAINER_IMAGE"),
            "runIndex": integer_env("RUHROH_RUN_INDEX"),
            "runCount": integer_env("RUHROH_RUN_COUNT"),
            "workspaceRoot": str(workspace_root),
            "evalWorkspaceRoot": str(eval_workspace_root),
        }),
        "env": {
            "forwardedKeys": forwarded_env_keys(),
            "secretKeysPresent": secret_env_keys_present(),
            "runtime": runtime_env_manifest(),
        },
        "usage": usage_manifest(run_agent_manifest.get("usage") if isinstance(run_agent_manifest.get("usage"), dict) else None),
        "artifactPaths": artifact_paths,
    }
    benchmark_target = benchmark_target_manifest(run_agent_manifest)
    if benchmark_target:
        manifest["benchmarkTarget"] = benchmark_target
    if failure_details is not None:
        manifest["failureDetails"] = failure_details
    return without_none_values(manifest)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def evaluator_input_summary() -> dict[str, Any]:
    private_assets = read_json_env_array("RUHROH_EVAL_PRIVATE_ASSETS_JSON")
    return {
        "scenarioContextCount": len(read_json_env_array("RUHROH_EVAL_SCENARIO_CONTEXT_JSON")),
        "goalRubricCount": len(read_json_env_array("RUHROH_EVAL_GOAL_RUBRIC_JSON")),
        "evidenceGuidanceCount": len(read_json_env_array("RUHROH_EVAL_EVIDENCE_GUIDANCE_JSON")),
        "calibrationCaseCount": len(read_json_env_object_array("RUHROH_EVAL_CALIBRATION_CASES_JSON")),
        "privateAssetCount": len(private_assets),
        "privateAssetPathHashes": [hash_text(asset) for asset in private_assets],
    }


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def optional_env(key: str) -> str | None:
    value = os.environ.get(key)
    return value if value not in (None, "") else None


def read_json_env_object(key: str) -> dict[str, Any]:
    raw = os.environ.get(key)
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def command_manifest(env_key: str) -> dict[str, Any]:
    command = os.environ.get(env_key)
    if command is None or command.strip() == "":
        return {"configured": False}
    manifest = {
        "configured": True,
        "envKey": env_key,
        "sha256": hashlib.sha256(command.encode("utf-8")).hexdigest(),
        "shellEnabled": command_shell_enabled(f"{env_key}_SHELL"),
    }
    inline_base64 = os.environ.get(f"{env_key}_INLINE_BASE64")
    if inline_base64:
        try:
            manifest["inlineSha256"] = hashlib.sha256(base64.b64decode(inline_base64)).hexdigest()
        except Exception:
            manifest["inlineSha256"] = "invalid-inline-base64"
    return manifest


def command_shell_enabled(env_key: str) -> bool:
    return str(os.environ.get(env_key, "")).strip().lower() in {"1", "true", "yes", "on"}


def run_command_capture(
    args: str | list[str],
    *,
    cwd: str,
    env: dict[str, str],
    timeout: int,
    shell: bool,
    stream_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    if not stream_output:
        return subprocess.run(
            args,
            cwd=cwd,
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            shell=shell,
        )

    process = subprocess.Popen(
        args,
        cwd=cwd,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=shell,
        bufsize=1,
    )
    chunks: list[str] = []

    def read_stdout() -> None:
        if process.stdout is None:
            return
        for chunk in iter(lambda: process.stdout.read(1), ""):
            chunks.append(chunk)
            sys.stdout.write(chunk)
            sys.stdout.flush()

    reader = threading.Thread(target=read_stdout, daemon=True)
    reader.start()
    try:
        return_code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired as error:
        process.kill()
        reader.join(timeout=1)
        error.output = "".join(chunks)
        raise
    reader.join()
    return subprocess.CompletedProcess(args, return_code, stdout="".join(chunks), stderr=None)


def materialize_inline_command(command_env_key: str, installed_dir: Path) -> None:
    inline_base64 = os.environ.get(f"{command_env_key}_INLINE_BASE64")
    if not inline_base64:
        return
    inline_name = os.environ.get(f"{command_env_key}_INLINE_NAME") or f"{command_env_key.lower()}.sh"
    safe_name = "".join(ch if ch.isalnum() or ch in {".", "_", "-"} else "-" for ch in inline_name).lstrip("-") or f"{command_env_key.lower()}.sh"
    command_dir = installed_dir / "local-commands"
    command_dir.mkdir(parents=True, exist_ok=True)
    command_path = command_dir / safe_name
    payload = base64.b64decode(inline_base64)
    if not command_path.exists() or command_path.read_bytes() != payload:
        command_path.write_bytes(payload)
        command_path.chmod(0o755)
    os.environ[command_env_key] = str(command_path)


def command_args(command: str, *, shell_env_key: str) -> str | list[str]:
    stripped = command.strip()
    if command_shell_enabled(shell_env_key):
        return stripped
    if Path(stripped).exists():
        return [stripped]
    try:
        args = shlex.split(stripped)
    except ValueError as error:
        raise RuntimeError(f"Invalid command syntax for no-shell execution: {error}") from error
    if len(args) == 0:
        raise RuntimeError("Command cannot be empty")
    return args


def model_manifest(*, prefix: str) -> dict[str, Any]:
    provider = optional_env(f"{prefix}_PROVIDER") or optional_env("RUHROH_MODEL_PROVIDER") or optional_env("KCHAT_MODEL_PROVIDER")
    model = optional_env(f"{prefix}_MODEL") or optional_env("RUHROH_MODEL") or optional_env("KCHAT_MODEL")
    return without_none_values({
        "provider": provider,
        "model": model,
        "canonicalId": optional_env(f"{prefix}_MODEL_CANONICAL_ID"),
        "protocol": optional_env(f"{prefix}_PROTOCOL"),
        "version": optional_env(f"{prefix}_MODEL_VERSION"),
        "promptVersion": optional_env(f"{prefix}_PROMPT_VERSION") or optional_env("RUHROH_PROMPT_VERSION"),
    })


def benchmark_target_manifest(run_agent_manifest: dict[str, Any]) -> dict[str, Any]:
    raw = optional_env("RUHROH_BENCHMARK_TARGET_JSON")
    target = read_json_string(raw) if raw else {}
    if not isinstance(target, dict):
        target = {}
    target_id = optional_env("RUHROH_BENCHMARK_TARGET_ID")
    harness = optional_env("RUHROH_AGENT_HARNESS")
    if target_id and not isinstance(target.get("targetId"), str):
        target["targetId"] = target_id
    if harness and not isinstance(target.get("harness"), dict):
        target["harness"] = {"name": harness}
    requested_model = model_manifest(prefix="RUHROH_AGENT")
    existing_requested_model = target.get("requestedModel")
    if not valid_model_manifest(existing_requested_model) and valid_model_manifest(requested_model):
        merged_requested_model = dict(existing_requested_model) if isinstance(existing_requested_model, dict) else {}
        merged_requested_model.update(requested_model)
        target["requestedModel"] = merged_requested_model
    actual_model = run_agent_manifest.get("model")
    if isinstance(actual_model, dict):
        target["actualModel"] = actual_model
    target = without_none_values(target)
    if not non_empty_string(target.get("targetId")) or not valid_model_manifest(target.get("requestedModel")):
        return {}
    return target


def valid_model_manifest(value: Any) -> bool:
    return isinstance(value, dict) and non_empty_string(value.get("model"))


def non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


def read_json_string(raw: str | None) -> Any:
    if raw is None or raw.strip() == "":
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def usage_manifest(adapter_usage: dict[str, Any] | None = None) -> dict[str, Any]:
    return without_none_values({
        "costUsd": nonnegative_number_field(adapter_usage, "costUsd") if adapter_usage is not None and nonnegative_number_field(adapter_usage, "costUsd") is not None else numeric_env("RUHROH_COST_USD"),
        "inputTokens": nonnegative_integer_field(adapter_usage, "inputTokens") if adapter_usage is not None and nonnegative_integer_field(adapter_usage, "inputTokens") is not None else integer_env("RUHROH_INPUT_TOKENS"),
        "outputTokens": nonnegative_integer_field(adapter_usage, "outputTokens") if adapter_usage is not None and nonnegative_integer_field(adapter_usage, "outputTokens") is not None else integer_env("RUHROH_OUTPUT_TOKENS"),
        "totalTokens": nonnegative_integer_field(adapter_usage, "totalTokens") if adapter_usage is not None and nonnegative_integer_field(adapter_usage, "totalTokens") is not None else integer_env("RUHROH_TOTAL_TOKENS"),
    })


def runtime_env_manifest() -> dict[str, str]:
    output: dict[str, str] = {}
    for key in (
        "RUHROH_RUN_SEED",
        "RUHROH_RUN_INDEX",
        "RUHROH_RUN_COUNT",
        "RUHROH_RETRY_POLICY",
        "RUHROH_MAX_ITERATIONS",
        "RUHROH_ITERATION_TIMEOUT_SEC",
        "RUHROH_AGENT_TIMEOUT_SEC",
        "RUHROH_EVAL_TIMEOUT_SEC",
    ):
        value = os.environ.get(key)
        if value not in (None, ""):
            output[key] = value
    return output


def environment_fingerprint() -> dict[str, Any]:
    components = without_none_values({
        "pythonVersion": platform.python_version(),
        "platform": platform.platform(),
        "system": platform.system(),
        "machine": platform.machine(),
        "containerImage": optional_env("RUHROH_CONTAINER_IMAGE"),
    })
    canonical = json.dumps(components, sort_keys=True, separators=(",", ":"))
    return {
        "method": "sha256",
        "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "components": components,
    }


def forwarded_env_keys() -> list[str]:
    prefixes = ("OPENAI_", "OPENROUTER_", "ANTHROPIC_", "TAVILY_", "KCHAT_", "RUHROH_")
    return sorted(key for key in os.environ if key.startswith(prefixes))


def secret_env_keys_present() -> list[str]:
    secret_markers = ("API_KEY", "ACCESS_TOKEN", "AUTH_TOKEN", "BEARER_TOKEN", "SECRET", "PASSWORD")
    return sorted(key for key in os.environ if any(marker in key for marker in secret_markers))


def numeric_env(key: str) -> float | None:
    value = os.environ.get(key)
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def nonnegative_number_field(record: dict[str, Any], key: str) -> float | int | None:
    value = record.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
        return value
    return None


def nonnegative_integer_field(record: dict[str, Any], key: str) -> int | None:
    value = record.get(key)
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    return None


def integer_env(key: str) -> int | None:
    value = os.environ.get(key)
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError:
        return None


def without_none_values(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
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
