/**
 * useAIAgent v4 — single-layer AI routing hook
 *
 * Sends every command to ONE endpoint with board state and executes
 * the returned tool calls against the Zustand board store.
 *
 * v4 adds: summarizeBoard — intercepts the tool call and renders a
 *          structured summary frame + sticky notes directly on the board,
 *          synced to all collaborators via Supabase.
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useBoardStore } from '../store/boardStore';

// ── Summary data type (internal) ──────────────────────────────────────────────
interface SummaryData {
  title: string;
  key_points: string[];
  risks: string[];
  action_items: string[];
}

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
const AI_ENDPOINT = `${BACKEND_URL.replace(/\/$/, '')}/recognize-intent`;

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

// ── Template definitions ──────────────────────────────────────────────────────
function createTemplate(templateType: string, startX: number, startY: number): void {
  const store = useBoardStore.getState();
  const { addObject } = store;

  switch (templateType) {
    case 'swot': {
      // Title + 4 quadrant rectangles
      addObject({ id: uuidv4(), type: 'sticky-note', x: startX + 190, y: startY, width: 240, height: 44, text: 'SWOT Analysis', color: '#1F2937' });
      addObject({ id: uuidv4(), type: 'rectangle',   x: startX,       y: startY + 60, width: 210, height: 160, text: 'Strengths',     color: '#22C55E' });
      addObject({ id: uuidv4(), type: 'rectangle',   x: startX + 220, y: startY + 60, width: 210, height: 160, text: 'Weaknesses',    color: '#EF4444' });
      addObject({ id: uuidv4(), type: 'rectangle',   x: startX,       y: startY + 230, width: 210, height: 160, text: 'Opportunities', color: '#3B82F6' });
      addObject({ id: uuidv4(), type: 'rectangle',   x: startX + 220, y: startY + 230, width: 210, height: 160, text: 'Threats',       color: '#F97316' });
      break;
    }

    case 'kanban': {
      const cols = [
        { label: 'To Do',       color: '#EF4444' },
        { label: 'In Progress', color: '#F97316' },
        { label: 'Done',        color: '#22C55E' },
      ];
      cols.forEach(({ label, color }, i) => {
        addObject({ id: uuidv4(), type: 'rectangle',  x: startX + i * 220, y: startY,      width: 200, height: 46,  text: label, color });
        addObject({ id: uuidv4(), type: 'sticky-note', x: startX + i * 220, y: startY + 60, width: 200, height: 110, text: '+ Add card', color: '#FFDD57' });
      });
      break;
    }

    case 'userJourney': {
      const stages = ['Awareness', 'Consideration', 'Purchase', 'Retention', 'Advocacy'];
      const colors  = ['#3B82F6',  '#8B5CF6',       '#22C55E', '#F97316',   '#EC4899'];
      stages.forEach((stage, i) => {
        addObject({ id: uuidv4(), type: 'sticky-note', x: startX + i * 210, y: startY, width: 190, height: 110, text: stage, color: colors[i] });
      });
      break;
    }

    case 'decisionMatrix': {
      const quadrants = [
        { label: 'Do First\n(Urgent + Important)',     color: '#22C55E', dx: 0,   dy: 0 },
        { label: 'Schedule\n(Important, Not Urgent)',  color: '#3B82F6', dx: 220, dy: 0 },
        { label: 'Delegate\n(Urgent, Not Important)',  color: '#F97316', dx: 0,   dy: 180 },
        { label: 'Eliminate\n(Not Urgent, Not Important)', color: '#EF4444', dx: 220, dy: 180 },
      ];
      addObject({ id: uuidv4(), type: 'sticky-note', x: startX + 170, y: startY, width: 280, height: 40, text: 'Decision Matrix', color: '#1F2937' });
      quadrants.forEach(({ label, color, dx, dy }) => {
        addObject({ id: uuidv4(), type: 'rectangle', x: startX + dx, y: startY + 50 + dy, width: 200, height: 160, text: label, color });
      });
      break;
    }

    default:
      console.warn('[useAIAgent] Unknown template type:', templateType);
  }
}

// ── Summary board renderer ────────────────────────────────────────────────────
// Creates a labelled frame + colour-coded sticky notes on the board.
// All objects flow through addObject → scheduleSyncDebounced → Supabase,
// so every collaborator sees them automatically.
function renderSummaryOnBoard(summary: SummaryData): void {
  const { addObject, objects } = useBoardStore.getState();

  // Place frame to the right of the rightmost existing object (or default)
  const maxX = objects.length > 0
    ? Math.max(...objects.map((o) => o.x + (o.width ?? 0)))
    : 0;
  const frameX = Math.max(maxX + 60, 100);
  const frameY = 100;

  // Layout constants
  const PAD     = 20;
  const TITLE_H = 44;   // height reserved for the frame label
  const NOTE_W  = 250;
  const NOTE_H  = 140;
  const COL_GAP = 16;
  const ROW_GAP = 10;
  const NOTE_STEP = NOTE_H + ROW_GAP;

  const col2Count = summary.risks.length + summary.action_items.length;
  const maxRows   = Math.max(summary.key_points.length, col2Count, 1);

  const FRAME_W = PAD + NOTE_W + COL_GAP + NOTE_W + PAD;  // 576px
  const FRAME_H = PAD + TITLE_H + PAD + maxRows * NOTE_STEP - ROW_GAP + PAD;

  // ── Frame (inserted first so it renders behind the notes) ──
  addObject({
    id: uuidv4(),
    type: 'frame',
    x: frameX,
    y: frameY,
    width: FRAME_W,
    height: FRAME_H,
    text: summary.title,
    color: 'rgba(255,255,255,0.02)',
    strokeColor: '#94a3b8',
  });

  // ── Note positions ──
  const notesY = frameY + PAD + TITLE_H + PAD;
  const col1X  = frameX + PAD;
  const col2X  = frameX + PAD + NOTE_W + COL_GAP;

  // Column 1 — Key Points (blue)
  summary.key_points.forEach((point, i) => {
    addObject({
      id: uuidv4(), type: 'sticky-note',
      x: col1X, y: notesY + i * NOTE_STEP,
      width: NOTE_W, height: NOTE_H,
      text: point,
      color: '#3B82F6',
    });
  });

  // Column 2 — Risks (red) stacked above Action Items (green)
  summary.risks.forEach((risk, i) => {
    addObject({
      id: uuidv4(), type: 'sticky-note',
      x: col2X, y: notesY + i * NOTE_STEP,
      width: NOTE_W, height: NOTE_H,
      text: risk,
      color: '#EF4444',
    });
  });

  summary.action_items.forEach((item, i) => {
    addObject({
      id: uuidv4(), type: 'sticky-note',
      x: col2X, y: notesY + (summary.risks.length + i) * NOTE_STEP,
      width: NOTE_W, height: NOTE_H,
      text: item,
      color: '#10B981',
    });
  });
}

// ── Tool executor ─────────────────────────────────────────────────────────────
function executeToolCall(call: ToolCall): void {
  const { name, args } = call;
  console.log('[useAIAgent] executing tool:', name, args);
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
        ...(typeof args.text === 'string' && args.text ? { text: args.text } : {}),
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
    case 'updateObject': {
      if (!args.objectId) break;
      const updates: Record<string, unknown> = {};
      if (typeof args.color  === 'string') updates.color  = resolveColor(args.color, '');
      if (typeof args.text   === 'string') updates.text   = args.text;
      if (typeof args.x      === 'number') updates.x      = args.x;
      if (typeof args.y      === 'number') updates.y      = args.y;
      if (typeof args.width  === 'number') updates.width  = args.width;
      if (typeof args.height === 'number') updates.height = args.height;
      if (Object.keys(updates).length > 0) updateObject(args.objectId as string, updates);
      break;
    }

    case 'moveObject':
      if (args.objectId) {
        updateObject(args.objectId as string, { x: args.x as number, y: args.y as number });
      }
      break;

    case 'deleteObjects': {
      const ids = args.objectIds as string[] | undefined;
      if (!ids || ids.length === 0) break;
      for (const id of ids) deleteObject(id);
      break;
    }

    // Legacy single-delete (keep for backward compat)
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

    case 'alignObjects': {
      const alignment = args.alignment as string;
      const allObjs = useBoardStore.getState().objects;
      const rawIds  = args.objectIds as string[] | undefined;
      const targetObjs = rawIds && rawIds.length > 0
        ? allObjs.filter((o) => rawIds.includes(o.id) && o.type !== 'connector' && o.type !== 'line')
        : allObjs.filter((o) => o.type !== 'connector' && o.type !== 'line');

      if (targetObjs.length < 2) break;

      // Compute reference value for the chosen edge
      let refLeft   = Math.min(...targetObjs.map((o) => o.x));
      let refRight  = Math.max(...targetObjs.map((o) => o.x + o.width));
      let refTop    = Math.min(...targetObjs.map((o) => o.y));
      let refBottom = Math.max(...targetObjs.map((o) => o.y + o.height));
      let refCX     = targetObjs.reduce((s, o) => s + o.x + o.width  / 2, 0) / targetObjs.length;
      let refCY     = targetObjs.reduce((s, o) => s + o.y + o.height / 2, 0) / targetObjs.length;

      rearrangeObjects(targetObjs.map((o) => {
        let newX = o.x, newY = o.y;
        switch (alignment) {
          case 'left':     newX = refLeft;                  break;
          case 'right':    newX = refRight  - o.width;      break;
          case 'top':      newY = refTop;                   break;
          case 'bottom':   newY = refBottom - o.height;     break;
          case 'center-x': newX = refCX - o.width  / 2;    break;
          case 'center-y': newY = refCY - o.height / 2;    break;
        }
        return { id: o.id, x: newX, y: newY };
      }));
      break;
    }

    case 'distributeObjects': {
      const direction = args.direction as string;
      const allObjs   = useBoardStore.getState().objects;
      const rawIds    = args.objectIds as string[] | undefined;
      const targets   = rawIds && rawIds.length > 0
        ? allObjs.filter((o) => rawIds.includes(o.id) && o.type !== 'connector' && o.type !== 'line')
        : allObjs.filter((o) => o.type !== 'connector' && o.type !== 'line');

      if (targets.length < 3) break;

      if (direction === 'horizontal') {
        const sorted = [...targets].sort((a, b) => a.x - b.x);
        const totalW = sorted.reduce((s, o) => s + o.width, 0);
        const span   = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width - sorted[0].x;
        const gap    = (span - totalW) / (sorted.length - 1);
        let cur = sorted[0].x;
        rearrangeObjects(sorted.map((o) => {
          const x = cur; cur += o.width + gap;
          return { id: o.id, x, y: o.y };
        }));
      } else {
        const sorted = [...targets].sort((a, b) => a.y - b.y);
        const totalH = sorted.reduce((s, o) => s + o.height, 0);
        const span   = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height - sorted[0].y;
        const gap    = (span - totalH) / (sorted.length - 1);
        let cur = sorted[0].y;
        rearrangeObjects(sorted.map((o) => {
          const y = cur; cur += o.height + gap;
          return { id: o.id, x: o.x, y };
        }));
      }
      break;
    }

    case 'createTemplate': {
      const templateType = args.templateType as string;
      const x = typeof args.x === 'number' ? args.x : 80;
      const y = typeof args.y === 'number' ? args.y : 80;
      createTemplate(templateType, x, y);
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

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const obj of objects) {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, obj.x + (obj.width  ?? 0));
        maxY = Math.max(maxY, obj.y + (obj.height ?? 0));
      }

      const contentW = maxX - minX + 80;
      const contentH = maxY - minY + 80;
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

  const { boardId, objects, selectedObjectIds } = useBoardStore();

  const processCommand = useCallback(
    async (command: string) => {
      const cmd = command.trim();
      if (!cmd) return;

      setPhase('thinking');
      setErrorMsg('');

      try {
        // Build minimal board state to send — gives Claude context for manipulation commands.
        // Only include non-connector/non-line objects; round floats to save tokens.
        const boardState = objects
          .filter((o) => o.type !== 'connector' && o.type !== 'line')
          .map((o) => ({
            id: o.id,
            type: o.type,
            x: Math.round(o.x),
            y: Math.round(o.y),
            width:  Math.round(o.width),
            height: Math.round(o.height),
            ...(o.color ? { color: o.color } : {}),
            ...(o.text  ? { text: o.text.slice(0, 60) } : {}),
            ...(selectedObjectIds.includes(o.id) ? { selected: true } : {}),
          }));

        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd, board_state: boardState }),
        });

        const data = await response.json();
        console.log('[useAIAgent] response status:', response.status, '| body:', data);

        if (!response.ok) {
          throw new Error(data.error ?? data.detail ?? `Server error ${response.status}`);
        }

        const toolCalls: ToolCall[] = (data.tool_calls ?? data.toolCalls ?? []).map(
          (tc: { name: string; args?: Record<string, unknown> }) => ({
            name: tc.name,
            args: tc.args ?? {},
          }),
        );

        if (toolCalls.length === 0) {
          // If the backend returned a message instead of a tool call (e.g. running
          // an older version without summarizeBoard), surface it as an error hint.
          const serverMsg: string = typeof data.message === 'string' ? data.message : '';
          if (serverMsg) {
            console.warn('[useAIAgent] backend returned message (no tool call):', serverMsg);
          }
          setPhase('done');
          setTimeout(() => setPhase('idle'), 2_200);
          return;
        }

        // ── Intercept summarizeBoard before general execution ──────────────
        const summaryCall = toolCalls.find((tc) => tc.name === 'summarizeBoard');
        const otherCalls  = toolCalls.filter((tc) => tc.name !== 'summarizeBoard');

        if (summaryCall) {
          const args = summaryCall.args as Partial<SummaryData>;
          renderSummaryOnBoard({
            title:        typeof args.title        === 'string' ? args.title        : 'Board Summary',
            key_points:   Array.isArray(args.key_points)        ? args.key_points   : [],
            risks:        Array.isArray(args.risks)             ? args.risks        : [],
            action_items: Array.isArray(args.action_items)      ? args.action_items : [],
          });
          // After a brief settle, fit the view so the new summary frame is visible
          setTimeout(() => {
            const s = useBoardStore.getState();
            const objs = s.objects;
            if (objs.length === 0) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const o of objs) {
              minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
              maxX = Math.max(maxX, o.x + (o.width ?? 0));
              maxY = Math.max(maxY, o.y + (o.height ?? 0));
            }
            const contentW = maxX - minX + 80;
            const contentH = maxY - minY + 80;
            const viewW = window.innerWidth  - 40;
            const viewH = window.innerHeight - 150;
            const newZoom = Math.max(0.25, Math.min(2, Math.min(viewW / contentW, viewH / contentH)));
            const newPanX = viewW / 2 - (minX + contentW / 2 - 40) * newZoom;
            const newPanY = viewH / 2 - (minY + contentH / 2 - 40) * newZoom;
            s.setZoom(newZoom);
            s.setPan(newPanX, newPanY);
          }, 200);
        }

        if (otherCalls.length > 0) {
          setPhase('creating');
          await new Promise<void>((res) => setTimeout(res, 60));

          console.log('[useAIAgent] tool calls to execute:', otherCalls);
          for (const call of otherCalls) {
            try {
              executeToolCall(call);
            } catch (err) {
              console.error(`[useAIAgent] tool "${call.name}" threw:`, err);
            }
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
    [boardId, objects, selectedObjectIds],
  );

  return { processCommand, phase, errorMessage };
}
