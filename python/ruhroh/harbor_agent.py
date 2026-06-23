from __future__ import annotations

import base64
import json
import os
import re
import shlex
import tempfile
import time
from pathlib import Path
from typing import Any

try:
    from harbor.agents.installed.base import BaseInstalledAgent
except ImportError:
    class BaseInstalledAgent:  # type: ignore[no-redef]
        async def exec_as_root(self, environment: Any, command: str, **kwargs: Any) -> Any:
            raise RuntimeError("harbor is not installed")

        async def exec_as_agent(self, environment: Any, command: str, **kwargs: Any) -> Any:
            raise RuntimeError("harbor is not installed")


RUHROH_ADAPTER = "ruhroh-harbor"
RUHROH_DATASET = "ruhroh@local"
RUHROH_AGENT_NAME = "ruhroh-harbor"
RUHROH_RESULT_RE = re.compile(r"RUHROH_RESULT_JSON_BASE64:(?P<payload>[A-Za-z0-9+/=]+)")


class RuhrohHarborAgent(BaseInstalledAgent):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super_init = getattr(super(), "__init__", None)
        if callable(super_init):
            try:
                super_init(*args, **kwargs)
            except TypeError:
                super_init()
        self.logs_dir = kwargs.get("logs_dir")
        self.model_name = kwargs.get("model_name")
        self.max_iterations = kwargs.get("max_iterations")

    @staticmethod
    def name() -> str:
        return RUHROH_AGENT_NAME

    async def install(self, environment: Any) -> None:
        runtime_root = Path(__file__).parent
        await self._exec_as_root(environment, "mkdir -p /installed-agent && chmod 755 /installed-agent")
        for source, destination in {
            runtime_root / "loop_controller.py": "/installed-agent/ruhroh_loop_controller.py",
            runtime_root / "setup.sh": "/installed-agent/install-agent.sh",
        }.items():
            await upload_file_to_environment(environment, source, destination)
        await write_text_to_environment(self, environment, "/installed-agent/setup-env.sh", harbor_env_setup_script())
        await self._exec_as_root(
            environment,
            "chmod a+r /installed-agent/ruhroh_loop_controller.py "
            "&& chmod +x /installed-agent/install-agent.sh "
            "&& . /installed-agent/setup-env.sh "
            "&& /installed-agent/install-agent.sh",
            timeout_sec=harbor_install_timeout_sec(),
        )

    async def run(self, instruction: str, environment: Any, context: Any) -> None:
        started_at = time.monotonic()
        scenario_id = harbor_task_id(context, getattr(self, "logs_dir", None))
        encoded = base64.b64encode(instruction.encode("utf-8")).decode("ascii")
        max_iterations = resolve_max_iterations(getattr(self, "max_iterations", None))
        env_file = create_run_env_file(max_iterations)
        command = (
            "RUHROH_ENV_FILE=/installed-agent/ruhroh-loop-env.json "
            "python3 /installed-agent/ruhroh_loop_controller.py "
            f"--instruction-base64 {shlex.quote(encoded)} "
            f"--scenario-id {shlex.quote(scenario_id)} "
            f"--max-iterations {shlex.quote(str(max_iterations))}"
        )
        wrapped = (
            f"{command}; "
            "__ruhroh_status=$?; "
            "printf '\\nRUHROH_AGENT_EXIT_CODE:%s\\n' \"$__ruhroh_status\"; "
            "exit 0"
        )
        try:
            await upload_file_to_environment(environment, env_file, "/installed-agent/ruhroh-loop-env.json")
            await self._exec_as_root(environment, "chmod 600 /installed-agent/ruhroh-loop-env.json")
            result = await self._exec_as_root(environment, wrapped, timeout_sec=resolve_agent_timeout_sec(scenario_id))
        finally:
            env_file.unlink(missing_ok=True)
            await persist_ruhroh_debug_artifacts(environment, getattr(self, "logs_dir", None))
        write_command_result_artifact(context, result, getattr(self, "logs_dir", None))
        parsed = parse_ruhroh_result(command_output_text(result)) or await read_ruhroh_result(self, environment)
        if parsed is None:
            parsed = {
                "version": "ruhroh_loop_result_v1",
                "adapter": RUHROH_ADAPTER,
                "dataset": RUHROH_DATASET,
                "scenarioId": scenario_id,
                "task_id": scenario_id,
                "status": "failed",
                "failure_kind": "cli_command_failed",
                "failureBucket": "cli_command_failed",
                "duration_ms": round((time.monotonic() - started_at) * 1000),
                "stoppedReason": "missing_result_marker",
            }
            write_ruhroh_result_artifact(context, parsed, getattr(self, "logs_dir", None))
            raise RuntimeError("Ruhroh run did not emit a structured result marker.")
        parsed.setdefault("adapter", RUHROH_ADAPTER)
        parsed.setdefault("dataset", RUHROH_DATASET)
        parsed.setdefault("task_id", scenario_id)
        parsed.setdefault("duration_ms", round((time.monotonic() - started_at) * 1000))
        write_ruhroh_result_artifact(context, parsed, getattr(self, "logs_dir", None))

    async def _exec_as_root(self, environment: Any, command: str, **kwargs: Any) -> Any:
        return await maybe_await(self.exec_as_root(environment, command=command, **without_none_values(kwargs)))


