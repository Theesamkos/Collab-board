"""
TokenTracker — append-only usage log for Claude API calls.

Each call to log_usage() appends one JSON record to usage_log.json
(path configurable via USAGE_LOG env var or the log_path constructor arg).

Records include model, tokens, cost, project, team member, task type,
and a UTC timestamp.  get_summary() aggregates the log so you can see
per-model / per-project spending at a glance.
"""

from __future__ import annotations
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .token_estimator import PRICING

# Default log file location — siblings with pyproject.toml
_DEFAULT_LOG = Path(__file__).resolve().parent.parent / "usage_log.json"


class TokenTracker:
    """
    Logs Claude API usage to a local JSON file and provides summary reports.

    Parameters
    ----------
    log_path : str | Path | None
        Where to write the usage log.  Defaults to the USAGE_LOG environment
        variable if set, otherwise ``<repo-root>/token-optimizer/usage_log.json``.
    """

    def __init__(self, log_path: str | Path | None = None) -> None:
        env_path = os.getenv("USAGE_LOG")
        self.log_path = Path(log_path or env_path or _DEFAULT_LOG)

    # ── public API ────────────────────────────────────────────────────────────

    def log_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        project: str = "unknown",
        team_member: str = "unknown",
        task_type: str = "general",
        notes: str = "",
    ) -> dict:
        """
        Append one usage record and return it.

        Parameters
        ----------
        model          Claude model ID (e.g. "claude-sonnet-4-6")
        input_tokens   Actual input token count from the API response
        output_tokens  Actual output token count from the API response
        project        Project name tag (e.g. "collab-board")
        team_member    Who ran the call (e.g. "Samuel Orth")
        task_type      "code" | "analysis" | "general"
        notes          Optional free-text note

        Returns
        -------
        The dict that was appended to the log.
        """
        in_price, out_price = PRICING.get(model, (3.00, 15.00))
        in_cost  = input_tokens  / 1_000_000 * in_price
        out_cost = output_tokens / 1_000_000 * out_price

        record = {
            "id":            str(uuid.uuid4()),
            "timestamp":     datetime.now(timezone.utc).isoformat(),
            "model":         model,
            "project":       project,
            "team_member":   team_member,
            "task_type":     task_type,
            "input_tokens":  input_tokens,
            "output_tokens": output_tokens,
            "total_tokens":  input_tokens + output_tokens,
            "input_cost_usd":  round(in_cost,  6),
            "output_cost_usd": round(out_cost, 6),
            "total_cost_usd":  round(in_cost + out_cost, 6),
            "notes":         notes,
        }

        self._append(record)
        return record

    def get_summary(
        self,
        project: str | None = None,
        team_member: str | None = None,
    ) -> dict:
        """
        Return aggregated stats from the log.

        Filters
        -------
        project      If given, restrict to records with this project tag.
        team_member  If given, restrict to records with this team member.

        Returns
        -------
        dict with:
            total_records    int
            total_tokens     int
            total_cost_usd   float
            by_model         dict[model_id, {records, tokens, cost}]
            by_project       dict[project,  {records, tokens, cost}]
            by_team_member   dict[member,   {records, tokens, cost}]
        """
        records = self._load()

        if project:
            records = [r for r in records if r.get("project") == project]
        if team_member:
            records = [r for r in records if r.get("team_member") == team_member]

        by_model:       dict[str, dict] = {}
        by_project:     dict[str, dict] = {}
        by_team_member: dict[str, dict] = {}

        for r in records:
            _add(by_model,       r.get("model",       "unknown"), r)
            _add(by_project,     r.get("project",     "unknown"), r)
            _add(by_team_member, r.get("team_member", "unknown"), r)

        return {
            "total_records":  len(records),
            "total_tokens":   sum(r.get("total_tokens", 0) for r in records),
            "total_cost_usd": round(sum(r.get("total_cost_usd", 0) for r in records), 6),
            "by_model":       by_model,
            "by_project":     by_project,
            "by_team_member": by_team_member,
        }

    def clear_log(self) -> None:
        """Wipe the log file (creates an empty list).  Useful in tests."""
        self.log_path.write_text("[]", encoding="utf-8")

    # ── private ───────────────────────────────────────────────────────────────

    def _load(self) -> list[dict]:
        if not self.log_path.exists():
            return []
        try:
            return json.loads(self.log_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []

    def _append(self, record: dict) -> None:
        records = self._load()
        records.append(record)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self.log_path.write_text(
            json.dumps(records, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )


# ── helpers ───────────────────────────────────────────────────────────────────

def _add(bucket: dict, key: str, record: dict) -> None:
    """Accumulate token/cost totals into a bucketed dict."""
    if key not in bucket:
        bucket[key] = {"records": 0, "tokens": 0, "cost_usd": 0.0}
    bucket[key]["records"]  += 1
    bucket[key]["tokens"]   += record.get("total_tokens", 0)
    bucket[key]["cost_usd"] += record.get("total_cost_usd", 0.0)
    bucket[key]["cost_usd"]  = round(bucket[key]["cost_usd"], 6)
