import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBoardStore } from '../store/boardStore';
import { supabase } from '../lib/supabase';
import { resolveDisplayName } from '../lib/userCache';

export interface PresenceUser {
  userId: string;
  userName: string;
  lastSeen: number; // ms timestamp
}

const STALE_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5_000;

export function usePresence() {
  const { session } = useAuth();
  const { boardId } = useBoardStore();
  const [users, setUsers] = useState<PresenceUser[]>([]);

  // Load initial snapshot of who is already on the board
  useEffect(() => {
    if (!boardId || !session?.user?.id) return;

    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    supabase
      .from('board_presence')
      .select('user_id, last_seen')
      .eq('board_id', boardId)
      .gte('last_seen', cutoff)
      .then(async ({ data }) => {
        if (!data) return;
        const resolved = await Promise.all(
          data.map(async (row) => ({
            userId: row.user_id,
            userName: await resolveDisplayName(row.user_id),
            lastSeen: new Date(row.last_seen).getTime(),
          }))
        );
        setUsers(resolved);
      });
  }, [boardId, session]);

  // Subscribe to real-time inserts, updates, and deletes
  useEffect(() => {
    if (!boardId || !session?.user?.id) return;

    const channel = supabase
      .channel(`presence-list:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_presence',
          filter: `board_id=eq.${boardId}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { user_id: string };
            setUsers((prev) => prev.filter((u) => u.userId !== old.user_id));
            return;
          }

          if (!payload.new) return;
          const row = payload.new as { user_id: string; last_seen: string };
          const userName = await resolveDisplayName(row.user_id);

          setUsers((prev) => {
            const filtered = prev.filter((u) => u.userId !== row.user_id);
            return [
              ...filtered,
              {
                userId: row.user_id,
                userName,
                lastSeen: new Date(row.last_seen).getTime(),
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

  // Remove stale users every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setUsers((prev) => prev.filter((u) => now - u.lastSeen < STALE_MS));
    }, CLEANUP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return users;
}
