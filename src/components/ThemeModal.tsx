import { useState, useEffect, useCallback } from 'react';
import { X, Palette, Check, Loader2 } from 'lucide-react';
import { useAIAgent } from '../hooks/useAIAgent';

// ── Theme definitions ─────────────────────────────────────────────────────────
interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

interface Theme {
  name: string;
  label: string;
  description: string;
  colors: ThemeColors;
}

const THEMES: Theme[] = [
  {
    name: 'professional',
    label: 'Professional',
    description: 'Clean corporate palette',
    colors: { primary: '#2C3E50', secondary: '#3498DB', accent: '#E74C3C', background: '#ECF0F1' },
  },
  {
    name: 'creative',
    label: 'Creative',
    description: 'Vibrant & energetic',
    colors: { primary: '#9B59B6', secondary: '#F39C12', accent: '#E91E63', background: '#FFF9C4' },
  },
  {
    name: 'dark',
    label: 'Dark',
    description: 'Sleek dark mode',
    colors: { primary: '#1A1A1A', secondary: '#4A4A4A', accent: '#00BCD4', background: '#212121' },
  },
  {
    name: 'pastel',
    label: 'Pastel',
    description: 'Soft & playful',
    colors: { primary: '#FFB3BA', secondary: '#BAFFC9', accent: '#BAE1FF', background: '#FFFFBA' },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface ThemeModalProps {
  onClose: () => void;
}

export function ThemeModal({ onClose }: ThemeModalProps) {
  const { processCommand, phase } = useAIAgent();
  const [applyingTheme, setApplyingTheme] = useState<string | null>(null);
  const [appliedTheme, setAppliedTheme]   = useState<string | null>(null);

  const isProcessing = phase === 'thinking' || phase === 'creating';

  const handleApply = useCallback(async (themeName: string) => {
    if (isProcessing) return;
    setApplyingTheme(themeName);
    setAppliedTheme(null);
    await processCommand(`Apply ${themeName} theme to all objects`);
    setAppliedTheme(themeName);
    setApplyingTheme(null);
    setTimeout(onClose, 800);
  }, [isProcessing, processCommand, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <style>{`
        @keyframes tm-fade-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tm-slide-up { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          animation: 'tm-fade-in 0.15s ease',
        }}
      >
        {/* Panel */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#0d1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: '24px',
            width: 'min(520px, 90vw)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            animation: 'tm-slide-up 0.2s ease',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Palette size={20} style={{ color: '#17c5c8' }} />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>Apply Theme</h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.45)', padding: 4, borderRadius: 6,
                display: 'flex', transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              <X size={18} />
            </button>
          </div>

          {/* 2×2 theme grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {THEMES.map((theme) => {
              const isThis     = applyingTheme === theme.name;
              const wasApplied = appliedTheme  === theme.name;

              return (
                <div
                  key={theme.name}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isThis || wasApplied ? 'rgba(23,197,200,0.45)' : 'rgba(255,255,255,0.09)'}`,
                    borderRadius: 12,
                    padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => { if (!isThis && !wasApplied) e.currentTarget.style.borderColor = 'rgba(23,197,200,0.35)'; }}
                  onMouseLeave={(e) => { if (!isThis && !wasApplied) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                >
                  {/* Name + description */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{theme.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{theme.description}</div>
                  </div>

                  {/* Color swatches */}
                  <div style={{ display: 'flex', gap: 7 }}>
                    {(Object.entries(theme.colors) as [string, string][]).map(([key, color]) => (
                      <div
                        key={key}
                        title={`${key}: ${color}`}
                        style={{
                          width: 30, height: 30, borderRadius: 7,
                          backgroundColor: color,
                          border: '1px solid rgba(255,255,255,0.15)',
                          flexShrink: 0,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Apply button */}
                  <button
                    onClick={() => handleApply(theme.name)}
                    disabled={isProcessing}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', padding: '9px 0',
                      borderRadius: 8, border: 'none',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 500,
                      transition: 'background-color 0.15s, color 0.15s',
                      backgroundColor: wasApplied
                        ? 'rgba(40,167,69,0.2)'
                        : isThis
                        ? 'rgba(23,197,200,0.22)'
                        : 'rgba(23,197,200,0.12)',
                      color: wasApplied ? '#28a745' : '#17c5c8',
                      opacity: isProcessing && !isThis ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.backgroundColor = 'rgba(23,197,200,0.24)'; }}
                    onMouseLeave={(e) => {
                      if (!isProcessing) e.currentTarget.style.backgroundColor = wasApplied
                        ? 'rgba(40,167,69,0.2)'
                        : 'rgba(23,197,200,0.12)';
                    }}
                  >
                    {isThis ? (
                      <><Loader2 size={13} className="animate-spin" /> Applying…</>
                    ) : wasApplied ? (
                      <><Check size={13} /> Applied</>
                    ) : (
                      'Apply'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
