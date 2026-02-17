import { useEffect, useState, useRef } from 'react';
import { Loader2, Wifi, WifiOff, LogOut, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBoardStore } from '../store/boardStore';
import { useBoardSync } from '../hooks/useBoardSync';
import { supabase } from '../lib/supabase';
import { Whiteboard } from '../components/Whiteboard';
import { Toolbar } from '../components/Toolbar';
import { CursorTracker } from '../components/CursorTracker';
import { RemoteCursors } from '../components/RemoteCursors';
import { usePresence } from '../hooks/usePresence';
import { colorForUser } from '../lib/cursorColors';

// ── Inline presence dropdown ──────────────────────────────────────
function OnlineDropdown() {
  const { session } = useAuth();
  const users = usePresence();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: '#f5f5f5',
          border: '1px solid #e0e0e0',
          color: '#1a1a1a',
          cursor: 'pointer',
          transition: 'background-color 200ms ease',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8e8e8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5'; }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#28a745',
            flexShrink: 0,
            animation: 'presence-pulse 2s ease-in-out infinite',
          }}
        />
        Online
        <span
          style={{
            backgroundColor: '#17a2b8',
            color: '#fff',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 6px',
          }}
        >
          {count}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '200px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '10px',
            padding: '10px 12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 200,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {users.map((user) => {
              const color = colorForUser(user.userId);
              const isYou = user.userId === currentUserId;
              return (
                <div key={user.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {initials(user.userName)}
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: isYou ? 600 : 500,
                      color: '#1a1a1a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isYou ? 'You' : user.userName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Board page ────────────────────────────────────────────────────
export function Board() {
  const { session, signOut } = useAuth();
  const { boardId, setBoardId, setObjects, isSyncing } = useBoardStore();
  const [loading, setLoading] = useState(true);

  const { status: syncStatus } = useBoardSync(boardId);

  useEffect(() => {
    const initializeBoard = async () => {
      if (!session?.user?.id) return;

      let { data: boards, error } = await supabase
        .from('boards')
        .select('id, objects')
        .eq('user_id', session.user.id)
        .limit(1);

      let newBoardId: string;
      let initialObjects: any[] = [];

      if (error || !boards || boards.length === 0) {
        const { data, error: createError } = await supabase
          .from('boards')
          .insert([{ user_id: session.user.id, title: 'My Board', objects: [] }])
          .select('id, objects')
          .single();

        if (createError) {
          console.error('Error creating board:', createError);
          setLoading(false);
          return;
        }

        newBoardId = data.id;
        initialObjects = data.objects || [];
      } else {
        newBoardId = boards[0].id;
        initialObjects = boards[0].objects || [];
      }

      setBoardId(newBoardId);
      setObjects(initialObjects);
      setLoading(false);
    };

    initializeBoard();
  }, [session, setBoardId, setObjects]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: '#f5f5f5' }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#17a2b8' }} />
          <p style={{ color: '#666666', fontSize: '14px' }}>Loading your board…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#ffffff' }}>
      <CursorTracker />
      <RemoteCursors />

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          height: '48px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: '10px',
        }}
      >
        {/* Logout (left) */}
        <button
          onClick={signOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#666666',
            backgroundColor: '#f5f5f5',
            border: '1px solid #e0e0e0',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = '#fee2e2';
            b.style.borderColor = '#fca5a5';
            b.style.color = '#dc3545';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = '#f5f5f5';
            b.style.borderColor = '#e0e0e0';
            b.style.color = '#666666';
          }}
        >
          <LogOut size={12} />
          Logout
        </button>

        {/* Logo + name (takes remaining space) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1 }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              backgroundColor: '#17a2b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            C
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
            CollabBoard
          </span>
        </div>

        {/* Sync status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, flexShrink: 0 }}>
          {isSyncing ? (
            <>
              <Loader2 size={11} className="animate-spin" style={{ color: '#17a2b8' }} />
              <span style={{ color: '#17a2b8' }}>Syncing…</span>
            </>
          ) : syncStatus === 'connected' ? (
            <>
              <Wifi size={11} style={{ color: '#28a745' }} />
              <span style={{ color: '#28a745' }}>Live</span>
            </>
          ) : (
            <>
              <WifiOff size={11} style={{ color: '#999999' }} />
              <span style={{ color: '#999999' }}>Connecting…</span>
            </>
          )}
        </div>

        {/* Online presence dropdown (right) */}
        <OnlineDropdown />
      </header>

      {/* ── Canvas ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <Whiteboard />
      </div>

      {/* ── Toolbar (fixed at bottom) ───────────────────────── */}
      <Toolbar />
    </div>
  );
}
