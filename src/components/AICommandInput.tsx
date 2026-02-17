import { useRef, useState } from 'react';
import { Sparkles, ArrowUp, Loader2, Check, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useBoardStore } from '../store/boardStore';

// ── Types ─────────────────────────────────────────────────────────────────────
type Status = 'idle' | 'thinking' | 'creating' | 'done' | 'error';

interface ToolCall {
  name: string;
  args: Record<string, any>;
}

// ── Color resolution (mirrors API logic so names work even if model skips hex) ─
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

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  idle:     { color: '#999999', text: '' },
  thinking: { color: '#17a2b8', text: 'Thinking…' },
  creating: { color: '#6c757d', text: 'Creating…' },
  done:     { color: '#28a745', text: 'Done!' },
  error:    { color: '#dc3545', text: '' },
};

export function AICommandInput() {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [focused, setFocused] = useState(false);
  const [sendHovered, setSendHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { boardId, objects, addObject, updateObject, deleteObject, clearObjects, rearrangeObjects } =
    useBoardStore();

  const loading = status === 'thinking' || status === 'creating';
  const canSend = !!command.trim() && !loading;

  // ── Client-side tool execution ───────────────────────────────────────────────
  const executeToolCall = (call: ToolCall) => {
    const { name, args } = call;

    switch (name) {
      case 'createStickyNote':
        addObject({
          id: uuidv4(),
          type: 'sticky-note',
          x: typeof args.x === 'number' ? args.x : 80 + Math.random() * 500,
          y: typeof args.y === 'number' ? args.y : 80 + Math.random() * 350,
          width: 200,
          height: 150,
          text: args.text ?? '',
          color: resolveColor(args.color, '#FFDD57'),
        });
        break;

      case 'createRectangle':
        addObject({
          id: uuidv4(),
          type: 'rectangle',
          x: typeof args.x === 'number' ? args.x : 80 + Math.random() * 500,
          y: typeof args.y === 'number' ? args.y : 80 + Math.random() * 350,
          width:  typeof args.width  === 'number' ? args.width  : 200,
          height: typeof args.height === 'number' ? args.height : 140,
          color: resolveColor(args.color, '#3B82F6'),
        });
        break;

      case 'createCircle': {
        const radius = typeof args.radius === 'number' ? args.radius : 60;
        addObject({
          id: uuidv4(),
          type: 'circle',
          x: typeof args.x === 'number' ? args.x : 100 + Math.random() * 500,
          y: typeof args.y === 'number' ? args.y : 100 + Math.random() * 350,
          width:  radius * 2,
          height: radius * 2,
          color: resolveColor(args.color, '#10B981'),
        });
        break;
      }

      case 'moveObject':
        if (args.objectId) updateObject(args.objectId, { x: args.x, y: args.y });
        break;

      case 'deleteObject':
        if (args.objectId) deleteObject(args.objectId);
        break;

      case 'updateStickyNote': {
        if (!args.objectId) break;
        const updates: Record<string, any> = {};
        if (typeof args.text  === 'string') updates.text  = args.text;
        if (typeof args.color === 'string') updates.color = resolveColor(args.color, '');
        if (Object.keys(updates).length > 0) updateObject(args.objectId, updates);
        break;
      }

      case 'clearBoard':
        clearObjects();
        break;

      case 'changeColor':
        if (args.objectId) {
          updateObject(args.objectId, { color: resolveColor(args.color, '#000000') });
        }
        break;

      case 'arrangeInGrid': {
        const cols    = typeof args.columns === 'number' && args.columns > 0 ? args.columns : 3;
        const spacing = typeof args.spacing === 'number' && args.spacing > 0 ? args.spacing : 240;
        const current = useBoardStore.getState().objects;
        const positions = current.map((obj, i) => ({
          id: obj.id,
          x: 80 + (i % cols) * spacing,
          y: 80 + Math.floor(i / cols) * spacing,
        }));
        rearrangeObjects(positions);
        break;
      }

      default:
        console.warn('Unknown AI tool:', name);
    }
  };

  // ── Submit handler ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !boardId) return;

    const cmd = command.trim();
    setStatus('thinking');
    setErrorMsg('');

    try {
      const response = await fetch('/api/ai-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, boardId, boardState: objects }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`);
      }

      const toolCalls: ToolCall[] = data.toolCalls ?? [];

      if (toolCalls.length === 0) {
        setStatus('done');
        setCommand('');
        setTimeout(() => { setStatus('idle'); inputRef.current?.focus(); }, 2200);
        return;
      }

      setStatus('creating');
      await new Promise((r) => setTimeout(r, 120));

      for (const call of toolCalls) {
        try {
          executeToolCall(call);
        } catch (err) {
          console.warn(`Tool "${call.name}" failed:`, err);
        }
      }

      setCommand('');
      setStatus('done');
      setTimeout(() => { setStatus('idle'); inputRef.current?.focus(); }, 2200);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  // ── Derived styles ────────────────────────────────────────────────────────────
  const borderColor = status === 'error'
    ? '#dc3545'
    : focused || loading
    ? '#17a2b8'
    : '#e0e0e0';

  const cfg = STATUS_CONFIG[status];
  const statusText = status === 'error' ? errorMsg : cfg.text;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* ── Input row ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{
          backgroundColor: '#f5f5f5',
          border: `1px solid ${borderColor}`,
          transition: 'border-color 200ms ease',
        }}
      >
        {/* Sparkles / status icon */}
        {loading ? (
          <Loader2
            size={15}
            className="animate-spin"
            style={{ color: '#17a2b8', flexShrink: 0 }}
          />
        ) : (
          <Sparkles
            size={15}
            style={{
              color: status === 'error' ? '#dc3545' : focused ? '#17a2b8' : '#999999',
              flexShrink: 0,
              transition: 'color 200ms ease',
            }}
          />
        )}

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            loading
              ? statusText
              : "Ask AI to create or modify objects… (e.g. 'Add a yellow sticky note that says Hello')"
          }
          disabled={loading}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: '#1a1a1a' }}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={!canSend}
          onMouseEnter={() => setSendHovered(true)}
          onMouseLeave={() => setSendHovered(false)}
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: canSend
              ? sendHovered ? '#138496' : '#17a2b8'
              : '#e0e0e0',
            color: canSend ? '#ffffff' : '#999999',
            cursor: canSend ? 'pointer' : 'default',
            border: 'none',
            transition: 'background-color 200ms ease',
          }}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
        </button>
      </div>

      {/* ── Status line (only when not idle) ── */}
      {status !== 'idle' && (
        <div
          className="flex items-center gap-1.5 px-1"
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: cfg.color,
            minHeight: '16px',
            transition: 'color 200ms ease',
          }}
        >
          {status === 'done' && <Check size={11} />}
          {status === 'error' && <AlertCircle size={11} />}
          <span>{statusText}</span>
        </div>
      )}
    </form>
  );
}
