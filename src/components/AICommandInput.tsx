import { useRef, useState } from 'react';
import { Sparkles, ArrowUp, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAIAgent, AIPhase } from '../hooks/useAIAgent';

// ── Status display config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AIPhase, { color: string; text: string }> = {
  idle:     { color: '#999999', text: '' },
  thinking: { color: '#17c5c8', text: 'Thinking…' },
  creating: { color: '#6c757d', text: 'Creating…' },
  done:     { color: '#28a745', text: 'Done!' },
  error:    { color: '#ff6b6b', text: '' },
};

export function AICommandInput() {
  const [command, setCommand]         = useState('');
  const [focused, setFocused]         = useState(false);
  const [sendHovered, setSendHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { processCommand, phase, errorMessage } = useAIAgent();

  const loading    = phase === 'thinking' || phase === 'creating';
  const canSend    = !!command.trim() && !loading;
  const cfg        = STATUS_CONFIG[phase];
  const statusText = phase === 'error' ? errorMessage : cfg.text;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const cmd = command.trim();
    setCommand('');

    await processCommand(cmd);
    // phase auto-resets to 'idle' inside the hook after 2.2 s / 4 s
    inputRef.current?.focus();
  };

  // ── Derived styles ────────────────────────────────────────────────────────────
  const borderColor =
    phase === 'error'
      ? '#ff6b6b'
      : focused || loading
      ? '#17c5c8'
      : 'rgba(255,255,255,0.15)';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* ── Input row ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{
          backgroundColor: 'rgba(13,26,46,0.92)',
          border: `1px solid ${borderColor}`,
          transition: 'border-color 200ms ease',
        }}
      >
        {/* Sparkles / loader icon */}
        {loading ? (
          <Loader2
            size={15}
            className="animate-spin"
            style={{ color: '#17c5c8', flexShrink: 0 }}
          />
        ) : (
          <Sparkles
            size={15}
            style={{
              color: phase === 'error' ? '#ff6b6b' : focused ? '#17c5c8' : 'rgba(255,255,255,0.4)',
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
          style={{ color: 'rgba(255,255,255,0.85)', caretColor: '#17c5c8' }}
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
              ? sendHovered ? '#138496' : '#17c5c8'
              : 'rgba(255,255,255,0.08)',
            color:  canSend ? '#000000' : 'rgba(255,255,255,0.3)',
            cursor: canSend ? 'pointer' : 'default',
            border: 'none',
            transition: 'background-color 200ms ease',
          }}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
        </button>
      </div>

      {/* ── Status line (hidden when idle) ── */}
      {phase !== 'idle' && (
        <div
          className="flex items-center gap-1.5 px-1"
          style={{
            fontSize: '11px', fontWeight: 500,
            color: cfg.color,
            minHeight: '16px',
            transition: 'color 200ms ease',
          }}
        >
          {phase === 'done'  && <Check       size={11} />}
          {phase === 'error' && <AlertCircle size={11} />}
          <span>{statusText}</span>
        </div>
      )}
    </form>
  );
}
