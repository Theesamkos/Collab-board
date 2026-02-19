"""
ModelRouter — analyse a task prompt and recommend the right Claude model.

Routing logic
─────────────
complexity 0–30  → claude-haiku   (fast, cheap — formatting, simple edits, Q&A)
complexity 31–70 → claude-sonnet  (balanced — most feature work)
complexity 71–100→ claude-opus    (heavy reasoning — architecture, security, complex bugs)
"""

from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Optional

# ── Keyword scoring tables ────────────────────────────────────────────────────

_HIGH = [
    "architect", "complex", "real-time", "real time", "analyse", "analyze",
    "integrate", "security", "performance", "optimis", "optimiz", "refactor",
    "scalab", "distributed", "algorithm", "authentication", "database schema",
    "collaborative", "concurrent", "async", "websocket", "multi-step",
    "design system", "infrastructure", "migration", "debug complex",
    "race condition", "memory leak", "production bug",
]

_MEDIUM = [
    "implement", "feature", "create", "build", "develop", "component",
    "function", "api", "endpoint", "hook", "state", "context",
    "responsive", "animation", "form", "validation", "test", "refactor",
    "connector", "multi-select", "clipboard", "drag", "canvas",
]

_LOW = [
    "fix typo", "rename", "simple", "basic", "format", "style",
    "colour", "color", "margin", "padding", "align", "center", "comment",
    "add text", "hello", "print", "log ", "console",
]

# ── Model catalogue ───────────────────────────────────────────────────────────

MODELS = {
    "haiku":  "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-6",
    "opus":   "claude-opus-4-6",
}


@dataclass
class RoutingResult:
    selected_model: str
    model_tier: str           # 'haiku' | 'sonnet' | 'opus'
    complexity_score: int     # 0–100
    reasoning: str
    should_validate: bool
    validation_model: Optional[str]


class ModelRouter:
    """
    Routes a natural-language task description to the most cost-effective
    Claude model without sacrificing quality.
    """

    def route_task(self, prompt: str) -> dict:
        """
        Analyse *prompt* and return a routing recommendation.

        Returns a plain dict (not a dataclass) so it's easy to print / serialise.
        """
        score, reasoning = self._score(prompt)
        tier = self._tier(score)
        model = MODELS[tier]
        should_validate = score >= 60
        validation_model = MODELS["sonnet"] if tier == "haiku" and should_validate else None

        return {
            "selected_model":   model,
            "model_tier":       tier,
            "complexity_score": score,
            "reasoning":        reasoning,
            "should_validate":  should_validate,
            "validation_model": validation_model,
        }

    # ── private ───────────────────────────────────────────────────────────────

    def _score(self, prompt: str) -> tuple[int, str]:
        text = prompt.lower()
        score = 0
        reasons: list[str] = []

        # Keyword scoring
        high_hits  = [k for k in _HIGH   if k in text]
        mid_hits   = [k for k in _MEDIUM if k in text]
        low_hits   = [k for k in _LOW    if k in text]

        score += min(len(high_hits) * 15, 45)
        score += min(len(mid_hits)  * 7,  35)
        score -= min(len(low_hits)  * 8,  24)

        if high_hits:
            reasons.append(f"high-complexity keywords: {', '.join(high_hits[:3])}")
        if mid_hits:
            reasons.append(f"medium keywords: {', '.join(mid_hits[:3])}")
        if low_hits:
            reasons.append(f"low-complexity indicators: {', '.join(low_hits[:2])}")

        # Length heuristic (longer prompts = more context = harder tasks)
        words = len(prompt.split())
        if words > 120:
            score += 15; reasons.append("long prompt (detailed requirements)")
        elif words > 50:
            score += 8;  reasons.append("medium-length prompt")
        elif words < 10:
            score -= 10; reasons.append("very short prompt (likely simple task)")

        # Multiple distinct requirements
        req_markers = len(re.findall(r'\b(and|also|additionally|furthermore|plus|as well)\b', text))
        if req_markers >= 3:
            score += 10; reasons.append("multiple chained requirements")

        score = max(0, min(100, score))
        reasoning = "; ".join(reasons) if reasons else "no strong complexity signals"
        return score, reasoning

    @staticmethod
    def _tier(score: int) -> str:
        if score <= 30:
            return "haiku"
        if score <= 70:
            return "sonnet"
        return "opus"
