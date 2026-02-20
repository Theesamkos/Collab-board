/**
 * useAIAgent v2 — single-layer AI routing hook
 *
 * Sends every command to ONE endpoint and executes the returned tool calls
 * against the Zustand board store.
 *
 * Endpoint resolution:
 *   VITE_AI_BACKEND_URL (env) → Railway always-on backend → /api/v2/ai-command
 *   Default: https://collab-board-backend-production-d852.up.railway.app
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useBoardStore } from '../store/boardStore';

// ── Phase type ────────────────────────────────────────────────────────────────
export type AIPhase = 'idle' | 'thinking' | 'creating' | 'done' | 'error';

// ── Internal types ────────────────────────────────────────────────────────────
interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

// ── Endpoint resolution ───────────────────────────────────────────────────────
const BACKEND_URL = (import.meta.env.VITE_AI_BACKEND_URL as string | undefined)
  || 'https://collab-board-backend-production-d852.up.railway.app';
const AI_ENDPOINT = `${BACKEND_URL.replace(/\/$/, '')}/api/v2/ai-command`;

// ── Color helpers ─────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  yellow: '#FFDD57', gold: '#F59E0B', amber: '#F59E0B',
  red: '#EF4444', pink: '#EC4899', magenta: '#D946EF', coral: '#F87171',
  blue: '#3B82F6', navy: '#1E40AF', sky: '#0EA5E9',
  green: '#22C55E', lime: '#84CC16', teal: '#14B8A6', emerald: '#10B981',
  purple: '#8B5CF6', violet: '#7C3AED', indigo: '#6366F1',
  orange: '#F97316',
  white: '#F8FAFC', gray: '#6B7280', grey: '#6B7280',
  black: '#1F2937', dark: '#1F2937',
};

function resolveColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.startsWith('#')) return raw;
  return COLOR_MAP[raw.toLowerCase()] ?? fallback;
}

// ── Tool executor ─────────────────────────────────────────────────────────────
// Executes a single tool call against the Zustand board store.
// All new camera/viewport tools are handled here.
function executeToolCall(call: ToolCall): void {
  const { name, args } = call;
  const store = useBoardStore.getState();
  const { addObject, updateObject, deleteObject, clearObjects, rearrangeObjects } = store;

  switch (name) {
    // ── Shape creation ──────────────────────────────────────────────────────
    case 'createStickyNote':
      addObject({
        id: uuidv4(), type: 'sticky-note',
        x: typeof args.x === 'number' ? args.x : 80 + Math.random() * 500,
        y: typeof args.y === 'number' ? args.y : 80 + Math.random() * 350,
        width:  typeof args.width  === 'number' ? args.width  : 200,
        height: typeof args.height === 'number' ? args.height : 150,
        text:  typeof args.text  === 'string' ? args.text  : '',
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
        color: resolveColor(args.color as string | undefined, '#22C55E'),
      });
      break;
    }

    // ── Object manipulation ─────────────────────────────────────────────────
    case 'moveObject':
      if (args.objectId) {
        updateObject(args.objectId as string, {
          x: args.x as number,
          y: args.y as number,
        });
      }
      break;

    case 'deleteObject':
      if (args.objectId) deleteObject(args.objectId as string);
      break;

    case 'updateText':
    case 'updateStickyNote': {
      if (!args.objectId) break;
      const updates: Record<string, unknown> = {};
      if (typeof args.text  === 'string') updates.text  = args.text;
      if (typeof args.color === 'string') updates.color = resolveColor(args.color, '');
      if (Object.keys(updates).length > 0) updateObject(args.objectId as string, updates);
      break;
    }

    case 'changeColor':
      if (args.objectId) {
        updateObject(args.objectId as string, {
          color: resolveColor(args.color as string | undefined, '#000000'),
        });
      }
      break;

    case 'clearBoard':
      clearObjects();
      break;

    // ── Layout ──────────────────────────────────────────────────────────────
    case 'arrangeInGrid': {
      const cols    = typeof args.columns === 'number' && args.columns > 0 ? args.columns : 3;
      const spacing = typeof args.spacing === 'number' && args.spacing > 0 ? args.spacing : 240;
      const current = useBoardStore.getState().objects;
      rearrangeObjects(
        current.map((obj, i) => ({
          id: obj.id,
          x: 80 + (i % cols) * spacing,
          y: 80 + Math.floor(i / cols) * (spacing * 0.75),
        })),
      );
      break;
    }

    // ── Camera / viewport ───────────────────────────────────────────────────
    case 'setZoom': {
      const current = useBoardStore.getState().zoom;
      const action  = args.action as string;
      if      (action === 'in')  store.setZoom(Math.min(4, current + 0.25));
      else if (action === 'out') store.setZoom(Math.max(0.25, current - 0.25));
      else if (action === 'reset') { store.setZoom(1); store.setPan(0, 0); }
      else if (action === 'set' && typeof args.level === 'number') {
        store.setZoom(Math.max(0.25, Math.min(4, args.level)));
      }
      break;
    }

    case 'panView': {
      const { panX, panY } = useBoardStore.getState();
      const dir    = args.direction as string;
      const amount = typeof args.amount === 'number' ? args.amount : 200;
      const dx = dir === 'left' ? amount : dir === 'right' ? -amount : 0;
      const dy = dir === 'up'   ? amount : dir === 'down'  ? -amount : 0;
      store.setPan(panX + dx, panY + dy);
      break;
    }

    case 'resetView':
      store.setZoom(1);
      store.setPan(0, 0);
      break;

    case 'fitToView': {
      const { objects } = useBoardStore.getState();
      if (objects.length === 0) { store.setZoom(1); store.setPan(0, 0); break; }

      // Calculate bounding box of all objects
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const obj of objects) {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, obj.x + (obj.width  ?? 0));
        maxY = Math.max(maxY, obj.y + (obj.height ?? 0));
      }

      const contentW = maxX - minX + 80;  // 40px padding each side
      const contentH = maxY - minY + 80;
      // Account for header (~48px) and toolbar (~90px)
      const viewW = window.innerWidth  - 40;
      const viewH = window.innerHeight - 150;

      const newZoom = Math.max(0.25, Math.min(2, Math.min(viewW / contentW, viewH / contentH)));
      const newPanX = viewW / 2 - (minX + contentW / 2 - 40) * newZoom;
      const newPanY = viewH / 2 - (minY + contentH / 2 - 40) * newZoom;

      store.setZoom(newZoom);
      store.setPan(newPanX, newPanY);
      break;
    }

    default:
      console.warn('[useAIAgent] Unknown tool call:', name);
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
        // ── Single AI call ──────────────────────────────────────────────────
        // Calls the Railway backend (VITE_AI_SERVICE_URL) when configured,
        // or falls back to the Vercel / Vite-dev-plugin route.
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command:     cmd,
            // Railway backend uses snake_case; Vercel function uses camelCase.
            // We send both so both endpoints work from the same payload.
            board_state: objects,
            boardState:  objects,
            boardId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? data.detail ?? `Server error ${response.status}`);
        }

        // Railway returns data.tool_calls; Vercel function returns data.toolCalls
        const toolCalls: ToolCall[] = (data.tool_calls ?? data.toolCalls ?? []).map(
          (tc: { name: string; args?: Record<string, unknown> }) => ({
            name: tc.name,
            args: tc.args ?? {},
          }),
        );

        if (toolCalls.length === 0) {
          setPhase('done');
          setTimeout(() => setPhase('idle'), 2_200);
          return;
        }

        setPhase('creating');
        // Small visual delay so the "Creating…" state is perceptible
        await new Promise<void>((res) => setTimeout(res, 80));

        for (const call of toolCalls) {
          try {
            executeToolCall(call);
          } catch (err) {
            console.warn(`[useAIAgent] tool "${call.name}" failed:`, err);
          }
        }

        setPhase('done');
        setTimeout(() => setPhase('idle'), 2_200);

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setPhase('error');
        setTimeout(() => setPhase('idle'), 4_000);
      }
    },
    [boardId, objects],
  );

  return { processCommand, phase, errorMessage };
}
