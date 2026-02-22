import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ArrowUp, Loader2, Check, AlertCircle, X, FileText, AlertTriangle, Zap } from 'lucide-react';
import { useAIAgent, AIPhase, SummaryData } from '../hooks/useAIAgent';

// ── Summary panel ─────────────────────────────────────────────────────────────
function SummaryPanel({ summary, onClose }: { summary: SummaryData; onClose: () => void }) {
  const Section = ({
    icon,
    label,
    color,
    items,
  }: {
    icon: React.ReactNode;
    label: string;
    color: string;
    items: string[];
  }) => (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, marginTop: '6px', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.82)', lineHeight: '1.5' }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        pointerEvents: 'none',
        padding: '24px',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          width: 340,
          maxHeight: '75vh',
          overflowY: 'auto',
          backgroundColor: '#0d1a2e',
          border: '1px solid rgba(23,197,200,0.25)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(23,197,200,0.1)',
          padding: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: '#17c5c8', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#17c5c8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>
                Board Summary
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', lineHeight: '1.3' }}>
                {summary.title}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', padding: '2px', flexShrink: 0,
              marginLeft: '8px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          {summary.key_points.length > 0 && (
            <Section icon={<FileText size={13} />} label="Key Points" color="#3B82F6" items={summary.key_points} />
          )}
          {summary.risks.length > 0 && (
            <Section icon={<AlertTriangle size={13} />} label="Risks" color="#F97316" items={summary.risks} />
          )}
          {summary.action_items.length > 0 && (
            <Section icon={<Zap size={13} />} label="Action Items" color="#22C55E" items={summary.action_items} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Status display config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AIPhase, { color: string; text: string }> = {
  idle:     { color: '#999999', text: '' },
  thinking: { color: '#17c5c8', text: 'Thinking…' },
  creating: { color: '#17c5c8', text: 'Applying changes…' },
  done:     { color: '#28a745', text: 'Done!' },
  error:    { color: '#ff6b6b', text: '' },
};

export function AICommandInput() {
  const [command, setCommand]         = useState('');
  const [focused, setFocused]         = useState(false);
  const [sendHovered, setSendHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { processCommand, phase, errorMessage, summary, clearSummary } = useAIAgent();

  const loading    = phase === 'thinking' || phase === 'creating';
  const canSend    = !!command.trim() && !loading;
  const cfg        = STATUS_CONFIG[phase];
  const statusText = phase === 'error' ? errorMessage : cfg.text;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const cmd = command.trim();
    setCommand('');
    // Fire-and-forget: processCommand sets phase='thinking' synchronously,
    // so the spinner appears on the very next frame without awaiting.
    processCommand(cmd);
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
    <>
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

    {/* ── Board summary overlay ── */}
    {summary && <SummaryPanel summary={summary} onClose={clearSummary} />}
  </>
  );
}
