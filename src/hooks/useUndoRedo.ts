import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useBoardStore } from '../store/boardStore';

/**
 * Sets up global Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z (and Cmd/Ctrl+Y) keyboard
 * shortcuts for undo and redo, and exposes the current ability to undo/redo
 * for use by toolbar buttons.
 *
 * Call this hook once from a component that is always mounted (e.g. Toolbar).
 */
export function useUndoRedo() {
  const temporal = useBoardStore.temporal;

  // useStore subscribes to the vanilla temporal StoreApi so components re-render
  // reactively when canUndo / canRedo changes.
  const canUndo = useStore(temporal, (state) => state.pastStates.length > 0);
  const canRedo = useStore(temporal, (state) => state.futureStates.length > 0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          temporal.getState().redo();
        } else {
          temporal.getState().undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        temporal.getState().redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [temporal]);

  return {
    undo: () => temporal.getState().undo(),
    redo: () => temporal.getState().redo(),
    canUndo,
    canRedo,
  };
}