def harbor_env_setup_script() -> str:
    return "\n".join(
        [
            f"export RUHROH_RESULT_ADAPTER={shlex.quote(RUHROH_ADAPTER)}",
            f"export RUHROH_RESULT_DATASET={shlex.quote(RUHROH_DATASET)}",
        ]
    ) + "\n"


def build_run_env_values(max_iterations: int) -> dict[str, str]:
    env = {
        "RUHROH_RESULT_ADAPTER": RUHROH_ADAPTER,
        "RUHROH_RESULT_DATASET": RUHROH_DATASET,
        "RUHROH_MAX_ITERATIONS": str(max_iterations),
    }
    for key in (
        "RUHROH_EVAL_RESULT_FIXTURE",
        "RUHROH_EVAL_RESULT_FIXTURE_PATH",
        "RUHROH_ITERATION_TIMEOUT_SEC",
        "RUHROH_AGENT_TIMEOUT_SEC",
        "RUHROH_INSTALL_TIMEOUT_SEC",
        "RUHROH_RUN_AGENT_ADAPTER",
        "RUHROH_RUN_AGENT_ADAPTER",
        "RUHROH_RUN_AGENT_COMMAND",
        "RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
        "RUHROH_EVAL_COMMAND",
    ):
        value = os.environ.get(key)
        if value is not None:
            env[key] = value
    return env


