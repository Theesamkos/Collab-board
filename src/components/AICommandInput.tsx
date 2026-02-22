import { useRef, useState, useEffect, useCallback } from 'react';
import { Sparkles, ArrowUp, Loader2, Check, AlertCircle, Mic, MicOff } from 'lucide-react';
import { useAIAgent, AIPhase } from '../hooks/useAIAgent';

// ── Web Speech API type shim ──────────────────────────────────────────────────
interface SpeechRecognitionResult {
  readonly 0: { readonly transcript: string };
}
interface SpeechRecognitionResultList {
  readonly 0: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent {
  readonly error: string;
}
interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart:  (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend:    (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

type VoicePhase = 'idle' | 'listening' | 'processing';

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
  const [voicePhase, setVoicePhase]   = useState<VoicePhase>('idle');
  const [voiceError, setVoiceError]   = useState('');

  const inputRef       = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  // Ref mirrors voicePhase so event callbacks always see the latest value
  const voicePhaseRef  = useRef<VoicePhase>('idle');

  const { processCommand, phase, errorMessage } = useAIAgent();

  const loading    = phase === 'thinking' || phase === 'creating';
  const canSend    = !!command.trim() && !loading;
  const cfg        = STATUS_CONFIG[phase];
  const statusText = phase === 'error' ? errorMessage : cfg.text;

  const speechSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── Helper: set both state and ref together ───────────────────────────────
  const setVP = useCallback((vp: VoicePhase) => {
    voicePhaseRef.current = vp;
    setVoicePhase(vp);
  }, []);

  // ── Start listening ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!speechSupported || voicePhaseRef.current !== 'idle' || loading) return;

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.continuous     = false;
    recognition.interimResults = false;
    recognition.lang           = 'en-US';

    recognition.onstart = () => {
      setVP('listening');
      setVoiceError('');
    };

    recognition.onresult = (event) => {
      setVP('processing');
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setCommand(transcript);
        setTimeout(() => {
          setVP('idle');
          inputRef.current?.focus();
        }, 700);
      } else {
        setVP('idle');
      }
    };

    recognition.onerror = (event) => {
      const msg =
        event.error === 'not-allowed' ? 'Microphone access denied' :
        event.error === 'no-speech'   ? 'No speech detected — try again' :
                                        'Voice input failed';
      setVoiceError(msg);
      setVP('idle');
      setTimeout(() => setVoiceError(''), 3000);
    };

    recognition.onend = () => {
      // Only reset if we never got a result (still in listening)
      if (voicePhaseRef.current === 'listening') setVP('idle');
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setVP('idle');
    }
  }, [speechSupported, loading, setVP]);

  // ── Stop listening ────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setVP('idle');
  }, [setVP]);

  const toggleVoice = useCallback(() => {
    if (voicePhaseRef.current === 'listening') stopListening();
    else startListening();
  }, [startListening, stopListening]);

  // ── 'V' keyboard shortcut (when not typing in an input) ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'v' && e.key !== 'V') return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      toggleVoice();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleVoice]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const cmd = command.trim();
    setCommand('');
    processCommand(cmd);
    inputRef.current?.focus();
  };

  // ── Derived styles ────────────────────────────────────────────────────────
  const borderColor =
    phase === 'error'        ? '#ff6b6b' :
    focused || loading       ? '#17c5c8' :
    voicePhase === 'listening' ? '#ff6b6b' :
                               'rgba(255,255,255,0.15)';

  const micColor =
    voicePhase === 'listening'  ? '#ff6b6b' :
    voicePhase === 'processing' ? '#f5a623' :
                                  'rgba(255,255,255,0.35)';

  const inputPlaceholder =
    loading                       ? statusText :
    voicePhase === 'listening'    ? 'Listening…' :
    voicePhase === 'processing'   ? 'Got it!' :
    "Ask AI or click 🎤 to speak (press V)";

  // Which status line to show
  const showStatus = phase !== 'idle' || !!voiceError || voicePhase !== 'idle';
  const statusColor =
    voiceError                    ? '#ff6b6b' :
    voicePhase === 'listening'    ? '#ff6b6b' :
    voicePhase === 'processing'   ? '#f5a623' :
                                    cfg.color;
  const statusLabel =
    voiceError                    ? voiceError :
    voicePhase === 'listening'    ? 'Listening…' :
    voicePhase === 'processing'   ? 'Got it!' :
                                    statusText;

  return (
    <>
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,107,0.5); }
          50%       { box-shadow: 0 0 0 5px rgba(255,107,107,0); }
        }
      `}</style>

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
            <Loader2 size={15} className="animate-spin" style={{ color: '#17c5c8', flexShrink: 0 }} />
          ) : (
            <Sparkles
              size={15}
              style={{
                color: phase === 'error' ? '#ff6b6b' : focused ? '#17c5c8' : 'rgba(255,255,255,0.4)',
                flexShrink: 0, transition: 'color 200ms ease',
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
            placeholder={inputPlaceholder}
            disabled={loading}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'rgba(255,255,255,0.85)', caretColor: '#17c5c8' }}
          />

          {/* Mic button — hidden when browser doesn't support speech */}
          {speechSupported && (
            <button
              type="button"
              title={
                voicePhase === 'listening'
                  ? 'Stop listening'
                  : 'Click to speak (or press V)'
              }
              onClick={toggleVoice}
              disabled={loading}
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor:
                  voicePhase === 'listening'  ? 'rgba(255,107,107,0.18)' :
                  voicePhase === 'processing' ? 'rgba(245,166,35,0.18)'  :
                                               'transparent',
                border: voicePhase === 'listening' ? '1px solid rgba(255,107,107,0.4)' : '1px solid transparent',
                cursor: loading ? 'default' : 'pointer',
                transition: 'background-color 200ms ease, border-color 200ms ease',
                animation: voicePhase === 'listening' ? 'mic-pulse 1.4s ease-in-out infinite' : 'none',
                borderRadius: 6,
              }}
            >
              {voicePhase === 'listening' ? (
                <MicOff size={13} style={{ color: micColor }} />
              ) : (
                <Mic size={13} style={{ color: micColor, transition: 'color 200ms ease' }} />
              )}
            </button>
          )}

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

        {/* ── Status line ── */}
        {showStatus && (
          <div
            className="flex items-center gap-1.5 px-1"
            style={{
              fontSize: '11px', fontWeight: 500,
              color: statusColor,
              minHeight: '16px',
              transition: 'color 200ms ease',
            }}
          >
            {phase === 'done'  && voicePhase === 'idle' && <Check       size={11} />}
            {phase === 'error' && voicePhase === 'idle' && <AlertCircle size={11} />}
            <span>{statusLabel}</span>
          </div>
        )}
      </form>
    </>
  );
}
