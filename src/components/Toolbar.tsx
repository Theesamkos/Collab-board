import { useState, useRef, useEffect } from 'react';
import {
  StickyNote, Square, Circle,
  Save, Check, Loader2,
  Pencil, Hand, MousePointer, Trash2,
  Plus, ChevronDown,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import { useBoardStore, ActiveTool } from '../store/boardStore';
import { v4 as uuidv4 } from 'uuid';
import { AICommandInput } from './AICommandInput';

// ── Base button style ────────────────────────────────────────────
const BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  border: '1px solid #e0e0e0',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  padding: '6px 10px',
  backgroundColor: '#f5f5f5',
  color: '#1a1a1a',
};

// ── Zoom controls ─────────────────────────────────────────────────
function ZoomControls() {
  const { zoom, setZoom, setPan } = useBoardStore();
  const pct = Math.round(zoom * 100);

  const step = (dir: 1 | -1) =>
    setZoom(Math.max(0.25, Math.min(4, zoom + dir * 0.25)));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <button
        onClick={() => step(-1)}
        title="Zoom out"
        style={{ ...BASE, padding: '6px 8px' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8e8e8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5'; }}
      >
        <ZoomOut size={13} />
      </button>

      <button
        onClick={() => { setZoom(1); setPan(0, 0); }}
        title="Reset zoom"
        style={{ ...BASE, padding: '6px 10px', minWidth: '52px', fontWeight: 600 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8e8e8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5'; }}
      >
        {pct}%
      </button>

      <button
        onClick={() => step(1)}
        title="Zoom in"
        style={{ ...BASE, padding: '6px 8px' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8e8e8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5'; }}
      >
        <ZoomIn size={13} />
      </button>
    </div>
  );
}

// ── Tool mode button ──────────────────────────────────────────────
function ToolBtn({ tool, icon, label }: { tool: ActiveTool; icon: React.ReactNode; label: string }) {
  const { activeTool, setActiveTool } = useBoardStore();
  const active = activeTool === tool;

  return (
    <button
      onClick={() => setActiveTool(tool)}
      title={label}
      style={{
        ...BASE,
        backgroundColor: active ? '#17a2b8' : '#f5f5f5',
        color: active ? '#ffffff' : '#1a1a1a',
        borderColor: active ? '#17a2b8' : '#e0e0e0',
        boxShadow: active ? '0 1px 4px rgba(23,162,184,0.35)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8e8e8';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5';
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Delete selected button ────────────────────────────────────────
function DeleteBtn() {
  const { deleteSelectedObjects, selectedObjectIds } = useBoardStore();
  const has = selectedObjectIds.length > 0;

  return (
    <button
      onClick={deleteSelectedObjects}
      disabled={!has}
      title="Delete selected (Del)"
      style={{
        ...BASE,
        backgroundColor: has ? '#dc3545' : '#f5f5f5',
        color: has ? '#ffffff' : '#cccccc',
        borderColor: has ? '#dc3545' : '#e0e0e0',
        cursor: has ? 'pointer' : 'default',
        boxShadow: has ? '0 1px 4px rgba(220,53,69,0.3)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (has) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#c82333';
      }}
      onMouseLeave={(e) => {
        if (has) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#dc3545';
      }}
    >
      <Trash2 size={13} />
      <span>Delete</span>
    </button>
  );
}

// ── Add Shape dropdown ────────────────────────────────────────────
function AddShapeBtn() {
  const { addObject } = useBoardStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const shapes = [
    {
      label: 'Sticky Note',
      icon: <StickyNote size={13} />,
      create: () => addObject({
        id: uuidv4(), type: 'sticky-note',
        x: 120 + Math.random() * 80, y: 120 + Math.random() * 60,
        width: 200, height: 150, text: '', color: '#fffacd',
      }),
    },
    {
      label: 'Rectangle',
      icon: <Square size={13} />,
      create: () => addObject({
        id: uuidv4(), type: 'rectangle',
        x: 150 + Math.random() * 80, y: 150 + Math.random() * 60,
        width: 200, height: 140, color: '#17a2b8',
      }),
    },
    {
      label: 'Circle',
      icon: <Circle size={13} />,
      create: () => addObject({
        id: uuidv4(), type: 'circle',
        x: 200 + Math.random() * 80, y: 200 + Math.random() * 60,
        width: 120, height: 120, color: '#28a745',
      }),
    },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...BASE,
          backgroundColor: open ? '#17a2b8' : '#f5f5f5',
          color: open ? '#ffffff' : '#1a1a1a',
          borderColor: open ? '#17a2b8' : '#e0e0e0',
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8e8e8';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5';
        }}
      >
        <Plus size={13} />
        Add Shape
        <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 200,
            minWidth: '150px',
          }}
        >
          {shapes.map((s) => (
            <button
              key={s.label}
              onClick={() => { s.create(); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#1a1a1a',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Save button ───────────────────────────────────────────────────
function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleClick = async () => {
    if (syncing) return;
    setSyncing(true);
    await onSave();
    setSyncing(false);
    setSynced(true);
    setTimeout(() => setSynced(false), 2200);
  };

  return (
    <button
      onClick={handleClick}
      disabled={syncing}
      style={{
        ...BASE,
        backgroundColor: synced ? '#28a745' : '#17a2b8',
        color: '#ffffff',
        borderColor: synced ? '#28a745' : '#17a2b8',
        opacity: syncing ? 0.7 : 1,
        cursor: syncing ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!syncing && !synced) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#138496';
      }}
      onMouseLeave={(e) => {
        if (!syncing && !synced) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#17a2b8';
      }}
    >
      {syncing ? <Loader2 size={13} className="animate-spin" /> : synced ? <Check size={13} /> : <Save size={13} />}
      {syncing ? 'Saving…' : synced ? 'Saved!' : 'Save'}
    </button>
  );
}

// ── Divider ───────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ width: 1, height: 22, backgroundColor: '#e0e0e0', margin: '0 2px', flexShrink: 0 }} />
);

// ── Toolbar ───────────────────────────────────────────────────────
export function Toolbar() {
  const { syncToDatabase } = useBoardStore();

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
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        padding: '8px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}
    >
      {/* ── Tool row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <ZoomControls />
        <Divider />
        <ToolBtn tool="draw"   icon={<Pencil size={13} />}        label="Draw" />
        <ToolBtn tool="rect"   icon={<Square size={13} />}        label="Rectangle" />
        <ToolBtn tool="pan"    icon={<Hand size={13} />}           label="Pan" />
        <ToolBtn tool="select" icon={<MousePointer size={13} />}  label="Select" />
        <Divider />
        <AddShapeBtn />
        <Divider />
        <DeleteBtn />
        <div style={{ flex: 1 }} />
        <SaveButton onSave={syncToDatabase} />
      </div>

      {/* ── AI command input row ── */}
      <AICommandInput />
    </div>
  );
}
