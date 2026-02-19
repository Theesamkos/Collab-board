import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type ConnectionPointId = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface BoardObject {
  id: string;
  type: 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'frame' | 'text' | 'connector';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
  rotation?: number;
  points?: number[]; // freehand path points [x0,y0,x1,y1,...]
  strokeColor?: string; // explicit stroke color (rect tool)
  // Connector-specific
  source?: { objectId: string; point: ConnectionPointId };
  target?: { objectId: string; point: ConnectionPointId };
  connectorProperties?: {
    color: string;
    thickness: number;
    arrowhead: 'none' | 'one-way' | 'two-way';
  };
}

export type ActiveTool = 'select' | 'pan' | 'draw' | 'rect' | 'connector';

interface BoardState {
  boardId: string | null;
  objects: BoardObject[];
  selectedObjectIds: string[];
  // Client-side clipboard — never synced to Supabase
  clipboard: BoardObject[];
  clipboardMode: 'copy' | 'cut' | null;
  pasteCount: number; // increments each paste so offset accumulates
  panX: number;
  panY: number;
  zoom: number;
  isSyncing: boolean;
  lastSynced: Date | null;
  activeTool: ActiveTool;

  // Actions
  setBoardId: (id: string) => void;
  setObjects: (objects: BoardObject[]) => void;
  addObject: (object: BoardObject) => void;
  updateObject: (id: string, updates: Partial<BoardObject>) => void;
  deleteObject: (id: string) => void;
  deleteSelectedObjects: () => void;
  selectObject: (id: string, multiSelect?: boolean) => void;
  setSelectedObjectIds: (ids: string[]) => void;
  clearSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: ActiveTool) => void;
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
  clipboard: [],
  clipboardMode: null,
  pasteCount: 0,
  panX: 0,
  panY: 0,
  zoom: 1,
  isSyncing: false,
  lastSynced: null,
  activeTool: 'select',

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
      objects: state.objects.filter((obj) => {
        if (obj.id === id) return false;
        // Cascade delete: remove any connector that references the deleted object
        if (
          obj.type === 'connector' &&
          (obj.source?.objectId === id || obj.target?.objectId === id)
        ) return false;
        return true;
      }),
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

  setSelectedObjectIds: (ids) => set({ selectedObjectIds: ids }),

  clearSelection: () => set({ selectedObjectIds: [] }),

  copySelection: () => {
    const { selectedObjectIds, objects } = get();
    if (selectedObjectIds.length === 0) return;
    const selected = objects.filter((o) => selectedObjectIds.includes(o.id));
    // Also include connectors whose BOTH endpoints are selected (implicit copy)
    const implicitConnectors = objects.filter(
      (o) =>
        o.type === 'connector' &&
        !selectedObjectIds.includes(o.id) &&
        selectedObjectIds.includes(o.source?.objectId ?? '') &&
        selectedObjectIds.includes(o.target?.objectId ?? ''),
    );
    set({ clipboard: [...selected, ...implicitConnectors], clipboardMode: 'copy', pasteCount: 0 });
  },

  cutSelection: () => {
    const { selectedObjectIds, objects } = get();
    if (selectedObjectIds.length === 0) return;
    const selected = objects.filter((o) => selectedObjectIds.includes(o.id));
    const implicitConnectors = objects.filter(
      (o) =>
        o.type === 'connector' &&
        !selectedObjectIds.includes(o.id) &&
        selectedObjectIds.includes(o.source?.objectId ?? '') &&
        selectedObjectIds.includes(o.target?.objectId ?? ''),
    );
    const clipboard = [...selected, ...implicitConnectors];
    const clipboardIds = new Set(clipboard.map((o) => o.id));
    set((state) => ({
      clipboard,
      clipboardMode: 'cut',
      pasteCount: 0,
      objects: state.objects.filter((o) => {
        if (clipboardIds.has(o.id)) return false;
        // Cascade: remove dangling connectors referencing any cut object
        if (
          o.type === 'connector' &&
          (
            selectedObjectIds.includes(o.source?.objectId ?? '') ||
            selectedObjectIds.includes(o.target?.objectId ?? '')
          )
        ) return false;
        return true;
      }),
      selectedObjectIds: [],
    }));
    scheduleSyncDebounced(get);
  },

  pasteClipboard: () => {
    const { clipboard, clipboardMode, pasteCount } = get();
    if (clipboard.length === 0) return;

    const OFFSET_STEP = 20;
    const offset = (pasteCount + 1) * OFFSET_STEP;

    // Build old-ID → new-ID map for non-connector objects first
    const idMap = new Map<string, string>();
    const newObjects: BoardObject[] = [];

    for (const obj of clipboard) {
      if (obj.type === 'connector') continue;
      const newId = crypto.randomUUID();
      idMap.set(obj.id, newId);
      newObjects.push({ ...obj, id: newId, x: obj.x + offset, y: obj.y + offset });
    }

    // Connectors: remap source/target to the newly created object IDs
    for (const obj of clipboard) {
      if (obj.type !== 'connector' || !obj.source || !obj.target) continue;
      const newId = crypto.randomUUID();
      newObjects.push({
        ...obj,
        id: newId,
        source: { ...obj.source, objectId: idMap.get(obj.source.objectId) ?? obj.source.objectId },
        target: { ...obj.target, objectId: idMap.get(obj.target.objectId) ?? obj.target.objectId },
      });
    }

    const newIds = newObjects.map((o) => o.id);
    set((state) => ({
      objects: [...state.objects, ...newObjects],
      selectedObjectIds: newIds,
      pasteCount: state.pasteCount + 1,
      // Cut clipboard is one-shot; copy clipboard persists for repeated pastes
      clipboard: clipboardMode === 'cut' ? [] : state.clipboard,
      clipboardMode: clipboardMode === 'cut' ? null : state.clipboardMode,
    }));
    scheduleSyncDebounced(get);
  },

  deleteSelectedObjects: () => {
    const { selectedObjectIds } = get();
    if (selectedObjectIds.length === 0) return;
    set((state) => ({
      objects: state.objects.filter((o) => {
        if (selectedObjectIds.includes(o.id)) return false;
        // Cascade delete: remove connectors attached to any deleted object
        if (
          o.type === 'connector' &&
          (
            selectedObjectIds.includes(o.source?.objectId ?? '') ||
            selectedObjectIds.includes(o.target?.objectId ?? '')
          )
        ) return false;
        return true;
      }),
      selectedObjectIds: [],
    }));
    scheduleSyncDebounced(get);
  },

  setActiveTool: (tool) => set({ activeTool: tool }),

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
