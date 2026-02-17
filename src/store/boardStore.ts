import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface BoardObject {
  id: string;
  type: 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'frame' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
  rotation?: number;
}

interface BoardState {
  boardId: string | null;
  objects: BoardObject[];
  selectedObjectIds: string[];
  panX: number;
  panY: number;
  zoom: number;
  isSyncing: boolean;
  lastSynced: Date | null;

  // Actions
  setBoardId: (id: string) => void;
  setObjects: (objects: BoardObject[]) => void;
  addObject: (object: BoardObject) => void;
  updateObject: (id: string, updates: Partial<BoardObject>) => void;
  deleteObject: (id: string) => void;
  selectObject: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  clearObjects: () => void;
  rearrangeObjects: (positions: { id: string; x: number; y: number }[]) => void;
  syncToDatabase: () => Promise<void>;
}

let syncTimeout: NodeJS.Timeout;

const scheduleSyncDebounced = (get: () => BoardState) => {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => get().syncToDatabase(), 600);
};

export const useBoardStore = create<BoardState>((set, get) => ({
  boardId: null,
  objects: [],
  selectedObjectIds: [],
  panX: 0,
  panY: 0,
  zoom: 1,
  isSyncing: false,
  lastSynced: null,

  setBoardId: (id) => set({ boardId: id }),

  // Used for remote updates — does NOT trigger a re-sync
  setObjects: (objects) => set({ objects }),

  addObject: (object) => {
    set((state) => ({ objects: [...state.objects, object] }));
    scheduleSyncDebounced(get);
  },

  updateObject: (id, updates) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    }));
    scheduleSyncDebounced(get);
  },

  deleteObject: (id) => {
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedObjectIds: state.selectedObjectIds.filter((sid) => sid !== id),
    }));
    scheduleSyncDebounced(get);
  },

  selectObject: (id, multiSelect = false) => set((state) => ({
    selectedObjectIds: multiSelect
      ? state.selectedObjectIds.includes(id)
        ? state.selectedObjectIds.filter((sid) => sid !== id)
        : [...state.selectedObjectIds, id]
      : [id],
  })),

  clearSelection: () => set({ selectedObjectIds: [] }),

  clearObjects: () => {
    set({ objects: [], selectedObjectIds: [] });
    scheduleSyncDebounced(get);
  },

  rearrangeObjects: (positions) => {
    set((state) => ({
      objects: state.objects.map((obj) => {
        const pos = positions.find((p) => p.id === obj.id);
        return pos ? { ...obj, x: pos.x, y: pos.y } : obj;
      }),
    }));
    scheduleSyncDebounced(get);
  },

  setPan: (x, y) => set({ panX: x, panY: y }),

  setZoom: (zoom) => set({ zoom }),

  syncToDatabase: async () => {
    const { boardId, objects } = get();
    if (!boardId) return;

    set({ isSyncing: true });

    const { error } = await supabase
      .from('boards')
      .update({ objects })
      .eq('id', boardId);

    set({ isSyncing: false, lastSynced: error ? get().lastSynced : new Date() });

    if (error) console.error('Sync error:', error);
  },
}));
