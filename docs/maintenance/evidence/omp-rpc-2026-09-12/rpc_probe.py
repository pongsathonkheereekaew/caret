#!/usr/bin/env python3
"""Deterministic, provider-free smoke probe for `omp --mode rpc`.

The probe creates all state below /tmp, supplies one auth:none model, never sends
`prompt`, and only exercises synchronous RPC/control-plane paths. It writes a
small JSON summary plus raw stdout/stderr next to this script.
"""

from __future__ import annotations

import json
import hashlib
import os
import select
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


BINARY = "/Users/pond/.local/bin/omp"
ROOT = Path(__file__).resolve().parent
ROOT.mkdir(parents=True, exist_ok=True)


MODEL_YAML = """\
providers:
  probe:
    baseUrl: http://127.0.0.1:9/v1
    auth: none
    api: openai-completions
    models:
      - id: probe-model
        name: Caret OMP probe model
        api: openai-completions
        reasoning: false
        input: [text]
        cost:
          input: 0
          output: 0
          cacheRead: 0
          cacheWrite: 0
        contextWindow: 128000
        maxTokens: 4096
"""


class ProbeError(RuntimeError):
    pass


_stdout_buffers: dict[int, bytearray] = {}


def wait_for_frame(proc: subprocess.Popen[str], predicate, frames: list[dict[str, Any]], timeout: float = 3.0):
    buffer = _stdout_buffers.setdefault(id(proc), bytearray())
    deadline = __import__("time").monotonic() + timeout
    while __import__("time").monotonic() < deadline:
        remaining = deadline - __import__("time").monotonic()
        ready, _, _ = select.select([proc.stdout], [], [], max(0.01, remaining))
        if not ready:
            continue
        chunk = os.read(proc.stdout.fileno(), 65536)
        if not chunk:
            stderr = proc.stderr.read().decode("utf-8", errors="replace")
            raise ProbeError(f"OMP exited before expected frame; rc={proc.poll()} stderr={stderr[:1000]}")
        buffer.extend(chunk)
        while b"\n" in buffer:
            line_bytes, _, remainder = buffer.partition(b"\n")
            buffer.clear()
            buffer.extend(remainder)
            line = line_bytes.decode("utf-8")
            if not line:
                continue
            try:
                frame = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ProbeError(f"non-JSON stdout frame: {line[:200]!r}") from exc
            frames.append(frame)
            if predicate(frame):
                return frame
    raise ProbeError("timed out waiting for expected RPC frame")


def start(mode: str) -> tuple[subprocess.Popen[str], Path, list[dict[str, Any]]]:
    run_dir = Path(tempfile.mkdtemp(prefix="caret-omp-rpc-", dir="/tmp"))
    (run_dir / "models.yml").write_text(MODEL_YAML, encoding="utf-8")
    env = {
        "PATH": "/usr/bin:/bin:/Users/pond/.bun/bin:/Users/pond/.local/bin",
        "PI_CODING_AGENT_DIR": str(run_dir),
        "PI_NO_PTY": "1",
        "PI_NOTIFICATIONS": "off",
    }
    args = [
        BINARY,
        "--mode",
        mode,
        "--no-session",
        "--no-skills",
        "--no-rules",
        "--no-extensions",
        "--no-title",
        "--cwd",
        str(run_dir),
    ]
    proc = subprocess.Popen(
        args,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=False,
        bufsize=0,
        env=env,
    )
    frames: list[dict[str, Any]] = []
    wait_for_frame(proc, lambda f: f.get("type") == "ready", frames)
    return proc, run_dir, frames


def send(proc, frames, command: dict[str, Any]):
    request_id = command.get("id")
    proc.stdin.write((json.dumps(command, separators=(",", ":")) + "\n").encode("utf-8"))
    proc.stdin.flush()
    if request_id is None:
        raise ProbeError("probe command needs an id")
    return wait_for_frame(
        proc,
        lambda f: f.get("type") == "response" and f.get("id") == request_id,
        frames,
    )


def expect_success(proc, frames, command: dict[str, Any]):
    response = send(proc, frames, command)
    if not response.get("success"):
        raise ProbeError(f"{command['type']} failed: {response}")
    return response


