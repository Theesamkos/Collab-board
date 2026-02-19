"""
Intent Recognition Microservice
--------------------------------
A lightweight FastAPI service that uses rule-based regex matching to parse
simple whiteboard commands. Recognized commands are handled locally and
returned immediately. Unrecognized commands are flagged for forwarding to
claude-sonnet-4-6 via the LangChain layer.
"""

from __future__ import annotations

import re
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Intent Recognition Microservice",
    description="Rule-based intent parser for common whiteboard commands.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────

class RecognizeRequest(BaseModel):
    command: str


class RecognizeResponse(BaseModel):
    intent: str
    entities: dict[str, Any]
    confidence: float
    handler: str  # "local" | "forward_to_langchain"


# ── Compiled patterns ─────────────────────────────────────────────────────────
#
# Each entry: (INTENT, compiled_regex, entity_extractor_fn)
# The extractor receives the re.Match object and returns a dict of entities.
#
# Supported intents:
#   CREATE   – add a shape to the board
#   DELETE   – remove selected or named objects
#   MOVE     – reposition an object
#   UPDATE   – change a property (color, size, text)
#   CLEAR    – wipe the board
#   UNDO     – undo last action
#   REDO     – redo last undone action
#   ZOOM     – zoom in / out / reset
#   SELECT   – select objects by type or "all"
# ─────────────────────────────────────────────────────────────────────────────

COLORS = (
    r"(?:red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|"
    r"cyan|teal|magenta|brown|lime|indigo|violet|gold|silver|dark\s+\w+|light\s+\w+)"
)

SHAPES = r"(rectangle|square|circle|oval|ellipse|sticky\s+note|note|line|arrow|triangle)"

# helper: normalise "sticky note" / "note" to canonical type names
_SHAPE_MAP = {
    "rectangle": "rectangle",
    "square": "rectangle",
    "circle": "circle",
    "oval": "circle",
    "ellipse": "circle",
    "sticky note": "sticky-note",
    "note": "sticky-note",
    "line": "line",
    "arrow": "connector",
    "triangle": "triangle",
}


def _shape(raw: str | None) -> str | None:
    if raw is None:
        return None
    return _SHAPE_MAP.get(raw.strip().lower(), raw.strip().lower())


def _color(raw: str | None) -> str | None:
    return raw.strip().lower() if raw else None


# ── CREATE ─────────────────────────────────────────────────────────────────

_CREATE_FULL = re.compile(
    rf"(?:create|add|make|draw|insert)\s+(?:a(?:n)?\s+)?({COLORS})\s+{SHAPES}",
    re.IGNORECASE,
)

_CREATE_SHAPE_ONLY = re.compile(
    rf"(?:create|add|make|draw|insert)\s+(?:a(?:n)?\s+)?{SHAPES}",
    re.IGNORECASE,
)

_CREATE_COLOR_ONLY = re.compile(
    rf"(?:create|add|make|draw|insert)\s+(?:a(?:n)?\s+)?({COLORS})\s+(?:one|object|shape)",
    re.IGNORECASE,
)


def _extract_create(m: re.Match) -> dict[str, Any]:
    groups = [g for g in m.groups() if g is not None]
    if len(groups) == 2:
        return {"color": _color(groups[0]), "type": _shape(groups[1])}
    if len(groups) == 1:
        raw = groups[0].lower()
        if raw in _SHAPE_MAP:
            return {"type": _shape(raw)}
        return {"color": _color(raw)}
    return {}


# ── DELETE ─────────────────────────────────────────────────────────────────

_DELETE_SELECTED = re.compile(
    r"(?:delete|remove|erase|clear)\s+(?:the\s+)?(?:selected|highlighted|it|them)",
    re.IGNORECASE,
)

_DELETE_TYPE = re.compile(
    rf"(?:delete|remove|erase)\s+(?:all\s+)?(?:the\s+)?{SHAPES}s?",
    re.IGNORECASE,
)

_DELETE_ALL = re.compile(
    r"(?:delete|remove|erase)\s+(?:every(?:thing)?|all)",
    re.IGNORECASE,
)


# ── MOVE ───────────────────────────────────────────────────────────────────

_MOVE_COORDS = re.compile(
    r"move\s+(?:it|selected|the\s+\w+)?\s*to\s+\(?(\d+)[,\s]+(\d+)\)?",
    re.IGNORECASE,
)

