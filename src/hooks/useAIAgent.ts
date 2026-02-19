/**
 * useAIAgent — two-layer AI routing hook
 *
 * Layer 1 (fast, free): Sends the command to the local Python microservice
 *   at http://localhost:8000/recognize-intent. If it recognises the intent,
 *   we execute it directly against the Zustand board store and return.
 *
 * Layer 2 (powerful): If the microservice returns handler:"forward_to_langchain",
 *   or is unreachable, the command goes to /api/ai-command which runs a
 *   claude-sonnet-4-6 agent (via LangChain) traced in LangSmith.
 *   The server returns an array of tool calls that we execute client-side.
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useBoardStore } from '../store/boardStore';

// ── Phase type (mirrors the status values in AICommandInput) ──────────────────
export type AIPhase = 'idle' | 'thinking' | 'creating' | 'done' | 'error';

// ── Internal types ────────────────────────────────────────────────────────────
interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface LocalIntentResult {
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
  handler: 'local' | 'forward_to_langchain';
}

// ── Color helpers (mirrors AICommandInput so we can remove them from there) ───
const COLOR_MAP: Record<string, string> = {
  yellow: '#FFDD57', gold: '#FFDD57', amber: '#F59E0B',
  red: '#EF4444', pink: '#EC4899', magenta: '#D946EF',
  blue: '#3B82F6', navy: '#1E40AF', sky: '#0EA5E9',
  green: '#22C55E', lime: '#84CC16', teal: '#14B8A6', emerald: '#10B981',
  purple: '#8B5CF6', violet: '#7C3AED', indigo: '#6366F1',
  orange: '#F97316', coral: '#F87171',
  white: '#F8FAFC', gray: '#6B7280', grey: '#6B7280',
  black: '#1F2937', dark: '#1F2937',
};

function resolveColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.startsWith('#')) return raw;
  return COLOR_MAP[raw.toLowerCase()] ?? fallback;
}

// ── Tool executor (client-side board mutations) ───────────────────────────────
// Mirrors the executeToolCall function in AICommandInput; centralised here so
// both Layer 1 and Layer 2 share the same execution path.
function executeToolCall(call: ToolCall): void {
  const { name, args } = call;
  const store = useBoardStore.getState();
  const { addObject, updateObject, deleteObject, clearObjects, rearrangeObjects } = store;

  switch (name) {
    case 'createStickyNote':
      addObject({
        id: uuidv4(), type: 'sticky-note',
        x: typeof args.x === 'number' ? args.x : 80 + Math.random() * 500,
        y: typeof args.y === 'number' ? args.y : 80 + Math.random() * 350,
        width: 200, height: 150,
        text: typeof args.text === 'string' ? args.text : '',
        color: resolveColor(args.color as string | undefined, '#FFDD57'),
      });
      break;

    case 'createRectangle':
      addObject({
        id: uuidv4(), type: 'rectangle',
        x: typeof args.x === 'number' ? args.x : 80 + Math.random() * 500,
        y: typeof args.y === 'number' ? args.y : 80 + Math.random() * 350,
        width:  typeof args.width  === 'number' ? args.width  : 200,
        height: typeof args.height === 'number' ? args.height : 140,
        color: resolveColor(args.color as string | undefined, '#3B82F6'),
      });
      break;

    case 'createCircle': {
      const radius = typeof args.radius === 'number' ? args.radius : 60;
      addObject({
        id: uuidv4(), type: 'circle',
        x: typeof args.x === 'number' ? args.x : 100 + Math.random() * 500,
        y: typeof args.y === 'number' ? args.y : 100 + Math.random() * 350,
        width: radius * 2, height: radius * 2,
        color: resolveColor(args.color as string | undefined, '#10B981'),
      });
      break;
    }

    case 'moveObject':
      if (args.objectId) updateObject(args.objectId as string, { x: args.x as number, y: args.y as number });
      break;

    case 'deleteObject':
      if (args.objectId) deleteObject(args.objectId as string);
      break;

    case 'updateStickyNote': {
      if (!args.objectId) break;
      const updates: Record<string, unknown> = {};
      if (typeof args.text  === 'string') updates.text  = args.text;
      if (typeof args.color === 'string') updates.color = resolveColor(args.color, '');
      if (Object.keys(updates).length > 0) updateObject(args.objectId as string, updates);
      break;
    }

    case 'clearBoard':
      clearObjects();
      break;

    case 'changeColor':
      if (args.objectId) {
        updateObject(args.objectId as string, { color: resolveColor(args.color as string | undefined, '#000000') });
      }
      break;

    case 'arrangeInGrid': {
      const cols    = typeof args.columns === 'number' && args.columns > 0 ? args.columns : 3;
      const spacing = typeof args.spacing === 'number' && args.spacing > 0 ? args.spacing : 240;
      const current = useBoardStore.getState().objects;
      rearrangeObjects(
        current.map((obj, i) => ({
          id: obj.id,
          x: 80 + (i % cols) * spacing,
          y: 80 + Math.floor(i / cols) * spacing,
        })),
      );
      break;
    }

    default:
      console.warn('[useAIAgent] Unknown tool call:', name);
  }
}

// ── Layer 1: direct execution of locally-recognised intents ───────────────────
function executeLocalIntent(result: LocalIntentResult): void {
  const { intent, entities } = result;
  const store = useBoardStore.getState();

  switch (intent) {
    case 'CREATE': {
      const type = (entities.type as string) ?? 'rectangle';
      const toolName =
        type === 'sticky-note' ? 'createStickyNote' :
        type === 'circle'      ? 'createCircle'     : 'createRectangle';
      executeToolCall({ name: toolName, args: { color: entities.color } });
      break;
    }

    case 'DELETE': {
      if (entities.target === 'selected') {
        store.deleteSelectedObjects();
      } else if (entities.target === 'all') {
        store.clearObjects();
      } else if (entities.target === 'type') {
        const { objects } = useBoardStore.getState();
        objects
          .filter((o) => o.type === entities.type)
          .forEach((o) => store.deleteObject(o.id));
      }
      break;
    }

    case 'CLEAR':
      store.clearObjects();
      break;

    case 'UNDO':
      useBoardStore.temporal.getState().undo();
      break;

    case 'REDO':
      useBoardStore.temporal.getState().redo();
      break;

    case 'ZOOM': {
      const current = useBoardStore.getState().zoom;
      if      (entities.action === 'reset') { store.setZoom(1); store.setPan(0, 0); }
      else if (entities.action === 'in')    { store.setZoom(Math.min(4, current + 0.25)); }
      else if (entities.action === 'out')   { store.setZoom(Math.max(0.25, current - 0.25)); }
      else if (entities.action === 'set' && typeof entities.percent === 'number') {
        store.setZoom(entities.percent / 100);
      }
      break;
    }

    case 'SELECT': {
      const { objects } = useBoardStore.getState();
      if (entities.target === 'all') {
        store.setSelectedObjectIds(objects.map((o) => o.id));
      } else if (entities.target === 'type') {
        store.setSelectedObjectIds(
          objects.filter((o) => o.type === entities.type).map((o) => o.id),
        );
      }
      break;
    }

    case 'DESELECT':
      store.clearSelection();
      break;

    case 'MOVE': {
      const { objects, selectedObjectIds } = useBoardStore.getState();
      if (typeof entities.x === 'number' && typeof entities.y === 'number') {
        selectedObjectIds.forEach((id) =>
          store.updateObject(id, { x: entities.x as number, y: entities.y as number }),
        );
      } else if (typeof entities.direction === 'string') {
        const step = typeof entities.amount === 'number' ? entities.amount : 20;
        const dx = entities.direction === 'left' ? -step : entities.direction === 'right' ? step : 0;
        const dy = entities.direction === 'up'   ? -step : entities.direction === 'down'  ? step : 0;
        selectedObjectIds.forEach((id) => {
          const obj = objects.find((o) => o.id === id);
          if (obj) store.updateObject(id, { x: obj.x + dx, y: obj.y + dy });
        });
      }
      break;
    }

    case 'UPDATE': {
      const { selectedObjectIds } = useBoardStore.getState();
      if (entities.property === 'color') {
        selectedObjectIds.forEach((id) =>
          store.updateObject(id, { color: resolveColor(entities.value as string, '#3B82F6') }),
        );
      } else if (entities.property === 'size') {
        const w = entities.width as number;
        const h = (entities.height as number | undefined) ?? w;
        selectedObjectIds.forEach((id) => store.updateObject(id, { width: w, height: h }));
      } else if (entities.property === 'text') {
        selectedObjectIds.forEach((id) =>
          store.updateObject(id, { text: entities.value as string }),
        );
      }
      break;
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAIAgent() {
  const [phase, setPhase]           = useState<AIPhase>('idle');
  const [errorMessage, setErrorMsg] = useState('');

  const { boardId, objects } = useBoardStore();

  const processCommand = useCallback(
    async (command: string) => {
      const cmd = command.trim();
      if (!cmd) return;

      setPhase('thinking');
      setErrorMsg('');

      try {
        // ── Layer 1: local intent-recognition microservice ──────────────────
        let forwardToLangChain = true;

        try {
          const r = await fetch('https://collab-board-ai.onrender.com/recognize-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd }),
            signal: AbortSignal.timeout(2_000),
          });

          if (r.ok) {
            const result: LocalIntentResult = await r.json();

            if (result.handler === 'local') {
              // Fast path: zero LLM cost, <2 ms latency
              setPhase('creating');
              await new Promise<void>((res) => setTimeout(res, 80));
              executeLocalIntent(result);
              setPhase('done');
              setTimeout(() => setPhase('idle'), 2_200);
              return;
            }

            // handler === 'forward_to_langchain' → fall through
            forwardToLangChain = true;
          }
        } catch {
          // Microservice unavailable (not running, timed out) — fall through
          console.debug('[useAIAgent] local service unavailable, routing to claude-sonnet-4-6');
        }

        if (forwardToLangChain) {
          // ── Layer 2: LangChain agent (claude-sonnet-4-6, traced via LangSmith) ──
          if (!boardId) throw new Error('No active board');

          const response = await fetch('/api/ai-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, boardId, boardState: objects }),
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? `Server error ${response.status}`);

          const toolCalls: ToolCall[] = data.toolCalls ?? [];

          if (toolCalls.length === 0) {
            setPhase('done');
            setTimeout(() => setPhase('idle'), 2_200);
            return;
          }

          setPhase('creating');
          await new Promise<void>((res) => setTimeout(res, 120));

          for (const call of toolCalls) {
            try {
              executeToolCall(call);
            } catch (err) {
              console.warn(`[useAIAgent] tool "${call.name}" failed:`, err);
            }
          }
        }

        setPhase('done');
        setTimeout(() => setPhase('idle'), 2_200);

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        setErrorMsg(msg);
        setPhase('error');
        setTimeout(() => setPhase('idle'), 4_000);
      }
    },
    [boardId, objects],
  );

  return { processCommand, phase, errorMessage };
}
