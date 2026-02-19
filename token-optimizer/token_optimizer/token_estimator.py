"""
ClaudeTokenEstimator — fast, offline token & cost estimation.

Token approximation
───────────────────
Claude uses a BPE tokeniser similar to cl100k_base.
Rule of thumb:  1 token ≈ 4 English characters  (varies for code / non-English)
We use 3.8 chars/token for code-heavy prompts, 4.2 for prose.

Pricing  (update when Anthropic changes rates)
──────────────────────────────────────────────
All figures are per-million tokens, USD.
"""

from __future__ import annotations
import re

# ── Pricing table ─────────────────────────────────────────────────────────────
# (input_per_M, output_per_M)
PRICING: dict[str, tuple[float, float]] = {
    # Claude 4.x
    "claude-opus-4-6":              (15.00, 75.00),
    "claude-sonnet-4-6":            ( 3.00, 15.00),
    "claude-haiku-4-5-20251001":    ( 0.80,  4.00),
    # Claude 3.x aliases (kept for compatibility)
    "claude-3-opus-20240229":       (15.00, 75.00),
    "claude-3-5-sonnet-20241022":   ( 3.00, 15.00),
    "claude-3-5-haiku-20241022":    ( 0.80,  4.00),
    "claude-3-haiku-20240307":      ( 0.25,  1.25),
}

# Output-length multipliers relative to input tokens
_OUTPUT_RATIO = {
    "code":     2.0,   # code generation is verbose
    "analysis": 0.8,
    "general":  1.2,
}


def _chars_per_token(text: str) -> float:
    """Estimate chars-per-token: lower for code, higher for prose."""
    code_density = len(re.findall(r'[{}()\[\];=><]', text)) / max(len(text), 1)
    return 3.6 if code_density > 0.05 else 4.2


def _count_chars(messages: list[dict]) -> int:
    total = 0
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, list):
            content = " ".join(
                block.get("text", "") for block in content if isinstance(block, dict)
            )
        total += len(str(content))
    return total


class ClaudeTokenEstimator:
    """
    Estimates token counts and USD cost for a list of messages
    without making any API calls.
    """

    def estimate_tokens(
        self,
        messages: list[dict],
        model: str = "claude-sonnet-4-6",
        task_type: str = "general",
    ) -> dict:
        """
        Returns:
            input_tokens              int
            estimated_output_tokens   int
            total_estimated_tokens    int
            chars_per_token           float
        """
        chars = _count_chars(messages)
        cpt   = _chars_per_token(" ".join(str(m.get("content", "")) for m in messages))
        input_tok  = max(1, round(chars / cpt))
        ratio      = _OUTPUT_RATIO.get(task_type, 1.2)
        output_tok = max(1, round(input_tok * ratio))

        return {
            "input_tokens":            input_tok,
            "estimated_output_tokens": output_tok,
            "total_estimated_tokens":  input_tok + output_tok,
            "chars_per_token":         round(cpt, 2),
        }

    def get_cost_estimate(
        self,
        token_estimate: dict,
        model: str = "claude-sonnet-4-6",
    ) -> dict:
        """
        Accepts the dict returned by *estimate_tokens* and the target model.

        Returns:
            input_cost_usd   float
            output_cost_usd  float
            total_cost_usd   float
            model            str
        """
        in_price, out_price = PRICING.get(model, (3.00, 15.00))
        in_cost  = token_estimate["input_tokens"]            / 1_000_000 * in_price
        out_cost = token_estimate["estimated_output_tokens"] / 1_000_000 * out_price

        return {
            "input_cost_usd":  round(in_cost,  6),
            "output_cost_usd": round(out_cost, 6),
            "total_cost_usd":  round(in_cost + out_cost, 6),
            "model":           model,
        }

    def compare_models(self, messages: list[dict], task_type: str = "general") -> list[dict]:
        """Return cost estimates for all models, sorted cheapest first."""
        rows = []
        for model in PRICING:
            est  = self.estimate_tokens(messages, model, task_type)
            cost = self.get_cost_estimate(est, model)
            rows.append({
                "model":           model,
                "total_tokens":    est["total_estimated_tokens"],
                "total_cost_usd":  cost["total_cost_usd"],
            })
        return sorted(rows, key=lambda r: r["total_cost_usd"])
