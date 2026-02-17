import { useEffect, useState } from 'react';
import { LogOut, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBoardStore } from '../store/boardStore';
import { useBoardSync } from '../hooks/useBoardSync';
import { supabase } from '../lib/supabase';
import { Whiteboard } from '../components/Whiteboard';
import { Toolbar } from '../components/Toolbar';
import { CursorTracker } from '../components/CursorTracker';
import { RemoteCursors } from '../components/RemoteCursors';
import { OnlineUsers } from '../components/OnlineUsers';

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
      <OnlineUsers />

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4"
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          height: '48px',
          flexShrink: 0,
        }}
      >
        {/* Logo + name */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
            style={{ backgroundColor: '#17a2b8' }}
          >
            C
          </div>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>
            CollabBoard
          </span>
        </div>

        {/* Sync status */}
        <div
          className="flex items-center gap-1.5"
          style={{ fontSize: '12px', fontWeight: 500 }}
        >
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

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5"
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#666666',
            backgroundColor: '#f5f5f5',
            border: '1px solid #e0e0e0',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = '#e8e8e8';
            b.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = '#f5f5f5';
            b.style.boxShadow = 'none';
          }}
        >
          <LogOut size={12} />
          Sign out
        </button>
      </header>

      {/* ── Canvas ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <Whiteboard />
      </div>

      {/* ── Toolbar (fixed at bottom, rendered last so it overlays canvas) */}
      <Toolbar />
    </div>
  );
}
