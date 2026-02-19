import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LogOut, Loader2, Clock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface BoardRow {
  id: string;
  title: string;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Create Board Modal ────────────────────────────────────────
function CreateBoardModal({
  onClose,
  onCreate,
  creating,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
  creating: boolean;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(name.trim() || 'Untitled Board');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-in"
        style={{
          width: '100%', maxWidth: '420px',
          backgroundColor: 'rgba(10,20,38,0.97)',
          border: '1px solid rgba(23,197,200,0.28)',
          borderRadius: '16px',
          padding: '28px 24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            New Board
          </h2>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
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
                background: creating
                  ? 'rgba(23,197,200,0.4)'
                  : 'linear-gradient(135deg, #17c5c8 0%, #0fa3b1 100%)',
                color: '#000', border: 'none',
                cursor: creating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                boxShadow: creating ? 'none' : '0 4px 16px rgba(23,197,200,0.35)',
                transition: 'all 200ms ease',
              }}
            >
              {creating && <Loader2 size={13} className="animate-spin" />}
              {creating ? 'Creating…' : 'Create Board'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '11px 18px', borderRadius: '8px',
                fontSize: '14px', fontWeight: 600,
                color: 'rgba(255,255,255,0.65)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer', transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'rgba(255,255,255,0.11)';
                b.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'rgba(255,255,255,0.06)';
                b.style.color = 'rgba(255,255,255,0.65)';
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Dashboard page ────────────────────────────────────────────
export function Dashboard() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchBoards = async () => {
      const { data, error } = await supabase
        .from('board_members')
        .select('boards(id, title, created_at)')
        .eq('user_id', session.user.id);

      if (error) { console.error('Error fetching boards:', error); setLoading(false); return; }

      const rows: BoardRow[] = (data ?? [])
        .map((row: any) => row.boards)
        .filter(Boolean)
        .sort((a: BoardRow, b: BoardRow) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setBoards(rows);
      setLoading(false);
    };

    fetchBoards();
  }, [session]);

  const handleCreate = async (title: string) => {
    setCreating(true);

    const { data: board, error } = await supabase
      .from('boards')
      .insert({ title, user_id: session!.user.id, objects: [] })
      .select('id')
      .single();

    if (error || !board) {
      console.error('Error creating board:', error);
      setCreating(false);
      return;
    }

    await supabase
      .from('board_members')
      .insert({ board_id: board.id, user_id: session!.user.id });

    navigate(`/board/${board.id}`);
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow accents */}
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
        backgroundColor: 'rgba(7,13,26,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(23,197,200,0.15)',
        height: '56px',
        display: 'flex', alignItems: 'center',
        padding: '0 28px', gap: '14px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <img
            src="/logo.svg"
            alt="CollabBoard"
            style={{ width: 28, height: 28, filter: 'drop-shadow(0 0 8px rgba(23,197,200,0.55))' }}
          />
          <span style={{
            fontSize: '15px', fontWeight: 800, color: '#ffffff',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textShadow: '0 0 12px rgba(23,197,200,0.35)',
          }}>
            CollabBoard
          </span>
        </div>

        {/* User email */}
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
          {session?.user?.email}
        </span>

        {/* Logout */}
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
            fontWeight: 600, color: 'rgba(255,255,255,0.55)',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', flexShrink: 0, transition: 'all 200ms ease',
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
          <LogOut size={12} />
          Logout
        </button>
      </header>

      {/* ── Main content ── */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '44px 28px' }}>
        {/* Page heading */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              My Boards
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: '5px 0 0' }}>
              {loading ? '\u00a0' : `${boards.length} board${boards.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
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
            <Plus size={15} />
            New Board
          </button>
        </div>

        {/* Loading state */}
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '80px',
          }}>
            <Loader2 size={20} className="animate-spin" style={{ color: '#17c5c8' }} />
            <span style={{ fontSize: '14px' }}>Loading boards…</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '18px',
          }}>
            {/* ── Create New Board card ── */}
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
                minHeight: '168px',
                backgroundColor: 'rgba(13,26,46,0.45)',
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
                b.style.backgroundColor = 'rgba(13,26,46,0.45)';
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

            {/* ── Board cards ── */}
            {boards.map((board) => (
              <Link key={board.id} to={`/board/${board.id}`} style={{ textDecoration: 'none' }}>
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
                  {/* Teal gradient strip */}
                  <div style={{
                    height: '3px', borderRadius: '2px', marginBottom: '16px',
                    background: 'linear-gradient(90deg, #17c5c8, rgba(23,197,200,0.2))',
                  }} />

                  <p style={{
                    fontSize: '14px', fontWeight: 700, color: '#ffffff',
                    margin: '0 0 auto',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {board.title}
                  </p>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    marginTop: '18px', color: 'rgba(255,255,255,0.3)',
                  }}>
                    <Clock size={11} />
                    <span style={{ fontSize: '11px' }}>{formatDate(board.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && boards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.35)' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: 'rgba(23,197,200,0.08)',
              border: '1px solid rgba(23,197,200,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Plus size={28} style={{ color: 'rgba(23,197,200,0.5)' }} />
            </div>
            <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px', color: 'rgba(255,255,255,0.5)' }}>
              No boards yet
            </p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Click{' '}
              <strong style={{ color: '#17c5c8' }}>New Board</strong>
              {' '}to create your first whiteboard.
            </p>
          </div>
        )}
      </main>

      {/* ── Modal ── */}
      {showModal && (
        <CreateBoardModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}
    </div>
  );
}
