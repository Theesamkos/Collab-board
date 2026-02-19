import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LogOut, Loader2, LayoutDashboard, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface BoardRow {
  id: string;
  title: string;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Dashboard() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Fetch boards the current user is a member of
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

  const handleCreate = async () => {
    const title = newName.trim() || 'Untitled Board';
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* ── Header ── */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            backgroundColor: '#17a2b8', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: '#fff',
          }}>C</div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
            CollabBoard
          </span>
        </div>

        {/* User email */}
        <span style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>
          {session?.user?.email}
        </span>

        {/* Logout */}
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 10px', borderRadius: '6px', fontSize: '12px',
            fontWeight: 500, color: '#6b7280', backgroundColor: '#f3f4f6',
            border: '1px solid #e5e7eb', cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = '#fee2e2';
            b.style.borderColor = '#fca5a5';
            b.style.color = '#dc2626';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.backgroundColor = '#f3f4f6';
            b.style.borderColor = '#e5e7eb';
            b.style.color = '#6b7280';
          }}
        >
          <LogOut size={12} />
          Logout
        </button>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Page heading */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard size={20} style={{ color: '#17a2b8' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
              My Boards
            </h1>
          </div>

          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
              fontWeight: 600, color: '#fff', backgroundColor: '#17a2b8',
              border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#138a9e'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#17a2b8'; }}
          >
            <Plus size={15} />
            New Board
          </button>
        </div>

        {/* New board form */}
        {showForm && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <input
              autoFocus
              type="text"
              placeholder="Board name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '6px',
                border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
                color: '#111827',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '8px 16px', borderRadius: '6px', fontSize: '13px',
                fontWeight: 600, color: '#fff',
                backgroundColor: creating ? '#9ca3af' : '#17a2b8',
                border: 'none', cursor: creating ? 'default' : 'pointer',
              }}
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                fontWeight: 500, color: '#6b7280', backgroundColor: '#f3f4f6',
                border: '1px solid #e5e7eb', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Board list */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280', marginTop: '40px' }}>
            <Loader2 size={18} className="animate-spin" style={{ color: '#17a2b8' }} />
            <span style={{ fontSize: '14px' }}>Loading boards…</span>
          </div>
        ) : boards.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 0', color: '#9ca3af',
          }}>
            <LayoutDashboard size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 6px' }}>No boards yet</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Click "New Board" to create your first whiteboard.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px',
          }}>
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'box-shadow 150ms ease, border-color 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    const d = e.currentTarget as HTMLDivElement;
                    d.style.boxShadow = '0 4px 12px rgba(23,162,184,0.15)';
                    d.style.borderColor = '#17a2b8';
                  }}
                  onMouseLeave={(e) => {
                    const d = e.currentTarget as HTMLDivElement;
                    d.style.boxShadow = 'none';
                    d.style.borderColor = '#e5e7eb';
                  }}
                >
                  {/* Board colour strip */}
                  <div style={{
                    height: '4px', borderRadius: '2px', marginBottom: '14px',
                    backgroundColor: '#17a2b8', opacity: 0.7,
                  }} />

                  <p style={{
                    fontSize: '14px', fontWeight: 600, color: '#111827',
                    margin: '0 0 8px', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {board.title}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9ca3af' }}>
                    <Clock size={11} />
                    <span style={{ fontSize: '11px' }}>{formatDate(board.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