_MOVE_DIR = re.compile(
    r"move\s+(?:it|selected|the\s+\w+)?\s*(up|down|left|right)(?:\s+by\s+(\d+)(?:\s*px)?)?",
    re.IGNORECASE,
)


# ── UPDATE ─────────────────────────────────────────────────────────────────

_UPDATE_COLOR = re.compile(
    rf"(?:change|set|make)\s+(?:(?:the\s+)?(?:color|fill|background)\s+(?:to|=)\s*)?({COLORS})",
    re.IGNORECASE,
)

_UPDATE_SIZE = re.compile(
    r"(?:resize|set\s+size|change\s+size)\s+(?:to\s+)?(\d+)(?:\s*[xX×]\s*(\d+))?",
    re.IGNORECASE,
)

_UPDATE_TEXT = re.compile(
    r'(?:set|change|update)\s+(?:the\s+)?text\s+(?:to\s+)?["\']?(.+?)["\']?$',
    re.IGNORECASE,
)


# ── UNDO / REDO ────────────────────────────────────────────────────────────

_UNDO = re.compile(r"^\s*undo\s*$", re.IGNORECASE)
_REDO = re.compile(r"^\s*redo\s*$", re.IGNORECASE)


# ── CLEAR ─────────────────────────────────────────────────────────────────

_CLEAR_BOARD = re.compile(r"(?:clear|reset|wipe)\s+(?:the\s+)?(?:board|canvas|all|everything)", re.IGNORECASE)


# ── ZOOM ───────────────────────────────────────────────────────────────────

_ZOOM_IN  = re.compile(r"zoom\s+in(?:\s+(\d+)%?)?", re.IGNORECASE)
_ZOOM_OUT = re.compile(r"zoom\s+out(?:\s+(\d+)%?)?", re.IGNORECASE)
_ZOOM_RESET = re.compile(r"(?:zoom\s+)?reset\s+(?:zoom|view)", re.IGNORECASE)
_ZOOM_PCT = re.compile(r"zoom\s+(?:to\s+)?(\d+)\s*%", re.IGNORECASE)


# ── SELECT ─────────────────────────────────────────────────────────────────

_SELECT_ALL   = re.compile(r"select\s+all", re.IGNORECASE)
_SELECT_TYPE  = re.compile(rf"select\s+(?:all\s+)?{SHAPES}s?", re.IGNORECASE)
_DESELECT     = re.compile(r"(?:deselect|unselect)\s+(?:all)?", re.IGNORECASE)


# ── Master rule table ─────────────────────────────────────────────────────────
# Each entry: (intent_label, [patterns_to_try_in_order], extractor_fn)

