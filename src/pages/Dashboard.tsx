import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, LogOut, Loader2, Clock, X, Link2, Globe, Lock, Check,
  Trash2, Users, Crown, Hash,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface BoardRow {
  id: string;
  title: string;
  created_at: string;
  is_public: boolean;
  share_code: string | null;
  isOwner: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Shared modal shell ─────────────────────────────────────────
function ModalShell({ onClose, children, maxWidth = '420px' }: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-in"
        style={{
          width: '100%', maxWidth,
          backgroundColor: 'rgba(10,20,38,0.97)',
          border: '1px solid rgba(23,197,200,0.28)',
          borderRadius: '16px',
          padding: '28px 24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Modal header row ──────────────────────────────────────────
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>{title}</h2>
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.35)', padding: '4px', borderRadius: '6px',
          display: 'flex', alignItems: 'center', transition: 'color 150ms ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'; }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ── Create Board Modal ────────────────────────────────────────
function CreateBoardModal({ onClose, onCreate, creating }: {
  onClose: () => void;
  onCreate: (name: string) => void;
  creating: boolean;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title="New Board" onClose={onClose} />
      <form
        onSubmit={(e) => { e.preventDefault(); onCreate(name.trim() || 'Untitled Board'); }}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Board name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          style={{
            width: '100%', padding: '12px 14px',
            borderRadius: '8px', border: '1px solid rgba(23,197,200,0.25)',
            backgroundColor: 'rgba(255,255,255,0.07)',
            color: '#ffffff', fontSize: '14px', outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#17c5c8';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(23,197,200,0.15)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(23,197,200,0.25)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={creating}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 700,
              background: creating ? 'rgba(23,197,200,0.4)' : 'linear-gradient(135deg, #17c5c8 0%, #0fa3b1 100%)',
              color: '#000', border: 'none',
              cursor: creating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: creating ? 'none' : '0 4px 16px rgba(23,197,200,0.35)',
            }}
          >
            {creating && <Loader2 size={13} className="animate-spin" />}
            {creating ? 'Creating…' : 'Create Board'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '11px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              color: 'rgba(255,255,255,0.65)', backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.backgroundColor = 'rgba(255,255,255,0.11)'; b.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.backgroundColor = 'rgba(255,255,255,0.06)'; b.style.color = 'rgba(255,255,255,0.65)';
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Share Code Modal (shown after board creation) ─────────────
function ShareCodeModal({ code, title, boardId, onClose }: {
  code: string;
  title: string;
  boardId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalShell onClose={onClose} maxWidth="440px">
      <ModalHeader title="Board Created!" onClose={onClose} />

      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 20px' }}>
        Share this 6-character code so others can join <strong style={{ color: '#ffffff' }}>{title}</strong>.
      </p>

      {/* Big code display */}
      <div
        onClick={handleCopy}
        title="Click to copy"
        style={{
          background: 'rgba(23,197,200,0.08)',
          border: '2px solid rgba(23,197,200,0.35)',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'monospace',
          fontSize: '40px',
          fontWeight: 800,
          letterSpacing: '10px',
          color: '#17c5c8',
          cursor: 'pointer',
          userSelect: 'all',
          marginBottom: '12px',
          transition: 'border-color 150ms ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(23,197,200,0.7)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(23,197,200,0.35)'; }}
      >
        {code}
      </div>

      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '0 0 20px' }}>
        Click the code to copy it
      </p>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, padding: '11px', borderRadius: '8px',
            fontSize: '13px', fontWeight: 700,
            background: copied ? 'rgba(40,167,69,0.2)' : 'rgba(23,197,200,0.15)',
            color: copied ? '#28a745' : '#17c5c8',
            border: copied ? '1px solid rgba(40,167,69,0.4)' : '1px solid rgba(23,197,200,0.35)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          {copied ? <Check size={13} /> : <Hash size={13} />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
        <button
          onClick={() => navigate(`/board/${boardId}`)}
          style={{
            flex: 1, padding: '11px', borderRadius: '8px',
            fontSize: '13px', fontWeight: 700,
            background: 'linear-gradient(135deg, #17c5c8 0%, #0fa3b1 100%)',
            color: '#000', border: 'none', cursor: 'pointer',
          }}
        >
          Open Board
        </button>
      </div>
    </ModalShell>
  );
}

// ── Join Board Modal ──────────────────────────────────────────
function JoinBoardModal({ onClose, onJoin, joining }: {
  onClose: () => void;
  onJoin: (code: string) => void;
  joining: boolean;
}) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title="Join a Board" onClose={onClose} />
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
        Enter the 6-character code shared by the board owner.
      </p>

      <input
        ref={inputRef}
        type="text"
        placeholder="ABC123"
        value={code}
        maxLength={6}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && code.length === 6) onJoin(code);
        }}
        style={{
          width: '100%', padding: '16px',
          borderRadius: '10px', border: '2px solid rgba(23,197,200,0.25)',
          backgroundColor: 'rgba(255,255,255,0.07)',
          color: '#17c5c8', fontSize: '32px', fontWeight: 800,
          letterSpacing: '10px', textAlign: 'center', outline: 'none',
          fontFamily: 'monospace', marginBottom: '16px',
          transition: 'border-color 200ms ease',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#17c5c8'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(23,197,200,0.25)'; }}
      />

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onClose}
          style={{
            padding: '11px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
            color: 'rgba(255,255,255,0.65)', backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onJoin(code)}
          disabled={joining || code.length !== 6}
          style={{
            flex: 1, padding: '11px', borderRadius: '8px',
            fontSize: '14px', fontWeight: 700,
            background: (joining || code.length !== 6)
              ? 'rgba(23,197,200,0.3)'
              : 'linear-gradient(135deg, #17c5c8 0%, #0fa3b1 100%)',
            color: (joining || code.length !== 6) ? 'rgba(255,255,255,0.4)' : '#000',
            border: 'none',
            cursor: (joining || code.length !== 6) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          {joining && <Loader2 size={13} className="animate-spin" />}
          {joining ? 'Joining…' : 'Join Board'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Dashboard page ────────────────────────────────────────────
export function Dashboard() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [boards, setBoards]               = useState<BoardRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [creating, setCreating]           = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [shareCodeModal, setShareCodeModal]   = useState<{ code: string; title: string; boardId: string } | null>(null);
  const [showJoinModal, setShowJoinModal]     = useState(false);
  const [joiningBoard, setJoiningBoard]       = useState(false);
  const [shareMenuBoardId, setShareMenuBoardId] = useState<string | null>(null);
  const [copiedBoardId, setCopiedBoardId]       = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId]         = useState<string | null>(null);

  // ── Fetch boards ─────────────────────────────────────────────
  const fetchBoards = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from('board_members')
      .select('role, boards(id, title, created_at, is_public, share_code)')
      .eq('user_id', session.user.id);

    if (error) { console.error('Error fetching boards:', error); setLoading(false); return; }

    const rows: BoardRow[] = (data ?? [])
      .map((row: any) => ({ ...row.boards, isOwner: row.role === 'owner' }))
      .filter((b: any) => b?.id)
      .sort((a: BoardRow, b: BoardRow) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    setBoards(rows);
    setLoading(false);
  }, [session]);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  // Close share menu on outside click
  useEffect(() => {
    if (!shareMenuBoardId) return;
    const h = () => setShareMenuBoardId(null);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [shareMenuBoardId]);

  // ── Create board ─────────────────────────────────────────────
  const handleCreate = async (title: string) => {
    setCreating(true);
    const user = session!.user;

    // Ensure public.users record exists (OAuth safety)
    const { data: existingUser } = await supabase
      .from('users').select('id').eq('id', user.id).single();

    if (!existingUser) {
      const { error: userErr } = await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User',
      });
      if (userErr) { console.error('Failed to create user record:', userErr); setCreating(false); return; }
    }

    const shareCode = generateShareCode();

    const { data: board, error } = await supabase
      .from('boards')
      .insert({ title, user_id: user.id, objects: [], share_code: shareCode })
      .select('id')
      .single();

    if (error || !board) { console.error('Error creating board:', error); setCreating(false); return; }

    await supabase
      .from('board_members')
      .insert({ board_id: board.id, user_id: user.id, role: 'owner' });

    setShowCreateModal(false);
    setShareCodeModal({ code: shareCode, title, boardId: board.id });
    await fetchBoards();
    setCreating(false);
  };

  // ── Join board ───────────────────────────────────────────────
  const handleJoinBoard = async (code: string) => {
    setJoiningBoard(true);
    const user = session!.user;

    const { data: board, error: boardErr } = await supabase
      .from('boards')
      .select('id, title')
      .eq('share_code', code)
      .single();

    if (boardErr || !board) {
      alert('Invalid code — no board found. Double-check and try again.');
      setJoiningBoard(false);
      return;
    }

    // Already a member?
    const { data: existing } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', board.id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      alert(`You're already a member of "${board.title}".`);
      setShowJoinModal(false);
      setJoiningBoard(false);
      navigate(`/board/${board.id}`);
      return;
    }

    const { error: memberErr } = await supabase
      .from('board_members')
      .insert({ board_id: board.id, user_id: user.id, role: 'member' });

    if (memberErr) {
      console.error('Error joining board:', memberErr);
      alert('Failed to join board. Please try again.');
      setJoiningBoard(false);
      return;
    }

    setShowJoinModal(false);
    setJoiningBoard(false);
    await fetchBoards();
    navigate(`/board/${board.id}`);
  };

  // ── Toggle public ─────────────────────────────────────────────
  const handleTogglePublic = async (boardId: string, currentIsPublic: boolean) => {
    const { error } = await supabase
      .from('boards').update({ is_public: !currentIsPublic }).eq('id', boardId);
    if (!error) {
      setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, is_public: !currentIsPublic } : b));
    }
  };

  // ── Copy link ─────────────────────────────────────────────────
  const handleCopyLink = (boardId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}`);
    setCopiedBoardId(boardId);
    setTimeout(() => setCopiedBoardId(null), 2000);
  };

  // ── Copy code ─────────────────────────────────────────────────
  const handleCopyCode = (boardId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(boardId);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // ── Delete board ──────────────────────────────────────────────
  const handleDeleteBoard = async (boardId: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?\n\nThis removes it for all members and cannot be undone.`)) return;
    const { error } = await supabase.from('boards').delete().eq('id', boardId);
    if (error) { alert('Failed to delete. Only the board owner can delete it.'); return; }
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    setShareMenuBoardId(null);
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glows */}
      <div style={{
        position: 'fixed', top: '-120px', left: '50%', transform: 'translateX(-50%)',
        width: '700px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(23,197,200,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '-100px', right: '-100px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(23,162,184,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Header ── */}
      <header style={{
        position: 'relative', zIndex: 10,
        backgroundColor: 'rgba(7,13,26,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(23,197,200,0.15)',
        height: '56px', display: 'flex', alignItems: 'center',
        padding: '0 28px', gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <img src="/logo.svg" alt="CollabBoard"
            style={{ width: 28, height: 28, filter: 'drop-shadow(0 0 8px rgba(23,197,200,0.55))' }} />
          <span style={{
            fontSize: '15px', fontWeight: 800, color: '#ffffff',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textShadow: '0 0 12px rgba(23,197,200,0.35)',
          }}>CollabBoard</span>
        </div>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
          {session?.user?.email}
        </span>
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
            color: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = 'rgba(229,62,62,0.12)';
            b.style.borderColor = 'rgba(229,62,62,0.35)';
            b.style.color = '#ff6b6b';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = 'rgba(255,255,255,0.06)';
            b.style.borderColor = 'rgba(255,255,255,0.1)';
            b.style.color = 'rgba(255,255,255,0.55)';
          }}
        >
          <LogOut size={12} /> Logout
        </button>
      </header>

      {/* ── Main ── */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '44px 28px' }}>
        {/* Heading row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              My Boards
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: '5px 0 0' }}>
              {loading ? '\u00a0' : `${boards.length} board${boards.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Join Board */}
            <button
              onClick={() => setShowJoinModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                color: '#17c5c8', backgroundColor: 'rgba(23,197,200,0.1)',
                border: '1px solid rgba(23,197,200,0.35)', cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'rgba(23,197,200,0.18)';
                b.style.borderColor = 'rgba(23,197,200,0.6)';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'rgba(23,197,200,0.1)';
                b.style.borderColor = 'rgba(23,197,200,0.35)';
              }}
            >
              <Users size={14} /> Join Board
            </button>

            {/* New Board */}
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                background: 'linear-gradient(135deg, #17c5c8 0%, #0fa3b1 100%)',
                color: '#000', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(23,197,200,0.35)',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.boxShadow = '0 6px 24px rgba(23,197,200,0.55)';
                b.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.boxShadow = '0 4px 16px rgba(23,197,200,0.35)';
                b.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={15} /> New Board
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '80px', color: 'rgba(255,255,255,0.45)' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: '#17c5c8' }} />
            <span style={{ fontSize: '14px' }}>Loading boards…</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px' }}>
            {/* Create card */}
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
                minHeight: '168px',
                border: '2px dashed rgba(23,197,200,0.28)',
                borderRadius: '14px', cursor: 'pointer',
                transition: 'all 200ms ease', padding: '24px',
                background: 'none',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = 'rgba(23,197,200,0.65)';
                b.style.backgroundColor = 'rgba(23,197,200,0.06)';
                b.style.boxShadow = '0 0 20px rgba(23,197,200,0.12)';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = 'rgba(23,197,200,0.28)';
                b.style.backgroundColor = 'transparent';
                b.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                backgroundColor: 'rgba(23,197,200,0.1)',
                border: '1px solid rgba(23,197,200,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={22} style={{ color: '#17c5c8' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                Create New Board
              </span>
            </button>

            {/* Board cards */}
            {boards.map((board) => (
              <div key={board.id} style={{ position: 'relative' }}>
                <Link to={`/board/${board.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    style={{
                      minHeight: '168px',
                      backgroundColor: 'rgba(13,26,46,0.72)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(23,197,200,0.14)',
                      borderRadius: '14px', padding: '20px', cursor: 'pointer',
                      transition: 'all 200ms ease',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => {
                      const d = e.currentTarget as HTMLDivElement;
                      d.style.borderColor = 'rgba(23,197,200,0.55)';
                      d.style.boxShadow = '0 0 20px rgba(23,197,200,0.18), 0 8px 32px rgba(0,0,0,0.4)';
                      d.style.transform = 'translateY(-3px)';
                      d.style.backgroundColor = 'rgba(13,26,46,0.88)';
                    }}
                    onMouseLeave={(e) => {
                      const d = e.currentTarget as HTMLDivElement;
                      d.style.borderColor = 'rgba(23,197,200,0.14)';
                      d.style.boxShadow = 'none';
                      d.style.transform = 'translateY(0)';
                      d.style.backgroundColor = 'rgba(13,26,46,0.72)';
                    }}
                  >
                    <div style={{ height: '3px', borderRadius: '2px', marginBottom: '16px',
                      background: 'linear-gradient(90deg, #17c5c8, rgba(23,197,200,0.2))' }} />

                    <p style={{
                      fontSize: '14px', fontWeight: 700, color: '#ffffff',
                      margin: '0 0 auto',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      paddingRight: '28px',
                    }}>
                      {board.title}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '18px' }}>
                      {/* Owner / Member badge */}
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '3px',
                        fontSize: '10px', fontWeight: 600,
                        color: board.isOwner ? '#f0c040' : 'rgba(23,197,200,0.8)',
                        backgroundColor: board.isOwner ? 'rgba(240,192,64,0.12)' : 'rgba(23,197,200,0.1)',
                        border: `1px solid ${board.isOwner ? 'rgba(240,192,64,0.25)' : 'rgba(23,197,200,0.2)'}`,
                        borderRadius: '5px', padding: '2px 6px',
                      }}>
                        {board.isOwner ? <Crown size={8} /> : <Users size={8} />}
                        {board.isOwner ? 'Owner' : 'Member'}
                      </span>

                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto', color: 'rgba(255,255,255,0.3)' }}>
                        <Clock size={10} />
                        <span style={{ fontSize: '10px' }}>{formatDate(board.created_at)}</span>
                      </span>

                      {board.is_public && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '3px',
                          fontSize: '10px', color: '#17c5c8', fontWeight: 600,
                        }}>
                          <Globe size={9} />
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Share button */}
                <button
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setShareMenuBoardId(shareMenuBoardId === board.id ? null : board.id);
                  }}
                  title="Share / manage board"
                  style={{
                    position: 'absolute', top: '14px', right: '14px',
                    width: '26px', height: '26px', borderRadius: '7px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(23,197,200,0.12)',
                    border: '1px solid rgba(23,197,200,0.22)',
                    color: '#17c5c8', cursor: 'pointer',
                    transition: 'all 150ms ease', zIndex: 2,
                  }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.backgroundColor = 'rgba(23,197,200,0.25)';
                    b.style.borderColor = 'rgba(23,197,200,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.backgroundColor = 'rgba(23,197,200,0.12)';
                    b.style.borderColor = 'rgba(23,197,200,0.22)';
                  }}
                >
                  <Link2 size={12} />
                </button>

                {/* Share dropdown */}
                {shareMenuBoardId === board.id && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                      onMouseDown={(e) => { e.stopPropagation(); setShareMenuBoardId(null); }}
                    />
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: '44px', right: '8px',
                        width: '220px', zIndex: 99,
                        backgroundColor: 'rgba(10,20,38,0.98)',
                        border: '1px solid rgba(23,197,200,0.22)',
                        borderRadius: '12px', padding: '8px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                      }}
                    >
                      {/* Share code (owner only) */}
                      {board.isOwner && board.share_code && (
                        <>
                          <div style={{ padding: '6px 10px 8px' }}>
                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              Invite code
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontFamily: 'monospace', fontSize: '18px', fontWeight: 800,
                                letterSpacing: '4px', color: '#17c5c8', flex: 1,
                              }}>
                                {board.share_code}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopyCode(board.id, board.share_code!); }}
                                style={{
                                  padding: '4px 8px', borderRadius: '6px', border: 'none',
                                  backgroundColor: copiedCodeId === board.id ? 'rgba(40,167,69,0.2)' : 'rgba(23,197,200,0.15)',
                                  color: copiedCodeId === board.id ? '#28a745' : '#17c5c8',
                                  cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                {copiedCodeId === board.id ? <Check size={10} /> : <Hash size={10} />}
                                {copiedCodeId === board.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
                        </>
                      )}

                      {/* Copy link */}
                      <MenuBtn
                        onClick={() => handleCopyLink(board.id)}
                        icon={copiedBoardId === board.id ? <Check size={13} style={{ color: '#28a745' }} /> : <Link2 size={13} />}
                        label={copiedBoardId === board.id ? 'Link copied!' : 'Copy link'}
                        color={copiedBoardId === board.id ? '#28a745' : undefined}
                      />

                      {/* Toggle public (owner only) */}
                      {board.isOwner && (
                        <>
                          <MenuBtn
                            onClick={() => handleTogglePublic(board.id, board.is_public)}
                            icon={board.is_public
                              ? <Lock size={13} style={{ color: '#ff6b6b' }} />
                              : <Globe size={13} />}
                            label={board.is_public ? 'Make private' : 'Make public'}
                            color={board.is_public ? '#ff6b6b' : undefined}
                          />

                          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />

                          {/* Delete (owner only) */}
                          <MenuBtn
                            onClick={() => handleDeleteBoard(board.id, board.title)}
                            icon={<Trash2 size={13} />}
                            label="Delete board"
                            color="#ff6b6b"
                            danger
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && boards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.35)' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: 'rgba(23,197,200,0.08)', border: '1px solid rgba(23,197,200,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <Plus size={28} style={{ color: 'rgba(23,197,200,0.5)' }} />
            </div>
            <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px', color: 'rgba(255,255,255,0.5)' }}>
              No boards yet
            </p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Click <strong style={{ color: '#17c5c8' }}>New Board</strong> to create your first whiteboard,
              or <strong style={{ color: '#17c5c8' }}>Join Board</strong> to join one with a code.
            </p>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {showCreateModal && (
        <CreateBoardModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}

      {shareCodeModal && (
        <ShareCodeModal
          code={shareCodeModal.code}
          title={shareCodeModal.title}
          boardId={shareCodeModal.boardId}
          onClose={() => setShareCodeModal(null)}
        />
      )}

      {showJoinModal && (
        <JoinBoardModal
          onClose={() => setShowJoinModal(false)}
          onJoin={handleJoinBoard}
          joining={joiningBoard}
        />
      )}
    </div>
  );
}

// ── Small helper for dropdown menu buttons ─────────────────────
function MenuBtn({ onClick, icon, label, color, danger }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
        padding: '9px 10px', borderRadius: '8px', border: 'none',
        backgroundColor: 'transparent', cursor: 'pointer',
        fontSize: '12px', fontWeight: 600,
        color: color ?? 'rgba(255,255,255,0.85)',
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          danger ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.07)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