def summarize_response(response: dict[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "id": response.get("id"),
        "command": response.get("command"),
        "success": response.get("success"),
    }
    if not response.get("success"):
        summary.update({"error": response.get("error"), "code": response.get("code")})
        return summary
    data = response.get("data")
    if response.get("command") == "get_state" and isinstance(data, dict):
        summary["state"] = {
            key: data.get(key)
            for key in (
                "sessionId",
                "sessionFile",
                "sessionName",
                "isStreaming",
                "isCompacting",
                "steeringMode",
                "followUpMode",
                "interruptMode",
                "autoCompactionEnabled",
                "fastModeEnabled",
                "fastModeActive",
                "messageCount",
                "queuedMessageCount",
                "todoPhases",
            )
        }
        summary["toolNames"] = [tool.get("name") for tool in data.get("dumpTools", [])]
        summary["systemPromptCount"] = len(data.get("systemPrompt") or [])
    elif response.get("command") == "get_available_commands" and isinstance(data, dict):
        commands = data.get("commands") or []
        summary["commandCount"] = len(commands)
        summary["commandNames"] = [item.get("name") for item in commands]
    elif response.get("command") == "get_available_models" and isinstance(data, dict):
        models = data.get("models") or []
        summary["models"] = [f"{item.get('provider')}/{item.get('id')}" for item in models]
    elif response.get("command") in {"get_messages", "get_messages_page"} and isinstance(data, dict):
        summary["messageCount"] = len(data.get("messages") or [])
        summary["totalMessages"] = data.get("totalMessages")
        summary["hasNextCursor"] = bool(data.get("nextCursor"))
    elif response.get("command") == "get_session_stats" and isinstance(data, dict):
        summary["stats"] = {
            key: data.get(key)
            for key in ("sessionId", "userMessages", "assistantMessages", "toolCalls", "toolResults", "totalMessages", "cost")
        }
    elif response.get("command") == "get_login_providers" and isinstance(data, dict):
        providers = data.get("providers") or []
        summary["providerCount"] = len(providers)
        summary["authenticatedProviders"] = [item.get("id") for item in providers if item.get("authenticated")]
    elif isinstance(data, dict):
        summary["data"] = data
    elif data is not None:
        summary["data"] = data
    return summary


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "rpc"
    if mode not in {"rpc", "rpc-ui"}:
        print(f"usage: {sys.argv[0]} [rpc|rpc-ui]", file=sys.stderr)
        return 2
    version = subprocess.check_output([BINARY, "--version"], text=True).strip()
    if version != "omp/18.1.18":
        raise ProbeError(f"unsupported baseline: {version}")
    binary_hash = hashlib.sha256(Path(BINARY).read_bytes()).hexdigest()
    proc, run_dir, frames = start(mode)
    results: list[dict[str, Any]] = []
    try:
        commands = [
            {"id": "negotiate-1", "type": "negotiate_protocol", "protocolVersion": 2},
            {"id": "state-1", "type": "get_state"},
            {"id": "commands-1", "type": "get_available_commands"},
            {"id": "models-1", "type": "get_available_models"},
            {"id": "messages-1", "type": "get_messages"},
            {"id": "page-1", "type": "get_messages_page", "limit": 10},
            {"id": "stats-1", "type": "get_session_stats"},
            {
                "id": "todos-1",
                "type": "set_todos",
                "phases": [{"name": "probe", "tasks": [{"content": "check RPC", "status": "pending"}]}],
            },
            {"id": "steering-1", "type": "set_steering_mode", "mode": "all"},
            {"id": "follow-up-1", "type": "set_follow_up_mode", "mode": "all"},
            {"id": "interrupt-1", "type": "set_interrupt_mode", "mode": "wait"},
            {"id": "compact-1", "type": "set_auto_compaction", "enabled": False},
            {"id": "retry-1", "type": "set_auto_retry", "enabled": True},
            {"id": "thinking-1", "type": "set_thinking_level", "level": "low"},
            {
                "id": "host-tools-1",
                "type": "set_host_tools",
                "tools": [
                    {
                        "name": "probe_echo",
                        "label": "Probe Echo",
                        "description": "Provider-free host tool probe",
                        "parameters": {
                            "type": "object",
                            "properties": {"message": {"type": "string"}},
                            "required": ["message"],
                            "additionalProperties": False,
                        },
                    }
                ],
            },
            {
                "id": "host-uri-1",
                "type": "set_host_uri_schemes",
                "schemes": [{"scheme": "probe", "description": "Provider-free URI probe", "writable": False}],
            },
            {"id": "fast-1", "type": "set_fast_mode", "enabled": True},
            {"id": "state-2", "type": "get_state"},
            {"id": "bash-1", "type": "bash", "command": "printf OMP_RPC_BASH_OK"},
            {"id": "last-text-1", "type": "get_last_assistant_text"},
            {"id": "branch-1", "type": "get_branch_messages"},
            {"id": "messages-2", "type": "get_messages"},
            {"id": "name-1", "type": "set_session_name", "name": "Caret RPC probe"},
            {"id": "name-empty-1", "type": "set_session_name", "name": "   "},
            {"id": "login-providers-1", "type": "get_login_providers"},
        ]
        for command in commands:
            if command["id"] == "fast-1":
                response = send(proc, frames, command)
                results.append(summarize_response(response))
            elif command["id"] == "name-empty-1":
                response = send(proc, frames, command)
                results.append(summarize_response(response))
            else:
                results.append(summarize_response(expect_success(proc, frames, command)))

        # Unknown commands deliberately lose the request id per the wire contract.
        proc.stdin.write((json.dumps({"id": "unknown-1", "type": "not_a_real_command"}) + "\n").encode("utf-8"))
        proc.stdin.flush()
        unknown = wait_for_frame(
            proc,
            lambda f: f.get("type") == "response" and f.get("command") == "not_a_real_command",
            frames,
        )
        results.append(summarize_response(unknown))

        # Malformed JSON is recoverable and must not terminate the reader.
        proc.stdin.write(b"{malformed-json\n")
        proc.stdin.flush()
        malformed = wait_for_frame(
            proc,
            lambda f: f.get("type") == "response" and f.get("command") == "parse",
            frames,
        )
        results.append(summarize_response(malformed))
        results.append(summarize_response(expect_success(proc, frames, {"id": "state-after-parse", "type": "get_state"})))

        proc.stdin.close()
        proc.wait(timeout=3)
        if proc.returncode != 0:
            raise ProbeError(f"unexpected process exit: {proc.returncode}")
        by_id = {r.get("id"): r for r in results}
        if by_id["negotiate-1"].get("data", {}).get("protocolVersion") != 2:
            raise ProbeError("protocol v2 not selected")
        expected_tools = {"read", "bash", "edit", "eval", "glob", "grep", "task", "hub", "todo", "web_search", "write"}
        if mode == "rpc-ui":
            expected_tools.add("ask")
        if set(by_id["state-1"]["toolNames"]) != expected_tools:
            raise ProbeError("isolated tool registry changed")
        for request_id in ("fast-1", "name-empty-1"):
            if by_id[request_id]["success"]:
                raise ProbeError(f"expected rejection: {request_id}")
        if unknown.get("success") or malformed.get("success"):
            raise ProbeError("invalid input was accepted")
        bash = by_id["bash-1"].get("data", {})
        if bash.get("exitCode") != 0 or bash.get("output") != "OMP_RPC_BASH_OK":
            raise ProbeError("bash result mismatch")
        state = by_id["state-2"]["state"]
        if (state["steeringMode"], state["followUpMode"], state["interruptMode"], state["autoCompactionEnabled"]) != ("all", "all", "wait", False):
            raise ProbeError("configuration readback mismatch")
        stem = "rpc-ui" if mode == "rpc-ui" else "rpc"
        (ROOT / f"{stem}.stdout.jsonl").write_text("\n".join(json.dumps(frame, ensure_ascii=False) for frame in frames) + "\n", encoding="utf-8")
        (ROOT / f"{stem}.stderr.txt").write_text(proc.stderr.read().decode("utf-8", errors="replace"), encoding="utf-8")
        summary = {
            "binary": BINARY,
            "binaryVersion": version,
            "binarySha256": binary_hash,
            "sourceReference": "00085d4e7dfdcfbf302c122fa2682b410a0f43d1",
            "mode": mode,
            "runDir": str(run_dir),
            "exitCode": proc.returncode,
            "frameCount": len(frames),
            "ready": next((frame for frame in frames if frame.get("type") == "ready"), None),
            "eventTypes": sorted({frame.get("type") for frame in frames if frame.get("type") != "response"}),
            "responses": results,
        }
        (ROOT / f"{stem}-summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0
    except Exception as exc:
        try:
            proc.kill()
            proc.wait(timeout=1)
        except Exception:
            pass
        print(f"PROBE_FAILED: {exc}", file=sys.stderr)
        stem = "rpc-ui" if mode == "rpc-ui" else "rpc"
        (ROOT / f"{stem}.stdout.jsonl").write_text("\n".join(json.dumps(frame, ensure_ascii=False) for frame in frames) + "\n", encoding="utf-8")
        (ROOT / f"{stem}.stderr.txt").write_text(proc.stderr.read().decode("utf-8", errors="replace"), encoding="utf-8")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
