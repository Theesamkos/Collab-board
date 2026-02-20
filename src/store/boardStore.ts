import { create } from 'zustand';
import { temporal } from 'zundo';
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

export type ActiveTool = 'select' | 'pan' | 'draw' | 'rect' | 'connector' | 'frame';

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
  duplicateSelection: () => void;
  createFrameFromSelection: () => void;
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

export const useBoardStore = create<BoardState>()(
  temporal(
    (set, get) => ({
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

  duplicateSelection: () => {
    const { selectedObjectIds, objects } = get();
    if (selectedObjectIds.length === 0) return;

    const OFFSET = 20;
    const selectedIds = new Set(selectedObjectIds);
    const selected = objects.filter((o) => selectedIds.has(o.id));

    // Include connectors whose both endpoints are selected
    const implicitConnectors = objects.filter(
      (o) =>
        o.type === 'connector' &&
        !selectedIds.has(o.id) &&
        selectedIds.has(o.source?.objectId ?? '') &&
        selectedIds.has(o.target?.objectId ?? ''),
    );

    const idMap = new Map<string, string>();
    const newObjects: BoardObject[] = [];

    for (const obj of selected) {
      if (obj.type === 'connector') continue;
      const newId = crypto.randomUUID();
      idMap.set(obj.id, newId);
      newObjects.push({ ...obj, id: newId, x: obj.x + OFFSET, y: obj.y + OFFSET });
    }

    for (const obj of implicitConnectors) {
      if (!obj.source || !obj.target) continue;
      newObjects.push({
        ...obj,
        id: crypto.randomUUID(),
        source: { ...obj.source, objectId: idMap.get(obj.source.objectId) ?? obj.source.objectId },
        target: { ...obj.target, objectId: idMap.get(obj.target.objectId) ?? obj.target.objectId },
      });
    }

    set((state) => ({
      objects: [...state.objects, ...newObjects],
      selectedObjectIds: newObjects.map((o) => o.id),
    }));
    scheduleSyncDebounced(get);
  },

  createFrameFromSelection: () => {
    const { selectedObjectIds, objects } = get();
    if (selectedObjectIds.length === 0) return;

    const selected = objects.filter(
      (o) => selectedObjectIds.includes(o.id) && o.type !== 'connector',
    );
    if (selected.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of selected) {
      let x1: number, y1: number, x2: number, y2: number;
      if (obj.type === 'circle') {
        const r = obj.width / 2;
        x1 = obj.x - r; y1 = obj.y - r; x2 = obj.x + r; y2 = obj.y + r;
      } else if (obj.type === 'line' && obj.points && obj.points.length >= 2) {
        const xs = obj.points.filter((_, i) => i % 2 === 0);
        const ys = obj.points.filter((_, i) => i % 2 !== 0);
        x1 = Math.min(...xs); y1 = Math.min(...ys);
        x2 = Math.max(...xs); y2 = Math.max(...ys);
      } else {
        x1 = obj.x; y1 = obj.y; x2 = obj.x + obj.width; y2 = obj.y + obj.height;
      }
      minX = Math.min(minX, x1); minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2);
    }

    const PAD = 24;
    const TITLE_SPACE = 28; // space above top edge for the label
    const frameCount = objects.filter((o) => o.type === 'frame').length;
    const newId = crypto.randomUUID();
    const newFrame: BoardObject = {
      id: newId,
      type: 'frame',
      x: minX - PAD,
      y: minY - PAD - TITLE_SPACE,
      width:  maxX - minX + PAD * 2,
      height: maxY - minY + PAD * 2 + TITLE_SPACE,
      text: `Frame ${frameCount + 1}`,
      color: 'rgba(255,255,255,0.02)',
      strokeColor: '#94a3b8',
    };

    // Insert frame before all other objects so it renders behind them
    set((state) => ({
      objects: [newFrame, ...state.objects],
      selectedObjectIds: [newId],
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
    }),
    {
      // Track only the objects array — camera/selection/clipboard changes are intentionally excluded
      partialize: (state) => ({ objects: state.objects }),
      // Only record a history entry when the objects array reference actually changes.
      // Without this, every set() call (pan, zoom, select, etc.) creates a spurious entry,
      // making the user press Undo many times before a visible change appears.
      equality: (a, b) => a.objects === b.objects,
      limit: 100,
    }
  )
);
