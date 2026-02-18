import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBoardStore } from '../store/boardStore';

type SyncStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Subscribes to real-time Supabase changes for the given board.
 * Requires Realtime enabled for the 'boards' table in Supabase Dashboard
 * → Database → Replication.
 */
export function useBoardSync(boardId: string | null) {
  const setObjects = useBoardStore((s) => s.setObjects);
  const [status, setStatus] = useState<SyncStatus>('disconnected');

  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel('board-sync:main-board')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'boards',
          filter: `id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.new && 'objects' in payload.new) {
            setObjects((payload.new as { objects: any[] }).objects ?? []);
          }
        }
      )
      .subscribe((s) => {
        setStatus(s === 'SUBSCRIBED' ? 'connected' : 'connecting');
      });

    return () => {
      channel.unsubscribe();
      setStatus('disconnected');
    };
  }, [boardId, setObjects]);

  return { status };
}
