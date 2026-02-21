import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Wifi, WifiOff, LogOut, ChevronUp, ChevronDown, ArrowLeft, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBoardStore } from '../store/boardStore';
import { useBoardSync } from '../hooks/useBoardSync';
import { supabase } from '../lib/supabase';
import { Whiteboard } from '../components/Whiteboard';
import { Toolbar } from '../components/Toolbar';
import { CursorTracker } from '../components/CursorTracker';
import { RemoteCursors } from '../components/RemoteCursors';
import { CollabProvider, useCollab } from '../context/CollabContext';

// ── Online presence dropdown ──────────────────────────────────
function OnlineDropdown() {
  const { session } = useAuth();
  const { onlineUsers: users } = useCollab();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = users.length;
  const currentUserId = session?.user?.id;

  function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
          backgroundColor: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.8)',
          cursor: 'pointer', transition: 'all 200ms ease', userSelect: 'none',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'; }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%', backgroundColor: '#28a745',
          flexShrink: 0, animation: 'presence-pulse 2s ease-in-out infinite',
        }} />
        Online
        <span style={{
          backgroundColor: '#17c5c8', color: '#000',
          borderRadius: '10px', fontSize: '10px', fontWeight: 700, padding: '1px 6px',
        }}>
          {count}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '260px',
          backgroundColor: 'rgba(7,13,26,0.98)',
          border: '1px solid rgba(23,197,200,0.2)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 200,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              Active Users
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)',
                cursor: 'pointer', fontSize: '16px', padding: '0 2px', lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* User list */}
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {users.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
                Only you are here
              </div>
            ) : (
              users.map((user, idx) => {
                const isYou = user.userId === currentUserId;
                return (
                  <div
                    key={user.userId}
                    style={{
                      padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      borderBottom: idx < users.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: user.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700, color: '#fff',
                    }}>
                      {initials(user.userName)}
                    </div>

                    {/* Name + status */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px',
                      }}>
                        <span style={{
                          fontSize: '13px', fontWeight: 600, color: '#ffffff',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {user.userName}
                        </span>
                        {isYou && (
                          <span style={{
                            fontSize: '9px', fontWeight: 700, color: '#17c5c8',
                            backgroundColor: 'rgba(23,197,200,0.12)',
                            border: '1px solid rgba(23,197,200,0.3)',
                            borderRadius: '4px', padding: '1px 5px', flexShrink: 0,
                          }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#28a745', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Active now</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Board page ────────────────────────────────────────────────
export function Board() {
  const { boardId: routeBoardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const { boardId, setBoardId, setObjects, isSyncing } = useBoardStore();
  const [loading, setLoading] = useState(true);
  const [boardTitle, setBoardTitle] = useState('');

  const { status: syncStatus } = useBoardSync(boardId);

  useEffect(() => {
    const load = async () => {
      if (!routeBoardId) { navigate('/dashboard'); return; }

      const { data, error } = await supabase
        .from('boards')
        .select('id, title, objects, is_public')
        .eq('id', routeBoardId)
        .single();

      if (error || !data) { navigate('/dashboard'); return; }

      // If board is private and user is not authenticated, redirect to login
      if (!data.is_public && !session?.user?.id) {
        navigate('/login');
        return;
      }

      // Only add to board_members if authenticated
      if (session?.user?.id) {
        await supabase
          .from('board_members')
          .upsert({ board_id: routeBoardId, user_id: session.user.id });
      }

      setBoardId(data.id);
      setBoardTitle(data.title ?? 'Untitled Board');
      setObjects(data.objects ?? []);
      setLoading(false);
    };

    load();
  }, [routeBoardId, session, navigate, setBoardId, setObjects]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        background: 'linear-gradient(160deg, #070d1a 0%, #0d1a2e 50%, #0a1525 100%)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <Loader2 size={28} className="animate-spin" style={{ color: '#17c5c8' }} />
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>Loading board…</p>
        </div>
      </div>
    );
  }

  const isAuthenticated = !!session?.user?.id;

  return (
    <CollabProvider boardId={boardId!}>
      <div className="h-screen flex flex-col" style={{ backgroundColor: '#ffffff' }}>
        {isAuthenticated && <CursorTracker />}
        {isAuthenticated && <RemoteCursors />}

        {/* ── Header ── */}
        <header style={{
          backgroundColor: 'rgba(7,13,26,0.97)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(23,197,200,0.15)',
          height: '48px', flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: '8px',
        }}>
          {/* Left: Back + Auth action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                color: 'rgba(255,255,255,0.65)',
                backgroundColor: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                textDecoration: 'none', transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                const a = e.currentTarget as HTMLAnchorElement;
                a.style.backgroundColor = 'rgba(255,255,255,0.12)';
                a.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                const a = e.currentTarget as HTMLAnchorElement;
                a.style.backgroundColor = 'rgba(255,255,255,0.07)';
                a.style.color = 'rgba(255,255,255,0.65)';
              }}
            >
              <ArrowLeft size={12} />
              {isAuthenticated ? 'Back' : 'Home'}
            </Link>

            {isAuthenticated ? (
              <button
                onClick={signOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                  color: 'rgba(255,255,255,0.55)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.backgroundColor = 'rgba(229,62,62,0.12)';
                  b.style.borderColor = 'rgba(229,62,62,0.3)';
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
            ) : (
              <Link
                to="/login"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  color: '#17c5c8',
                  backgroundColor: 'rgba(23,197,200,0.1)',
                  border: '1px solid rgba(23,197,200,0.3)',
                  textDecoration: 'none', transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  const a = e.currentTarget as HTMLAnchorElement;
                  a.style.backgroundColor = 'rgba(23,197,200,0.2)';
                }}
                onMouseLeave={(e) => {
                  const a = e.currentTarget as HTMLAnchorElement;
                  a.style.backgroundColor = 'rgba(23,197,200,0.1)';
                }}
              >
                <LogIn size={12} />
                Sign in
              </Link>
            )}
          </div>

          {/* Center: Board title */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              fontSize: '14px', fontWeight: 700, color: '#ffffff',
              letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '340px',
            }}>
              {boardTitle}
            </span>
          </div>

          {/* Right: Sync + Presence */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500 }}>
              {isSyncing ? (
                <>
                  <Loader2 size={11} className="animate-spin" style={{ color: '#17c5c8' }} />
                  <span style={{ color: '#17c5c8' }}>Syncing…</span>
                </>
              ) : syncStatus === 'connected' ? (
                <>
                  <Wifi size={11} style={{ color: '#28a745' }} />
                  <span style={{ color: '#28a745' }}>Live</span>
                </>
              ) : (
                <>
                  <WifiOff size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Connecting…</span>
                </>
              )}
            </div>

            {isAuthenticated && <OnlineDropdown />}
          </div>
        </header>

        {/* ── Canvas (white for drawing) ── */}
        <div className="flex-1 overflow-hidden">
          <Whiteboard />
        </div>

        {/* ── Toolbar ── */}
        <Toolbar />
      </div>
    </CollabProvider>
  );
}
