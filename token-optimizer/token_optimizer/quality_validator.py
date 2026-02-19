"""
QualityValidator — lightweight static checks on Claude-generated code/text.

Checks performed
────────────────
1. Completeness  — non-empty, no obvious placeholders, no truncation markers
2. Syntax        — balanced brackets/braces/parens; no bare TODO stubs
3. Quality       — presence of structure (functions/classes/components); line density
4. Escalation    — should this be re-run with Opus?
"""

from __future__ import annotations
import re

_PLACEHOLDER_PATTERNS = [
    r'\bTODO\b', r'\bFIXME\b', r'\bHACK\b',
    r'\.\.\.(?:\s*\n){2}',        # multiple ellipsis-only lines
    r'<your[_\s]code[_\s]here>',
    r'insert[_\s]code[_\s]here',
    r'# placeholder',
    r'pass\s*#\s*implement',
]

_TRUNCATION_MARKERS = [
    r'//\s*\.\.\.\s*rest of',
    r'#\s*\.\.\.\s*rest of',
    r'\[\.{3}\]',
    r'content truncated',
    r'code continues',
]

_STRUCTURE_PATTERNS = [
    r'\bfunction\b', r'\bconst\b.*\s*=\s*\(',  # JS/TS functions
    r'\bclass\b', r'\bdef\b',                    # Python
    r'export\s+(default\s+)?function',
    r'React\.FC', r'useEffect', r'useState',      # React
    r'interface\s+\w+', r'type\s+\w+\s*=',       # TS types
]


def _balanced(text: str) -> bool:
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in text:
        if ch in '([{':
            stack.append(ch)
        elif ch in ')]}':
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
    return len(stack) == 0


class QualityValidator:
    """
    Validate a piece of generated code/text and decide whether to escalate.
    """

    # Score below this → flag as failing
    PASS_THRESHOLD = 60
    # Score below this → suggest re-running with Opus
    ESCALATE_THRESHOLD = 55

    def validate_output(self, generated_code: str) -> dict:
        """
        Parameters
        ----------
        generated_code : str
            The raw output from Claude (code, markdown, etc.).

        Returns
        -------
        dict with keys:
            overall_score          int  (0–100)
            validation_status      str  ('pass' | 'warning' | 'fail')
            completeness           dict
            quality                dict
            should_escalate_to_opus bool
            escalation_reason      str | None
        """
        code = generated_code.strip()

        completeness = self._check_completeness(code)
        quality      = self._check_quality(code)

        score = round(
            completeness["score"] * 0.5 +
            quality["score"]      * 0.5
        )

        if score >= self.PASS_THRESHOLD:
            status = "pass"
        elif score >= 40:
            status = "warning"
        else:
            status = "fail"

        escalate  = score < self.ESCALATE_THRESHOLD
        esc_reason = None
        if escalate:
            if not completeness["is_complete"]:
                esc_reason = "output appears incomplete or truncated"
            elif quality["issues"]:
                esc_reason = f"quality issues: {'; '.join(quality['issues'][:2])}"
            else:
                esc_reason = f"low overall score ({score}/100)"

        return {
            "overall_score":         score,
            "validation_status":     status,
            "completeness":          completeness,
            "quality":               quality,
            "should_escalate_to_opus": escalate,
            "escalation_reason":     esc_reason,
        }

    # ── private ───────────────────────────────────────────────────────────────

    def _check_completeness(self, code: str) -> dict:
        issues: list[str] = []
        score = 100

        if not code:
            return {"score": 0, "is_complete": False,
                    "issues": ["output is empty"]}

        if len(code) < 30:
            issues.append("output is very short (< 30 chars)")
            score -= 30

        for pat in _PLACEHOLDER_PATTERNS:
            if re.search(pat, code, re.IGNORECASE):
                issues.append(f"placeholder detected: {pat}")
                score -= 15

        for pat in _TRUNCATION_MARKERS:
            if re.search(pat, code, re.IGNORECASE):
                issues.append("output appears truncated")
                score -= 25

        # Rough bracket balance check (only meaningful for code blocks)
        if any(ch in code for ch in '{}()[]'):
            if not _balanced(code):
                issues.append("unbalanced brackets/braces")
                score -= 20

        score = max(0, score)
        return {
            "score":       score,
            "is_complete": score >= 60 and not issues,
            "issues":      issues,
        }

    def _check_quality(self, code: str) -> dict:
        issues:   list[str] = []
        findings: list[str] = []
        score = 60  # start neutral

        lines = [l for l in code.splitlines() if l.strip()]
        if not lines:
            return {"score": 0, "issues": ["no content"], "findings": []}

        # Structure bonus
        structure_hits = sum(
            1 for p in _STRUCTURE_PATTERNS if re.search(p, code)
        )
        if structure_hits >= 3:
            score += 25; findings.append("well-structured code")
        elif structure_hits >= 1:
            score += 10; findings.append("some code structure present")
        else:
            score -= 10; issues.append("no recognisable code structure")

        # Comment / documentation bonus
        comment_ratio = sum(
            1 for l in lines
            if l.strip().startswith(('//', '#', '/*', '*', '"""', "'''"))
        ) / len(lines)
        if comment_ratio > 0.1:
            score += 10; findings.append(f"well-commented ({comment_ratio:.0%})")

        # Long-line penalty (> 120 chars suggests minified or auto-generated garbage)
        long_lines = sum(1 for l in lines if len(l) > 120)
        if long_lines / len(lines) > 0.3:
            score -= 15; issues.append("many very long lines (possibly minified)")

        # TypeScript/React quality signals
        if "any" in code and code.count(": any") > 3:
            issues.append("excessive use of 'any' type")
            score -= 8
        if "console.log" in code and code.count("console.log") > 5:
            issues.append("many console.log statements left in")
            score -= 5

        score = max(0, min(100, score))
        return {
            "score":    score,
            "issues":   issues,
            "findings": findings,
        }