def create_run_env_file(max_iterations: int) -> Path:
    fd, raw_path = tempfile.mkstemp(prefix="ruhroh-env-", suffix=".json")
    path = Path(raw_path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(build_run_env_values(max_iterations), handle, sort_keys=True)
            handle.write("\n")
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return path


async def upload_file_to_environment(environment: Any, source: Path, destination: str) -> None:
    for method_name in ("copy_to", "copy_to_container", "upload_file", "upload"):
        method = getattr(environment, method_name, None)
        if method is None:
            continue
        for args in (
            (source, destination),
            (str(source), destination),
            (source, Path(destination)),
            (str(source), Path(destination)),
        ):
            try:
                await maybe_await(method(*args))
                return
            except TypeError:
                continue
    raise RuntimeError(f"Harbor environment cannot upload {source} to {destination}.")


async def write_text_to_environment(agent: RuhrohHarborAgent, environment: Any, path: str, content: str) -> None:
    parent = str(Path(path).parent)
    await agent._exec_as_root(
        environment,
        f"mkdir -p {shlex.quote(parent)} && printf %s {shlex.quote(content)} > {shlex.quote(path)}",
    )


async def read_ruhroh_result(agent: RuhrohHarborAgent, environment: Any) -> dict[str, Any] | None:
    result = await agent._exec_as_root(environment, "cat /installed-agent/ruhroh-loop-result.json 2>/dev/null || true")
    text = command_output_text(result)
    if not text.strip():
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


async def persist_ruhroh_debug_artifacts(environment: Any, logs_dir: Any) -> list[Path]:
    if not isinstance(logs_dir, (str, Path)):
        return []
    target_dir = Path(logs_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []
    for source, name in (
        ("/installed-agent/ruhroh-loop-result.json", "ruhroh-loop-result.json"),
        ("/installed-agent/ruhroh-loop-iterations.jsonl", "ruhroh-loop-iterations.jsonl"),
        ("/installed-agent/ruhroh-loop-journey.json", "ruhroh-loop-journey.json"),
        ("/installed-agent/ruhroh-loop-eval.json", "ruhroh-loop-eval.json"),
        ("/installed-agent/ruhroh-loop-bridge.jsonl", "ruhroh-loop-bridge.jsonl"),
        ("/installed-agent/ruhroh-workspace.tar.gz", "ruhroh-workspace.tar.gz"),
        ("/installed-agent/ruhroh-loop-events.tar.gz", "ruhroh-loop-events.tar.gz"),
        ("/installed-agent/ruhroh-loop-transcripts.tar.gz", "ruhroh-loop-transcripts.tar.gz"),
    ):
        destination = target_dir / name
        try:
            await maybe_await(environment.download_file(source, destination))
        except Exception:
            continue
        copied.append(destination)
    return copied


def write_ruhroh_result_artifact(context: Any, result: dict[str, Any], logs_dir: Any) -> Path | None:
    target_dir = context_logs_dir(context, logs_dir)
    if target_dir is None:
        return None
    target_dir.mkdir(parents=True, exist_ok=True)
    task_id = str(result.get("task_id") or result.get("scenarioId") or "unknown")
    path = target_dir / f"ruhroh-{safe_artifact_name(task_id)}.json"
    path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def write_command_result_artifact(context: Any, result: Any, logs_dir: Any) -> Path | None:
    target_dir = context_logs_dir(context, logs_dir)
    if target_dir is None:
        return None
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / "ruhroh-agent-command-output.log"
    path.write_text(command_output_text(result), encoding="utf-8")
    return path


def context_logs_dir(context: Any, logs_dir: Any) -> Path | None:
    for candidate in (
        getattr(context, "agent_logs_dir", None),
        getattr(context, "logs_dir", None),
        logs_dir,
    ):
        if isinstance(candidate, (str, Path)):
            return Path(candidate)
    return None


def parse_ruhroh_result(text: str) -> dict[str, Any] | None:
    match = RUHROH_RESULT_RE.search(text)
    if match is None:
        return None
    try:
        parsed = json.loads(base64.b64decode(match.group("payload")).decode("utf-8"))
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def command_output_text(result: Any) -> str:
    parts: list[str] = []
    for attr in ("stdout", "stderr", "output"):
        value = getattr(result, attr, None)
        if isinstance(value, bytes):
            parts.append(value.decode("utf-8", errors="replace"))
        elif isinstance(value, str):
            parts.append(value)
    return "\n".join(part for part in parts if part)


def harbor_task_id(context: Any, logs_dir: Any) -> str:
    for attr in ("task_id", "task_name", "name"):
        value = getattr(context, attr, None)
        if isinstance(value, str) and value.strip():
            return safe_task_id(value)
    if isinstance(logs_dir, (str, Path)):
        parent = Path(logs_dir).parent.name
        if "__" in parent:
            return safe_task_id(parent.split("__", 1)[0])
    return "unknown"


def resolve_max_iterations(value: Any) -> int:
    if value is not None:
        try:
            return max(1, int(value))
        except (TypeError, ValueError):
            pass
    raw = os.environ.get("RUHROH_MAX_ITERATIONS")
    if raw is not None:
        try:
            return max(1, int(raw))
        except ValueError:
            pass
    return 3


def resolve_agent_timeout_sec(scenario_id: str) -> int:
    del scenario_id
    raw = os.environ.get("RUHROH_AGENT_TIMEOUT_SEC")
    if raw is not None:
        try:
            return max(1, int(raw))
        except ValueError:
            pass
    return 3600


def harbor_install_timeout_sec() -> int:
    raw = os.environ.get("RUHROH_INSTALL_TIMEOUT_SEC")
    if raw is not None:
        try:
            return max(1, int(raw))
        except ValueError:
            pass
    return 900


def safe_task_id(value: str) -> str:
    stripped = value.strip().split("/")[-1]
    return safe_artifact_name(stripped) or "unknown"


def safe_artifact_name(value: str) -> str:
    return "".join(char if char.isalnum() or char in "-_." else "-" for char in value).strip("-_.")


def without_none_values(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}


async def maybe_await(value: Any) -> Any:
    if hasattr(value, "__await__"):
        return await value
    return value