def _first_match(patterns: list[re.Pattern], text: str) -> re.Match | None:
    for p in patterns:
        m = p.search(text)
        if m:
            return m
    return None


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/recognize-intent", response_model=RecognizeResponse)
def recognize_intent(body: RecognizeRequest) -> RecognizeResponse:
    cmd = body.command.strip()

    # ── UNDO ──────────────────────────────────────────────────────────────
    if _UNDO.match(cmd):
        return RecognizeResponse(
            intent="UNDO", entities={}, confidence=1.0, handler="local"
        )

    # ── REDO ──────────────────────────────────────────────────────────────
    if _REDO.match(cmd):
        return RecognizeResponse(
            intent="REDO", entities={}, confidence=1.0, handler="local"
        )

    # ── CLEAR BOARD ────────────────────────────────────────────────────────
    if _CLEAR_BOARD.search(cmd):
        return RecognizeResponse(
            intent="CLEAR", entities={}, confidence=1.0, handler="local"
        )

    # ── CREATE (color + shape) ─────────────────────────────────────────────
    m = _CREATE_FULL.search(cmd)
    if m:
        return RecognizeResponse(
            intent="CREATE",
            entities=_extract_create(m),
            confidence=1.0,
            handler="local",
        )

    # ── CREATE (shape only) ────────────────────────────────────────────────
    m = _CREATE_SHAPE_ONLY.search(cmd)
    if m:
        return RecognizeResponse(
            intent="CREATE",
            entities={"type": _shape(m.group(1))},
            confidence=1.0,
            handler="local",
        )

    # ── DELETE ─────────────────────────────────────────────────────────────
    # Check specific-type first so "remove all rectangles" → type, not all
    m = _DELETE_TYPE.search(cmd)
    if m:
        return RecognizeResponse(
            intent="DELETE",
            entities={"target": "type", "type": _shape(m.group(1))},
            confidence=1.0,
            handler="local",
        )

    if _DELETE_SELECTED.search(cmd):
        return RecognizeResponse(
            intent="DELETE", entities={"target": "selected"}, confidence=1.0, handler="local"
        )

    if _DELETE_ALL.search(cmd):
        return RecognizeResponse(
            intent="DELETE", entities={"target": "all"}, confidence=1.0, handler="local"
        )

    # ── MOVE ───────────────────────────────────────────────────────────────
    m = _MOVE_COORDS.search(cmd)
    if m:
        return RecognizeResponse(
            intent="MOVE",
            entities={"x": int(m.group(1)), "y": int(m.group(2))},
            confidence=1.0,
            handler="local",
        )

    m = _MOVE_DIR.search(cmd)
    if m:
        entities: dict[str, Any] = {"direction": m.group(1).lower()}
        if m.group(2):
            entities["amount"] = int(m.group(2))
        return RecognizeResponse(
            intent="MOVE", entities=entities, confidence=1.0, handler="local"
        )

    # ── UPDATE COLOR ───────────────────────────────────────────────────────
    m = _UPDATE_COLOR.search(cmd)
    if m:
        return RecognizeResponse(
            intent="UPDATE",
            entities={"property": "color", "value": _color(m.group(1))},
            confidence=1.0,
            handler="local",
        )

    # ── UPDATE SIZE ────────────────────────────────────────────────────────
    m = _UPDATE_SIZE.search(cmd)
    if m:
        entities = {"property": "size", "width": int(m.group(1))}
        if m.group(2):
            entities["height"] = int(m.group(2))
        return RecognizeResponse(
            intent="UPDATE", entities=entities, confidence=1.0, handler="local"
        )

    # ── UPDATE TEXT ────────────────────────────────────────────────────────
    m = _UPDATE_TEXT.search(cmd)
    if m:
        return RecognizeResponse(
            intent="UPDATE",
            entities={"property": "text", "value": m.group(1).strip()},
            confidence=1.0,
            handler="local",
        )

    # ── SELECT ─────────────────────────────────────────────────────────────
    # Check specific-type first so "select all circles" → type, not all
    m = _SELECT_TYPE.search(cmd)
    if m:
        return RecognizeResponse(
            intent="SELECT",
            entities={"target": "type", "type": _shape(m.group(1))},
            confidence=1.0,
            handler="local",
        )

    if _SELECT_ALL.search(cmd):
        return RecognizeResponse(
            intent="SELECT", entities={"target": "all"}, confidence=1.0, handler="local"
        )

    if _DESELECT.search(cmd):
        return RecognizeResponse(
            intent="DESELECT", entities={}, confidence=1.0, handler="local"
        )

    # ── ZOOM ───────────────────────────────────────────────────────────────
    if _ZOOM_RESET.search(cmd):
        return RecognizeResponse(
            intent="ZOOM", entities={"action": "reset"}, confidence=1.0, handler="local"
        )

    m = _ZOOM_PCT.search(cmd)
    if m:
        return RecognizeResponse(
            intent="ZOOM",
            entities={"action": "set", "percent": int(m.group(1))},
            confidence=1.0,
            handler="local",
        )

    m = _ZOOM_IN.search(cmd)
    if m:
        entities = {"action": "in"}
        if m.group(1):
            entities["percent"] = int(m.group(1))
        return RecognizeResponse(
            intent="ZOOM", entities=entities, confidence=1.0, handler="local"
        )

    m = _ZOOM_OUT.search(cmd)
    if m:
        entities = {"action": "out"}
        if m.group(1):
            entities["percent"] = int(m.group(1))
        return RecognizeResponse(
            intent="ZOOM", entities=entities, confidence=1.0, handler="local"
        )

    # ── UNKNOWN — forward to claude-sonnet-4-6 via LangChain ──────────────
    return RecognizeResponse(
        intent="UNKNOWN",
        entities={},
        confidence=0.0,
        handler="forward_to_langchain",
    )


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
