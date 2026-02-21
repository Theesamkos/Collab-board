import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LogOut, Loader2, Clock, X, Link2, Globe, Lock, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface BoardRow {
  id: string;
  title: string;
  created_at: string;
  is_public: boolean;
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
  const [shareMenuBoardId, setShareMenuBoardId] = useState<string | null>(null);
  const [copiedBoardId, setCopiedBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchBoards = async () => {
      const { data, error } = await supabase
        .from('board_members')
        .select('boards(id, title, created_at, is_public)')
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

  // Close share menu when clicking outside
  useEffect(() => {
    if (!shareMenuBoardId) return;
    const handler = () => setShareMenuBoardId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareMenuBoardId]);

  const handleCreate = async (title: string) => {
    setCreating(true);
    const user = session!.user;

    // Safety check: ensure public.users record exists (OAuth users may not have one)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingUser) {
      console.log('User record missing — creating for OAuth user…');
      const { error: userErr } = await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        display_name:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split('@')[0] ??
          'User',
      });
      if (userErr) {
        console.error('Failed to create user record:', userErr);
        setCreating(false);
        return;
      }
    }

    const { data: board, error } = await supabase
      .from('boards')
      .insert({ title, user_id: user.id, objects: [] })
      .select('id')
      .single();

    if (error || !board) {
      console.error('Error creating board:', error);
      setCreating(false);
      return;
    }

    await supabase
      .from('board_members')
      .insert({ board_id: board.id, user_id: user.id });

    navigate(`/board/${board.id}`);
  };

  const handleTogglePublic = async (boardId: string, currentIsPublic: boolean) => {
    const { error } = await supabase
      .from('boards')
      .update({ is_public: !currentIsPublic })
      .eq('id', boardId);

    if (!error) {
      setBoards((prev) =>
        prev.map((b) => b.id === boardId ? { ...b, is_public: !currentIsPublic } : b)
      );
    }
  };

  const handleCopyLink = (boardId: string) => {
    const url = `${window.location.origin}/board/${boardId}`;
    navigator.clipboard.writeText(url);
    setCopiedBoardId(boardId);
    setTimeout(() => setCopiedBoardId(null), 2000);
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
                    {/* Teal gradient strip */}
                    <div style={{
                      height: '3px', borderRadius: '2px', marginBottom: '16px',
                      background: 'linear-gradient(90deg, #17c5c8, rgba(23,197,200,0.2))',
                    }} />

                    <p style={{
                      fontSize: '14px', fontWeight: 700, color: '#ffffff',
                      margin: '0 0 auto',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      paddingRight: '28px', // space for share button
                    }}>
                      {board.title}
                    </p>

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      marginTop: '18px', color: 'rgba(255,255,255,0.3)',
                    }}>
                      <Clock size={11} />
                      <span style={{ fontSize: '11px' }}>{formatDate(board.created_at)}</span>
                      {board.is_public && (
                        <span style={{
                          marginLeft: 'auto',
                          display: 'flex', alignItems: 'center', gap: '3px',
                          fontSize: '10px', color: '#17c5c8', fontWeight: 600,
                        }}>
                          <Globe size={9} />
                          Public
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* ── Share button ── */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShareMenuBoardId(shareMenuBoardId === board.id ? null : board.id);
                  }}
                  title="Share board"
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

                {/* ── Share dropdown menu ── */}
                {shareMenuBoardId === board.id && (
                  <>
                    {/* Invisible overlay to capture outside clicks */}
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                      onMouseDown={(e) => { e.stopPropagation(); setShareMenuBoardId(null); }}
                    />
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: '44px', right: '8px',
                        width: '200px', zIndex: 99,
                        backgroundColor: 'rgba(10,20,38,0.97)',
                        border: '1px solid rgba(23,197,200,0.22)',
                        borderRadius: '12px', padding: '8px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                      }}
                    >
                      {/* Copy link */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyLink(board.id); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '9px 10px', borderRadius: '8px', border: 'none',
                          backgroundColor: 'transparent', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 600,
                          color: copiedBoardId === board.id ? '#28a745' : 'rgba(255,255,255,0.85)',
                          transition: 'all 150ms ease',
                        }}
                        onMouseEnter={(e) => {
                          if (copiedBoardId !== board.id)
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        {copiedBoardId === board.id
                          ? <Check size={13} style={{ color: '#28a745' }} />
                          : <Link2 size={13} />
                        }
                        {copiedBoardId === board.id ? 'Link copied!' : 'Copy link'}
                      </button>

                      {/* Divider */}
                      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />

                      {/* Toggle public */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTogglePublic(board.id, board.is_public); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '9px 10px', borderRadius: '8px', border: 'none',
                          backgroundColor: 'transparent', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 600,
                          color: board.is_public ? '#ff6b6b' : 'rgba(255,255,255,0.85)',
                          transition: 'all 150ms ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        {board.is_public
                          ? <Lock size={13} style={{ color: '#ff6b6b' }} />
                          : <Globe size={13} />
                        }
                        {board.is_public ? 'Make private' : 'Make public'}
                      </button>

                      {board.is_public && (
                        <p style={{
                          fontSize: '10px', color: 'rgba(255,255,255,0.35)',
                          margin: '6px 10px 2px', lineHeight: '1.4',
                        }}>
                          Anyone with the link can view and edit
                        </p>
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
