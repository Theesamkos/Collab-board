import { useState } from 'react';
import {
  StickyNote, Square, Circle,
  Save, Check, Loader2,
  Pencil, Hand, MousePointer, Trash2,
  ZoomIn, ZoomOut, RotateCcw, Share2,
  Undo2, Redo2,
} from 'lucide-react';
import { useBoardStore, ActiveTool } from '../store/boardStore';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { v4 as uuidv4 } from 'uuid';
import { AICommandInput } from './AICommandInput';
import { Dock, DockIcon } from './ui/dock';
import { cn } from '@/lib/utils';

// ── Separator used inside the dock ───────────────────────────────
function DockSep() {
  return (
    <div style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0, alignSelf: 'center' }} />
  );
}

// ── Individual dock icon with active-state support ────────────────
interface ToolDockIconProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  color?: string;
  onClick: () => void;
}

function ToolDockIcon({ icon, label, active, disabled, danger, color, onClick }: ToolDockIconProps) {
  const iconColor = active
    ? '#17c5c8'
    : danger
    ? '#ff6b6b'
    : disabled
    ? 'rgba(255,255,255,0.2)'
    : color || 'rgba(255,255,255,0.75)';

  return (
    <DockIcon
      title={label}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'transition-colors',
        disabled && 'cursor-default opacity-40',
      )}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        borderRadius: 8,
        padding: '3px 4px',
        backgroundColor: active
          ? 'rgba(23,197,200,0.18)'
          : danger && !disabled
          ? 'rgba(255,107,107,0.1)'
          : 'transparent',
      }}>
        <span style={{ color: iconColor, display: 'flex' }}>
          {icon}
        </span>
        <span style={{
          width: 4, height: 4, borderRadius: '50%',
          backgroundColor: active ? '#17c5c8' : 'transparent',
          flexShrink: 0,
        }} />
      </div>
    </DockIcon>
  );
}

// ── Save dock icon ────────────────────────────────────────────────
function SaveDockIcon() {
  const { syncToDatabase } = useBoardStore();
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleSave = async () => {
    if (syncing) return;
    setSyncing(true);
    await syncToDatabase();
    setSyncing(false);
    setSynced(true);
    setTimeout(() => setSynced(false), 2200);
  };

  return (
    <DockIcon
      title={synced ? 'Saved!' : syncing ? 'Saving…' : 'Save'}
      onClick={handleSave}
      className="transition-colors"
    >
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        borderRadius: 8, padding: '3px 4px',
        backgroundColor: synced ? 'rgba(40,167,69,0.18)' : 'rgba(23,197,200,0.12)',
      }}>
        <span style={{ color: synced ? '#28a745' : '#17c5c8', display: 'flex' }}>
          {syncing ? <Loader2 size={17} className="animate-spin" /> : synced ? <Check size={17} /> : <Save size={17} />}
        </span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'transparent' }} />
      </div>
    </DockIcon>
  );
}

// ── Main Toolbar ──────────────────────────────────────────────────
export function Toolbar() {
  const {
    activeTool, setActiveTool,
    addObject,
    zoom, setZoom, setPan,
    selectedObjectIds, deleteSelectedObjects,
  } = useBoardStore();

  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  const pct = Math.round(zoom * 100);
  const has = selectedObjectIds.length > 0;

  const setTool = (t: ActiveTool) => setActiveTool(t);

  const addStickyNote = () => addObject({
    id: uuidv4(), type: 'sticky-note',
    x: 120 + Math.random() * 80, y: 120 + Math.random() * 60,
    width: 200, height: 150, text: '', color: '#fffacd',
  });

  const addRect = () => addObject({
    id: uuidv4(), type: 'rectangle',
    x: 150 + Math.random() * 80, y: 150 + Math.random() * 60,
    width: 200, height: 140, color: '#17a2b8',
  });

  const addCircle = () => addObject({
    id: uuidv4(), type: 'circle',
    x: 200 + Math.random() * 80, y: 200 + Math.random() * 60,
    width: 120, height: 120, color: '#28a745',
  });

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 14px 10px',
        background: 'linear-gradient(to top, rgba(7,13,26,0.97) 70%, transparent)',
        pointerEvents: 'none',
      }}
    >
      {/* ── AI input ── */}
      <div style={{ width: '100%', pointerEvents: 'auto' }}>
        <AICommandInput />
      </div>

      {/* ── Dock ── */}
      <div style={{ pointerEvents: 'auto' }}>
        <Dock
          iconSize={36}
          iconMagnification={54}
          iconDistance={110}
          className="border-white/10 bg-[#0d1a2e]/95 shadow-lg shadow-black/40 !mt-0 !h-auto py-2"
        >
          {/* Zoom */}
          <ToolDockIcon icon={<ZoomOut size={16} />} label="Zoom out"
            onClick={() => setZoom(Math.max(0.25, Math.min(4, zoom - 0.25)))} />

          <DockIcon
            title="Reset zoom (100%)"
            onClick={() => { setZoom(1); setPan(0, 0); }}
            className="hover:bg-white/10 transition-colors"
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>
              {pct}%
            </span>
          </DockIcon>

          <ToolDockIcon icon={<ZoomIn size={16} />} label="Zoom in"
            onClick={() => setZoom(Math.max(0.25, Math.min(4, zoom + 0.25)))} />

          <DockSep />

          {/* Draw tools */}
          <ToolDockIcon icon={<Pencil size={17} />} label="Draw (freehand)"
            active={activeTool === 'draw'} onClick={() => setTool('draw')} />
          <ToolDockIcon icon={<Square size={17} />} label="Rectangle (drag to draw)"
            active={activeTool === 'rect'} onClick={() => setTool('rect')} />
          <ToolDockIcon icon={<Share2 size={17} />} label="Connector (connect objects)"
            active={activeTool === 'connector'} onClick={() => setTool('connector')} />
          <ToolDockIcon icon={<Hand size={17} />} label="Pan"
            active={activeTool === 'pan'} onClick={() => setTool('pan')} />
          <ToolDockIcon icon={<MousePointer size={17} />} label="Select"
            active={activeTool === 'select'} onClick={() => setTool('select')} />

          <DockSep />

          {/* Add shapes */}
          <ToolDockIcon icon={<StickyNote size={17} />} label="Add sticky note"
            color="#f5a623" onClick={addStickyNote} />
          <ToolDockIcon icon={<Square size={17} />} label="Add rectangle"
            color="#17c5c8" onClick={addRect} />
          <ToolDockIcon icon={<Circle size={17} />} label="Add circle"
            color="#28a745" onClick={addCircle} />

          <DockSep />

          {/* Undo / Redo */}
          <ToolDockIcon icon={<Undo2 size={17} />} label="Undo (Cmd+Z)"
            disabled={!canUndo} onClick={undo} />
          <ToolDockIcon icon={<Redo2 size={17} />} label="Redo (Cmd+Shift+Z)"
            disabled={!canRedo} onClick={redo} />

          <DockSep />

          {/* Actions */}
          <ToolDockIcon icon={<Trash2 size={17} />} label="Delete selected"
            danger disabled={!has} onClick={deleteSelectedObjects} />

          <ToolDockIcon icon={<RotateCcw size={17} />} label="Reset view"
            onClick={() => { setZoom(1); setPan(0, 0); }} />

          <SaveDockIcon />
        </Dock>
      </div>
    </div>
  );
}
