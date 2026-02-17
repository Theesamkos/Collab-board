import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBoardStore } from '../store/boardStore';
import { supabase } from '../lib/supabase';

const THROTTLE_MS = 100;

export function CursorTracker() {
  const { session } = useAuth();
  const { boardId } = useBoardStore();
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!session?.user?.id || !boardId) return;

    const userId = session.user.id;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      // Timestamp-based throttle — fires at most once per THROTTLE_MS
      if (now - lastSentRef.current < THROTTLE_MS) return;
      lastSentRef.current = now;

      supabase.from('board_presence').upsert(
        {
          board_id: boardId,
          user_id: userId,
          cursor_x: e.clientX,
          cursor_y: e.clientY,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'board_id,user_id' }
      );
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      // Remove own presence row so we don't appear stale to others
      supabase
        .from('board_presence')
        .delete()
        .eq('board_id', boardId)
        .eq('user_id', userId);
    };
  }, [session, boardId]);

  return null;
}
