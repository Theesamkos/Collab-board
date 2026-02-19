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

    // Clear local undo history whenever we (re-)connect to a board so
    // the user can't undo past the start of their session.
    useBoardStore.temporal.getState().clear();

    const channel = supabase
      .channel(`board-sync:${boardId}`)
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
            // Pause history so remote updates are NOT recorded in the local
            // user's undo stack — only their own actions should be undoable.
            useBoardStore.temporal.getState().pause();
            setObjects((payload.new as { objects: any[] }).objects ?? []);
            useBoardStore.temporal.getState().resume();
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
