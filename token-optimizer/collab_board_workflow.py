"""
collab_board_workflow.py
────────────────────────
Example dev-workflow script showing how to use all four token_optimizer
modules together when working on the collab-board project.

Run from the token-optimizer/ directory:
    python collab_board_workflow.py

The script does NOT call the real Anthropic API — it simulates a full
round-trip so you can see costs and validation results offline.
"""

from __future__ import annotations
import json

from token_optimizer.model_router import ModelRouter
from token_optimizer.token_estimator import ClaudeTokenEstimator
from token_optimizer.quality_validator import QualityValidator
from token_optimizer.token_tracker import TokenTracker


# ── Setup ─────────────────────────────────────────────────────────────────────

router    = ModelRouter()
estimator = ClaudeTokenEstimator()
validator = QualityValidator()
tracker   = TokenTracker()          # writes to usage_log.json by default

SEPARATOR = "─" * 60


# ── Step 1: Route the task to the right Claude model ─────────────────────────

task_prompt = (
    "Implement a connector feature for the collab-board whiteboard app. "
    "Users should be able to draw arrows between sticky notes, rectangles, "
    "and circles.  Connectors must snap to connection points, support two-way "
    "arrowheads, and update in real time via Supabase.  Delete connectors "
    "automatically when a connected object is removed."
)

print(SEPARATOR)
print("STEP 1 — Model routing")
print(SEPARATOR)

routing = router.route_task(task_prompt)

print(f"Task prompt    : {task_prompt[:80]}…")
print(f"Selected model : {routing['selected_model']}")
print(f"Model tier     : {routing['model_tier']}")
print(f"Complexity     : {routing['complexity_score']}/100")
print(f"Reasoning      : {routing['reasoning']}")
print(f"Should validate: {routing['should_validate']}")
print()


# ── Step 2: Estimate token cost before sending ────────────────────────────────

messages = [
    {"role": "user", "content": task_prompt},
]

print(SEPARATOR)
print("STEP 2 — Pre-flight token estimate")
print(SEPARATOR)

estimate = estimator.estimate_tokens(
    messages,
    model=routing["selected_model"],
    task_type="code",
)
cost = estimator.get_cost_estimate(estimate, model=routing["selected_model"])

print(f"Input tokens (est.)  : {estimate['input_tokens']:,}")
print(f"Output tokens (est.) : {estimate['estimated_output_tokens']:,}")
print(f"Total tokens (est.)  : {estimate['total_estimated_tokens']:,}")
print(f"Estimated cost       : ${cost['total_cost_usd']:.6f}")
print()

# Model comparison table
print("Model comparison (cheapest first):")
for row in estimator.compare_models(messages, task_type="code"):
    print(f"  {row['model']:<40} {row['total_tokens']:>8,} tokens  ${row['total_cost_usd']:.6f}")
print()


# ── Step 3: (Simulate) Claude response ────────────────────────────────────────
# In a real workflow you would call the Anthropic SDK here and capture
# actual input_tokens / output_tokens from the API response.

simulated_response = """\
import React, { useRef, useState } from 'react';
import { Arrow, Circle } from 'react-konva';

const CONNECTION_POINTS = ['top', 'bottom', 'left', 'right', 'center'] as const;

function getConnectionPointCoords(obj: BoardObject, point: string) {
    if (obj.type === 'circle') {
        const r = obj.width / 2;
        const coords: Record<string, [number, number]> = {
            top:    [obj.x,     obj.y - r],
            bottom: [obj.x,     obj.y + r],
            left:   [obj.x - r, obj.y    ],
            right:  [obj.x + r, obj.y    ],
            center: [obj.x,     obj.y    ],
        };
        return coords[point] ?? [obj.x, obj.y];
    }
    // rect / sticky-note: top-left origin
    const hw = obj.width  / 2;
    const hh = obj.height / 2;
    const coords: Record<string, [number, number]> = {
        top:    [obj.x + hw,      obj.y         ],
        bottom: [obj.x + hw,      obj.y + obj.height],
        left:   [obj.x,           obj.y + hh    ],
        right:  [obj.x + obj.width, obj.y + hh  ],
        center: [obj.x + hw,      obj.y + hh    ],
    };
    return coords[point] ?? [obj.x, obj.y];
}

export function renderConnector(obj: BoardObject) {
    const { source, target, connectorProperties } = obj;
    const [sx, sy] = getConnectionPointCoords(source.obj, source.point);
    const [tx, ty] = getConnectionPointCoords(target.obj, target.point);
    return (
        <Arrow
            key={obj.id}
            points={[sx, sy, tx, ty]}
            stroke={connectorProperties?.color ?? '#666'}
            strokeWidth={connectorProperties?.thickness ?? 2}
            pointerAtBeginning={connectorProperties?.arrowhead === 'two-way'}
            pointerAtEnding={connectorProperties?.arrowhead !== 'none'}
        />
    );
}
"""

# Actual token counts — in real usage read from API response metadata
ACTUAL_INPUT_TOKENS  = 312
ACTUAL_OUTPUT_TOKENS = 487


# ── Step 4: Validate the response ─────────────────────────────────────────────

print(SEPARATOR)
print("STEP 3 — Quality validation")
print(SEPARATOR)

validation = validator.validate_output(simulated_response)

print(f"Overall score    : {validation['overall_score']}/100")
print(f"Status           : {validation['validation_status']}")
print(f"Completeness     : {validation['completeness']['score']}/100")
print(f"Quality          : {validation['quality']['score']}/100")
if validation["quality"]["findings"]:
    print(f"Findings         : {', '.join(validation['quality']['findings'])}")
if validation["quality"]["issues"]:
    print(f"Issues           : {', '.join(validation['quality']['issues'])}")
print(f"Escalate to Opus : {validation['should_escalate_to_opus']}")
if validation["escalation_reason"]:
    print(f"Escalation reason: {validation['escalation_reason']}")
print()


# ── Step 5: Log actual usage ──────────────────────────────────────────────────

print(SEPARATOR)
print("STEP 4 — Logging actual usage")
print(SEPARATOR)

record = tracker.log_usage(
    model=routing["selected_model"],
    input_tokens=ACTUAL_INPUT_TOKENS,
    output_tokens=ACTUAL_OUTPUT_TOKENS,
    project="collab-board",
    team_member="Samuel Orth",
    task_type="code",
    notes="Connector feature — simulated workflow demo",
)

print(f"Logged record ID : {record['id']}")
print(f"Model            : {record['model']}")
print(f"Input tokens     : {record['input_tokens']:,}")
print(f"Output tokens    : {record['output_tokens']:,}")
print(f"Actual cost      : ${record['total_cost_usd']:.6f}")
print()


# ── Step 6: Usage summary ─────────────────────────────────────────────────────

print(SEPARATOR)
print("STEP 5 — Usage summary (collab-board project)")
print(SEPARATOR)

summary = tracker.get_summary(project="collab-board")

print(f"Total records    : {summary['total_records']}")
print(f"Total tokens     : {summary['total_tokens']:,}")
print(f"Total cost       : ${summary['total_cost_usd']:.6f}")
print()
print("By model:")
for model, stats in summary["by_model"].items():
    print(f"  {model:<40} {stats['records']} calls  "
          f"{stats['tokens']:,} tokens  ${stats['cost_usd']:.6f}")
print()
print(SEPARATOR)
print("Done.  Results written to usage_log.json.")
print(SEPARATOR)
