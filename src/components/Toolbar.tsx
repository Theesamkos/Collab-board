import { useState } from 'react';
import { StickyNote, Square, Circle, Save, Check, Loader2 } from 'lucide-react';
import { useBoardStore } from '../store/boardStore';
import { v4 as uuidv4 } from 'uuid';
import { AICommandInput } from './AICommandInput';

// ── Shared button style helpers ───────────────────────────────
const BASE_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '7px 11px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  backgroundColor: '#f5f5f5',
  color: '#1a1a1a',
  border: '1px solid #e0e0e0',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

function ToolButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...BASE_BTN,
        backgroundColor: hovered ? '#e8e8e8' : '#f5f5f5',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleClick = async () => {
    if (syncing) return;
    setSyncing(true);
    await onSave();
    setSyncing(false);
    setSynced(true);
    setTimeout(() => setSynced(false), 2200);
  };

  const isSuccess = synced;

  return (
    <button
      onClick={handleClick}
      disabled={syncing}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...BASE_BTN,
        backgroundColor: isSuccess
          ? '#28a745'
          : hovered
          ? '#138496'
          : '#17a2b8',
        color: '#ffffff',
        border: 'none',
        opacity: syncing ? 0.7 : 1,
        cursor: syncing ? 'not-allowed' : 'pointer',
        boxShadow: hovered && !syncing ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {syncing ? (
        <Loader2 size={12} className="animate-spin" />
      ) : synced ? (
        <Check size={12} />
      ) : (
        <Save size={12} />
      )}
      {syncing ? 'Saving…' : synced ? 'Saved!' : 'Save'}
    </button>
  );
}

export function Toolbar() {
  const { addObject, syncToDatabase } = useBoardStore();

  const createStickyNote = () => {
    addObject({
      id: uuidv4(),
      type: 'sticky-note',
      x: 120 + Math.random() * 60,
      y: 120 + Math.random() * 40,
      width: 200,
      height: 150,
      text: '',
      color: '#fffacd',
    });
  };

  const createRectangle = () => {
    addObject({
      id: uuidv4(),
      type: 'rectangle',
      x: 150 + Math.random() * 60,
      y: 150 + Math.random() * 40,
      width: 200,
      height: 140,
      color: '#17a2b8',
    });
  };

  const createCircle = () => {
    addObject({
      id: uuidv4(),
      type: 'circle',
      x: 200 + Math.random() * 60,
      y: 200 + Math.random() * 40,
      width: 120,
      height: 120,
      color: '#28a745',
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e0e0e0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* ── Shape buttons row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <ToolButton
          onClick={createStickyNote}
          icon={<StickyNote size={13} />}
          label="Sticky Note"
        />
        <ToolButton
          onClick={createRectangle}
          icon={<Square size={13} />}
          label="Rectangle"
        />
        <ToolButton
          onClick={createCircle}
          icon={<Circle size={13} />}
          label="Circle"
        />

        {/* Divider */}
        <div style={{ width: 1, height: 20, backgroundColor: '#e0e0e0', margin: '0 2px' }} />

        <SaveButton onSave={syncToDatabase} />
      </div>

      {/* ── AI command input row ── */}
      <AICommandInput />
    </div>
  );
}
