import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBoardStore } from '../store/boardStore';

type SyncStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Subscribes to real-time Supabase changes for the given board.
 *
 * Conflict strategy — last-write-wins:
 *   Local mutations debounce a save (600ms). Remote updates via the Realtime
 *   subscription call `setObjects`, which does NOT trigger a re-save, so there
 *   is no feedback loop. Any momentary stale echo from our own save is
 *   overwritten within 600ms by the next pending debounce write.
 */
export function useBoardSync(boardId: string | null) {
  const setObjects = useBoardStore((s) => s.setObjects);
  const [status, setStatus] = useState<SyncStatus>('disconnected');

  useEffect(() => {
    if (!boardId) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');

    const channel = supabase
      .channel(`board-realtime:${boardId}`)
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
            setObjects(payload.new.objects ?? []);
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
