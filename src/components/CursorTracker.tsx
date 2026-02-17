import { useEffect, useRef } from 'react';
import { useCollab } from '../context/CollabContext';

const THROTTLE_MS = 50;

export function CursorTracker() {
  const { broadcastCursor } = useCollab();
  const lastSentRef = useRef<number>(0);
  // Stable ref so the event listener never goes stale
  const broadcastRef = useRef(broadcastCursor);
  broadcastRef.current = broadcastCursor;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSentRef.current < THROTTLE_MS) return;
      lastSentRef.current = now;
      broadcastRef.current(e.clientX, e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return null;
}
