import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBoardStore } from '../store/boardStore';
import { supabase } from '../lib/supabase';
import { resolveDisplayName } from '../lib/userCache';

export interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
  userName: string;
  lastSeen: number; // ms timestamp
}

const STALE_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5_000;

export function useCursorTracking() {
  const { session } = useAuth();
  const { boardId } = useBoardStore();
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);

  // Periodically remove cursors that haven't been seen recently
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => prev.filter((c) => now - c.lastSeen < STALE_MS));
    }, CLEANUP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to remote cursor updates from other users
  useEffect(() => {
    if (!boardId || !session?.user?.id) return;

    const currentUserId = session.user.id;

    const channel = supabase
      .channel(`cursors:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_presence',
          filter: `board_id=eq.${boardId}`,
        },
        async (payload) => {
          if (!payload.new) return;
          const row = payload.new as {
            user_id: string;
            cursor_x: number;
            cursor_y: number;
          };
          // Never show our own cursor
          if (row.user_id === currentUserId) return;

          const userName = await resolveDisplayName(row.user_id);

          setCursors((prev) => {
            const filtered = prev.filter((c) => c.userId !== row.user_id);
            return [
              ...filtered,
              {
                userId: row.user_id,
                x: row.cursor_x,
                y: row.cursor_y,
                userName,
                lastSeen: Date.now(),
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [boardId, session]);

  return cursors;
}
