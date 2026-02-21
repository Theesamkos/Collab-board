import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { colorForUser } from '../lib/cursorColors';

export interface OnlineUser {
  userId: string;
  userName: string;
  color: string;
}

export interface RemoteCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

interface CollabContextType {
  onlineUsers: OnlineUser[];
  remoteCursors: RemoteCursor[];
  broadcastCursor: (x: number, y: number) => void;
}

const CollabContext = createContext<CollabContextType>({
  onlineUsers: [],
  remoteCursors: [],
  broadcastCursor: () => {},
});

function getDisplayName(session: ReturnType<typeof useAuth>['session']): string {
  return (
    (session?.user?.user_metadata?.['full_name'] as string | undefined) ||
    (session?.user?.user_metadata?.['name'] as string | undefined) ||
    session?.user?.email?.split('@')[0] ||
    'User'
  );
}

export function CollabProvider({
  boardId,
  children,
}: {
  boardId: string;
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cursorTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const userId = session?.user?.id ?? '';
  // Immediate fallback from session metadata; overridden by DB name when fetched
  const [userName, setUserName] = useState(() => getDisplayName(session));
  // Ref keeps the latest name without causing channel teardown on update
  const userNameRef = useRef(userName);
  useEffect(() => { userNameRef.current = userName; }, [userName]);

  // Fetch authoritative display_name from DB (covers email users with no metadata)
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setUserName(data.display_name);
      });
  }, [userId]);

  useEffect(() => {
    if (!boardId || !userId) return;

    const channel = supabase.channel(`collab:${boardId}`, {
      config: {
        presence: { key: userId },
        broadcast: { self: false, ack: false },
      },
    });
    channelRef.current = channel;

    // ── Presence: online users ────────────────────────────────────
    const syncUsers = () => {
      const state = channel.presenceState<{ userName: string }>();
      const users: OnlineUser[] = Object.entries(state).map(([uid, presences]) => ({
        userId: uid,
        userName: (presences as Array<{ userName: string }>)[0]?.userName ?? 'User',
        color: colorForUser(uid),
      }));
      setOnlineUsers(users);
    };

    channel.on('presence', { event: 'sync' }, syncUsers);
    channel.on('presence', { event: 'join' }, syncUsers);
    channel.on('presence', { event: 'leave' }, syncUsers);

    // ── Cursors: receive broadcasts ───────────────────────────────
    channel.on(
      'broadcast',
      { event: 'cursor' },
      ({ payload }: { payload: { userId: string; userName: string; x: number; y: number } }) => {
        const { userId: rid, userName: rName, x, y } = payload;
        setRemoteCursors((prev) => [
          ...prev.filter((c) => c.userId !== rid),
          { userId: rid, userName: rName, x, y, color: colorForUser(rid) },
        ]);
        // Auto-remove cursor after 5s of inactivity
        const existing = cursorTimers.current.get(rid);
        if (existing) clearTimeout(existing);
        cursorTimers.current.set(
          rid,
          setTimeout(() => {
            setRemoteCursors((prev) => prev.filter((c) => c.userId !== rid));
            cursorTimers.current.delete(rid);
          }, 5000)
        );
      }
    );

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userName: userNameRef.current });
      }
    });

    const onVisibility = () => {
      if (document.hidden) {
        channel.untrack();
      } else {
        channel.track({ userName: userNameRef.current });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cursorTimers.current.forEach(clearTimeout);
      cursorTimers.current.clear();
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [boardId, userId]); // userName intentionally excluded — use ref to avoid channel teardown

  // Re-track presence when DB name arrives without recreating the channel
  useEffect(() => {
    if (channelRef.current && userId) {
      channelRef.current.track({ userName });
    }
  }, [userName, userId]);

  const broadcastCursor = (x: number, y: number) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { userId, userName, x, y },
    });
  };

  return (
    <CollabContext.Provider value={{ onlineUsers, remoteCursors, broadcastCursor }}>
      {children}
    </CollabContext.Provider>
  );
}

export const useCollab = () => useContext(CollabContext);
