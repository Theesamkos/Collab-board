import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arrow } from 'react-konva';
import Konva from 'konva';
import { useBoardStore } from '../store/boardStore';
import { BoardObject, ConnectionPointId } from '../store/boardStore';

// ── Connection-point helpers ───────────────────────────────────────
const CONNECTION_POINT_IDS: ConnectionPointId[] = ['top', 'bottom', 'left', 'right', 'center'];

function getConnectionPointCoords(
  obj: BoardObject,
  point: ConnectionPointId,
): { x: number; y: number } {
  // Circles store x/y as CENTER; everything else uses top-left origin
  if (obj.type === 'circle') {
    const r = obj.width / 2;
    switch (point) {
      case 'top':    return { x: obj.x,     y: obj.y - r };
      case 'bottom': return { x: obj.x,     y: obj.y + r };
      case 'left':   return { x: obj.x - r, y: obj.y     };
      case 'right':  return { x: obj.x + r, y: obj.y     };
      case 'center': return { x: obj.x,     y: obj.y     };
    }
  }
  switch (point) {
    case 'top':    return { x: obj.x + obj.width / 2, y: obj.y                  };
    case 'bottom': return { x: obj.x + obj.width / 2, y: obj.y + obj.height     };
    case 'left':   return { x: obj.x,                 y: obj.y + obj.height / 2 };
    case 'right':  return { x: obj.x + obj.width,     y: obj.y + obj.height / 2 };
    case 'center': return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
  }
}

// ── Marquee intersection test ─────────────────────────────────────
type Box = { x: number; y: number; width: number; height: number };

function objectIntersectsBox(obj: BoardObject, box: Box): boolean {
  // Connectors follow their endpoints — exclude from marquee
  if (obj.type === 'connector') return false;
  if (obj.type === 'line') {
    if (!obj.points) return false;
    for (let i = 0; i < obj.points.length - 1; i += 2) {
      const px = obj.points[i], py = obj.points[i + 1];
      if (px >= box.x && px <= box.x + box.width && py >= box.y && py <= box.y + box.height) return true;
    }
    return false;
  }
  if (obj.type === 'circle') {
    const r = obj.width / 2;
    return obj.x + r > box.x && obj.x - r < box.x + box.width &&
           obj.y + r > box.y && obj.y - r < box.y + box.height;
  }
  // rect, sticky-note, etc.
  return obj.x < box.x + box.width && obj.x + obj.width > box.x &&
         obj.y < box.y + box.height && obj.y + obj.height > box.y;
}

// ── Resize-handle types ───────────────────────────────────────────
type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
interface ResizeStart {
  handleType: HandleType;
  mouseX: number; mouseY: number;
  objX: number; objY: number;
  objWidth: number; objHeight: number;
}
const HANDLE_CURSORS: Record<HandleType, string> = {
  nw: 'nwse-resize', n: 'ns-resize',  ne: 'nesw-resize',
  e:  'ew-resize',   se: 'nwse-resize', s: 'ns-resize',
  sw: 'nesw-resize', w: 'ew-resize',
};

// ── Component ─────────────────────────────────────────────────────
export function Whiteboard() {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    objects, panX, panY, zoom,
    setPan, setZoom,
    addObject, updateObject, deleteObject, selectObject, setSelectedObjectIds, clearSelection,
    activeTool, deleteSelectedObjects, selectedObjectIds,
    copySelection, cutSelection, pasteClipboard, duplicateSelection,
  } = useBoardStore();

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [livePoints, setLivePoints] = useState<number[]>([]);
  const drawPointsRef = useRef<number[]>([]);

  // Rect-tool state
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const liveRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [liveRect, setLiveRect] = useState<Box | null>(null);
  const shiftHeldRef = useRef(false);

  // ── Marquee (selection-box) state ─────────────────────────────────
  const selBoxStartRef = useRef<{ x: number; y: number } | null>(null);
  const selBoxRef = useRef<Box | null>(null);
  const [selBox, setSelBox] = useState<Box | null>(null);
  // Guards against stage onClick clearing a just-completed marquee selection
  const selBoxDraggedRef = useRef(false);

  // ── Connector-tool state ─────────────────────────────────────────
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const connectorStartRef = useRef<{
    objectId: string; point: ConnectionPointId; x: number; y: number;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveConnectorEnd, setLiveConnectorEnd] = useState<{ x: number; y: number } | null>(null);
  const [snapTarget, setSnapTarget] = useState<{
    objectId: string; point: ConnectionPointId; x: number; y: number;
  } | null>(null);

  // ── Refs that always hold the latest value (avoid stale closures) ─
  const objectsRef = useRef(objects);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  const snapTargetRef = useRef(snapTarget);
  useEffect(() => { snapTargetRef.current = snapTarget; }, [snapTarget]);
  const selectedObjectIdsRef = useRef(selectedObjectIds);
  useEffect(() => { selectedObjectIdsRef.current = selectedObjectIds; }, [selectedObjectIds]);

  // ── Resize-handle state ───────────────────────────────────────────
  const resizingObjIdRef  = useRef<string | null>(null);
  const resizeStartRef    = useRef<ResizeStart | null>(null);
  const liveResizeDimsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const justFinishedResizeRef = useRef(false);
  const [liveResizeDims, setLiveResizeDims] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [resizeCursor, setResizeCursor] = useState<string | null>(null);

  // ── Group-drag tracking ──────────────────────────────────────────
  // Start position of the object being dragged (canvas coords)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Clean up connector state on tool switch ───────────────────────
  useEffect(() => {
    if (activeTool !== 'connector') {
      connectorStartRef.current = null;
      setIsConnecting(false);
      setLiveConnectorEnd(null);
      setSnapTarget(null);
      setHoveredObjectId(null);
    }
  }, [activeTool]);

  // Resize
  useEffect(() => {
    const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track Shift (square constraint + multi-select)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = true; };
    const up   = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Auto-focus textarea
  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingId]);

  // Delete key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && editingId === null) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        deleteSelectedObjects();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingId, deleteSelectedObjects]);

  // Copy / Cut / Paste (Cmd/Ctrl + C / X / V)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); copySelection(); }
      else if (e.key === 'x' || e.key === 'X') { e.preventDefault(); cutSelection(); }
      else if (e.key === 'v' || e.key === 'V') { e.preventDefault(); pasteClipboard(); }
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); duplicateSelection(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [copySelection, cutSelection, pasteClipboard, duplicateSelection]);

  const cursorStyle: Record<string, string> = {
    select:    'default',
    pan:       'grab',
    draw:      'crosshair',
    rect:      'crosshair',
    connector: 'crosshair',
  };

  const startEditing = (obj: BoardObject, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectObject(obj.id);
    setEditingText(obj.text || '');
    setEditingId(obj.id);
  };

  const commitEdit = () => {
    if (editingId) { updateObject(editingId, { text: editingText }); setEditingId(null); }
  };
  const cancelEdit = () => setEditingId(null);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const stage = stageRef.current;
      if (!stage) return;
      const oldScale = zoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const mousePointTo = { x: (pointer.x - panX) / oldScale, y: (pointer.y - panY) / oldScale };
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const clampedScale = Math.max(0.5, Math.min(3, oldScale * (1 + direction * 0.05)));
      setPan(pointer.x - mousePointTo.x * clampedScale, pointer.y - mousePointTo.y * clampedScale);
      setZoom(clampedScale);
    } else {
      setPan(panX - e.evt.deltaX, panY - e.evt.deltaY);
    }
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setPan(e.target.x(), e.target.y());
  };

  const getTextareaStyle = (obj: BoardObject): React.CSSProperties => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const offsetX = containerRect?.left ?? 0;
    const offsetY = containerRect?.top ?? 0;
    return {
      position: 'fixed',
      left: offsetX + panX + obj.x * zoom,
      top:  offsetY + panY + obj.y * zoom,
      width: obj.width  * zoom,
      height: obj.height * zoom,
      padding: `${10 * zoom}px`,
      fontSize: `${14 * zoom}px`,
      lineHeight: '1.5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: obj.color || '#FFFF00',
      border: '2px solid #17a2b8',
      borderRadius: 0,
      resize: 'none',
      outline: 'none',
      wordBreak: 'break-word',
      overflow: 'hidden',
      zIndex: 1000,
      color: '#000000',
    };
  };

  // ── Group-drag helpers ────────────────────────────────────────────
  // Called during drag of a selected object — keeps all other selected nodes in sync visually
  const handleGroupDragMove = useCallback((draggedId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    if (!dragStartPosRef.current) return;
    const ids = selectedObjectIdsRef.current;
    if (!ids.includes(draggedId) || ids.length < 2) return;

    const dx = e.target.x() - dragStartPosRef.current.x;
    const dy = e.target.y() - dragStartPosRef.current.y;

    for (const id of ids) {
      if (id === draggedId) continue;
      const obj = objectsRef.current.find((o) => o.id === id);
      if (!obj || obj.type === 'connector' || obj.type === 'line') continue;
      const node = stageRef.current?.findOne('#' + id) as Konva.Node | undefined;
      if (node) {
        node.x(obj.x + dx);
        node.y(obj.y + dy);
      }
    }
  }, []);

  // Called on dragEnd — commits final positions for all selected objects.
  // Pause/resume batches all updateObject calls so they produce a single undo step;
  // after resume we manually push one history entry via temporal.setState.
  const handleGroupDragEnd = useCallback((draggedId: string, finalX: number, finalY: number) => {
    // Snapshot BEFORE any mutations so we have a "before" state for undo
    const preObjects = useBoardStore.getState().objects;

    useBoardStore.temporal.getState().pause();

    updateObject(draggedId, { x: finalX, y: finalY });

    const ids = selectedObjectIdsRef.current;
    if (!ids.includes(draggedId) || ids.length < 2 || !dragStartPosRef.current) {
      dragStartPosRef.current = null;
    } else {
      const dx = finalX - dragStartPosRef.current.x;
      const dy = finalY - dragStartPosRef.current.y;
      dragStartPosRef.current = null;

      for (const id of ids) {
        if (id === draggedId) continue;
        const obj = objectsRef.current.find((o) => o.id === id);
        if (!obj || obj.type === 'connector' || obj.type === 'line') continue;
        updateObject(id, { x: obj.x + dx, y: obj.y + dy });
      }
    }

    useBoardStore.temporal.getState().resume();

    // Push exactly one history entry covering the entire drag operation
    const postObjects = useBoardStore.getState().objects;
    if (postObjects !== preObjects) {
      useBoardStore.temporal.setState((s) => ({
        pastStates: [
          ...(s.pastStates.length >= 100 ? s.pastStates.slice(1) : s.pastStates),
          { objects: preObjects },
        ],
        futureStates: [],
      }));
    }
  }, [updateObject]);

  // ── Stage mouse handlers ──────────────────────────────────────────
  const handleDrawMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    if (activeTool === 'select') {
      // Start marquee only when clicking empty canvas (not a shape)
      if (e.target === stage) {
        selBoxStartRef.current = pos;
        selBoxRef.current = null;
        setSelBox(null);
      }
      return;
    }

    if (activeTool === 'draw') {
      drawPointsRef.current = [pos.x, pos.y];
      setLivePoints([pos.x, pos.y]);
      setIsDrawing(true);
    } else if (activeTool === 'rect') {
      rectStartRef.current = pos;
      liveRectRef.current = null;
      setLiveRect(null);
    }
    // connector: drawing starts via connection-point circle onMouseDown
  }, [activeTool]);

  const handleDrawMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    // ── Resize handle drag ───────────────────────────────────────────
    if (resizingObjIdRef.current !== null && resizeStartRef.current !== null) {
      const rs = resizeStartRef.current;
      const dx = pos.x - rs.mouseX;
      const dy = pos.y - rs.mouseY;
      const MIN = 20;
      const obj = objectsRef.current.find((o) => o.id === resizingObjIdRef.current);
      if (obj) {
        let newX = rs.objX, newY = rs.objY, newW = rs.objWidth, newH = rs.objHeight;
        if (obj.type === 'circle') {
          const r0 = rs.objWidth / 2;
          let delta: number;
          switch (rs.handleType) {
            case 'se': delta = (dx + dy) / 2; break;
            case 'sw': delta = (-dx + dy) / 2; break;
            case 'ne': delta = (dx - dy) / 2; break;
            default:   delta = (-dx - dy) / 2; break; // nw
          }
          newW = Math.max(MIN, rs.objWidth + delta * 2);
          newH = newW;
          const newR = newW / 2;
          switch (rs.handleType) {
            case 'se': newX = rs.objX - r0 + newR; newY = rs.objY - r0 + newR; break;
            case 'sw': newX = rs.objX + r0 - newR; newY = rs.objY - r0 + newR; break;
            case 'ne': newX = rs.objX - r0 + newR; newY = rs.objY + r0 - newR; break;
            default:   newX = rs.objX + r0 - newR; newY = rs.objY + r0 - newR; break; // nw
          }
        } else {
          switch (rs.handleType) {
            case 'nw':
              newX = rs.objX + dx; newY = rs.objY + dy;
              newW = Math.max(MIN, rs.objWidth - dx); newH = Math.max(MIN, rs.objHeight - dy);
              if (newW === MIN) newX = rs.objX + rs.objWidth - MIN;
              if (newH === MIN) newY = rs.objY + rs.objHeight - MIN;
              break;
            case 'n':
              newY = rs.objY + dy; newH = Math.max(MIN, rs.objHeight - dy);
              if (newH === MIN) newY = rs.objY + rs.objHeight - MIN;
              break;
            case 'ne':
              newY = rs.objY + dy; newH = Math.max(MIN, rs.objHeight - dy);
              newW = Math.max(MIN, rs.objWidth + dx);
              if (newH === MIN) newY = rs.objY + rs.objHeight - MIN;
              break;
            case 'e':
              newW = Math.max(MIN, rs.objWidth + dx);
              break;
            case 'se':
              newW = Math.max(MIN, rs.objWidth + dx); newH = Math.max(MIN, rs.objHeight + dy);
              break;
            case 's':
              newH = Math.max(MIN, rs.objHeight + dy);
              break;
            case 'sw':
              newX = rs.objX + dx; newW = Math.max(MIN, rs.objWidth - dx); newH = Math.max(MIN, rs.objHeight + dy);
              if (newW === MIN) newX = rs.objX + rs.objWidth - MIN;
              break;
            case 'w':
              newX = rs.objX + dx; newW = Math.max(MIN, rs.objWidth - dx);
              if (newW === MIN) newX = rs.objX + rs.objWidth - MIN;
              break;
          }
        }
        const dims = { x: newX, y: newY, width: newW, height: newH };
        liveResizeDimsRef.current = dims;
        setLiveResizeDims(dims);
      }
      return;
    }

    if (activeTool === 'select' && selBoxStartRef.current) {
      const start = selBoxStartRef.current;
      const w = pos.x - start.x;
      const h = pos.y - start.y;
      const box: Box = {
        x: w < 0 ? pos.x : start.x,
        y: h < 0 ? pos.y : start.y,
        width:  Math.abs(w),
        height: Math.abs(h),
      };
      selBoxRef.current = box;
      setSelBox(box);
    } else if (activeTool === 'draw' && isDrawing) {
      drawPointsRef.current = [...drawPointsRef.current, pos.x, pos.y];
      setLivePoints([...drawPointsRef.current]);
    } else if (activeTool === 'rect' && rectStartRef.current) {
      const start = rectStartRef.current;
      let w = pos.x - start.x;
      let h = pos.y - start.y;
      if (shiftHeldRef.current) {
        const side = Math.min(Math.abs(w), Math.abs(h));
        w = w < 0 ? -side : side;
        h = h < 0 ? -side : side;
      }
      const r: Box = {
        x: w < 0 ? start.x + w : start.x,
        y: h < 0 ? start.y + h : start.y,
        width:  Math.abs(w),
        height: Math.abs(h),
      };
      liveRectRef.current = r;
      setLiveRect(r);
    } else if (activeTool === 'connector' && connectorStartRef.current) {
      const SNAP_RADIUS = 20;
      let foundSnap: typeof snapTarget = null;

      for (const obj of objectsRef.current) {
        if (obj.type === 'connector') continue;
        for (const pt of CONNECTION_POINT_IDS) {
          const coords = getConnectionPointCoords(obj, pt);
          const dist = Math.sqrt((pos.x - coords.x) ** 2 + (pos.y - coords.y) ** 2);
          if (dist < SNAP_RADIUS) { foundSnap = { objectId: obj.id, point: pt, ...coords }; break; }
        }
        if (foundSnap) break;
      }

      setSnapTarget(foundSnap);
      if (foundSnap) setHoveredObjectId(foundSnap.objectId);
      setLiveConnectorEnd(foundSnap ? { x: foundSnap.x, y: foundSnap.y } : pos);
    }
  }, [activeTool, isDrawing]);

  const handleDrawMouseUp = useCallback(() => {
    // ── Commit resize ────────────────────────────────────────────────
    if (resizingObjIdRef.current !== null) {
      const id   = resizingObjIdRef.current;
      const dims = liveResizeDimsRef.current;
      resizingObjIdRef.current  = null;
      resizeStartRef.current    = null;
      liveResizeDimsRef.current = null;
      justFinishedResizeRef.current = true;
      setLiveResizeDims(null);
      setResizeCursor(null);
      if (dims) updateObject(id, dims);
      return;
    }

    if (activeTool === 'select' && selBoxStartRef.current) {
      selBoxStartRef.current = null;
      const box = selBoxRef.current;
      selBoxRef.current = null;
      setSelBox(null);

      if (box && box.width > 5 && box.height > 5) {
        selBoxDraggedRef.current = true;
        const ids = objectsRef.current
          .filter((obj) => objectIntersectsBox(obj, box))
          .map((obj) => obj.id);
        if (ids.length > 0) setSelectedObjectIds(ids);
      }
      return;
    }

    if (activeTool === 'draw' && isDrawing) {
      setIsDrawing(false);
      const pts = drawPointsRef.current;
      drawPointsRef.current = [];
      setLivePoints([]);
      if (pts.length >= 4) {
        addObject({ id: crypto.randomUUID(), type: 'line', x: 0, y: 0, width: 0, height: 0, points: pts, color: '#1a1a1a' });
      }
    } else if (activeTool === 'rect' && rectStartRef.current) {
      const r = liveRectRef.current;
      rectStartRef.current = null;
      liveRectRef.current = null;
      setLiveRect(null);
      if (r && r.width > 4 && r.height > 4) {
        addObject({ id: crypto.randomUUID(), type: 'rectangle', x: r.x, y: r.y, width: r.width, height: r.height, color: 'rgba(255,255,255,0.01)', strokeColor: '#1a1a1a' });
      }
    } else if (activeTool === 'connector' && connectorStartRef.current) {
      const start = connectorStartRef.current;
      const snap  = snapTargetRef.current;
      connectorStartRef.current = null;
      setIsConnecting(false);
      setLiveConnectorEnd(null);
      setSnapTarget(null);
      if (snap) {
        addObject({
          id: crypto.randomUUID(),
          type: 'connector',
          x: 0, y: 0, width: 0, height: 0,
          source: { objectId: start.objectId, point: start.point },
          target: { objectId: snap.objectId,  point: snap.point  },
          connectorProperties: { color: '#1a1a1a', thickness: 2, arrowhead: 'one-way' },
        });
      }
    }
  }, [activeTool, isDrawing, addObject, setSelectedObjectIds, updateObject]);

  // ── Connector rendering ───────────────────────────────────────────
  const renderConnector = (obj: BoardObject) => {
    if (!obj.source || !obj.target || !obj.connectorProperties) return null;
    const srcObj = objectsRef.current.find((o) => o.id === obj.source!.objectId);
    const tgtObj = objectsRef.current.find((o) => o.id === obj.target!.objectId);
    if (!srcObj || !tgtObj) return null;

    const startPt = getConnectionPointCoords(srcObj, obj.source.point);
    const endPt   = getConnectionPointCoords(tgtObj, obj.target.point);
    const { color, thickness, arrowhead } = obj.connectorProperties;
    const isSelected = selectedObjectIds.includes(obj.id);
    const strokeColor = isSelected ? '#17a2b8' : color;
    const strokeWidth = isSelected ? thickness + 1.5 : thickness;
    const points = [startPt.x, startPt.y, endPt.x, endPt.y];

    const sharedProps = {
      key: obj.id,
      points,
      stroke: strokeColor,
      strokeWidth,
      hitStrokeWidth: Math.max(14, strokeWidth + 10),
      lineCap: 'round' as const,
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        selectObject(obj.id, shiftHeldRef.current);
      },
    };

    if (arrowhead === 'none') return <Line {...sharedProps} />;
    return (
      <Arrow {...sharedProps} fill={strokeColor}
        pointerAtBeginning={arrowhead === 'two-way'} pointerAtEnding
        pointerLength={10} pointerWidth={8}
      />
    );
  };

  // ── Connection-point indicator circles ────────────────────────────
  const renderConnectionPoints = (objectId: string) => {
    const obj = objectsRef.current.find((o) => o.id === objectId);
    if (!obj || obj.type === 'connector') return null;

    return CONNECTION_POINT_IDS.map((pt) => {
      const coords = getConnectionPointCoords(obj, pt);
      const isSnap = snapTarget?.objectId === objectId && snapTarget.point === pt;
      return (
        <Circle
          key={`cp-${objectId}-${pt}`}
          x={coords.x} y={coords.y}
          radius={isSnap ? 8 : 6}
          fill={isSnap ? '#17a2b8' : 'rgba(255,255,255,0.95)'}
          stroke={isSnap ? '#0d7a8c' : '#17a2b8'}
          strokeWidth={isSnap ? 3 : 1.5}
          onMouseDown={(e) => {
            e.cancelBubble = true;
            connectorStartRef.current = { objectId, point: pt, ...coords };
            setIsConnecting(true);
          }}
          onClick={(e) => { e.cancelBubble = true; }}
        />
      );
    });
  };

  // ── Group selection bounding box ──────────────────────────────────
  const groupBBox: Box | null = (() => {
    if (selectedObjectIds.length < 2) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of selectedObjectIds) {
      const obj = objects.find((o) => o.id === id);
      if (!obj) continue;
      let x1: number, y1: number, x2: number, y2: number;
      if (obj.type === 'connector') {
        if (!obj.source || !obj.target) continue;
        const src = objects.find((o) => o.id === obj.source!.objectId);
        const tgt = objects.find((o) => o.id === obj.target!.objectId);
        if (!src || !tgt) continue;
        const s = getConnectionPointCoords(src, obj.source.point);
        const t = getConnectionPointCoords(tgt, obj.target.point);
        x1 = Math.min(s.x, t.x); y1 = Math.min(s.y, t.y);
        x2 = Math.max(s.x, t.x); y2 = Math.max(s.y, t.y);
      } else if (obj.type === 'line') {
        if (!obj.points || obj.points.length < 2) continue;
        const xs = obj.points.filter((_, i) => i % 2 === 0);
        const ys = obj.points.filter((_, i) => i % 2 !== 0);
        x1 = Math.min(...xs); y1 = Math.min(...ys);
        x2 = Math.max(...xs); y2 = Math.max(...ys);
      } else if (obj.type === 'circle') {
        const r = obj.width / 2;
        x1 = obj.x - r; y1 = obj.y - r; x2 = obj.x + r; y2 = obj.y + r;
      } else {
        x1 = obj.x; y1 = obj.y; x2 = obj.x + obj.width; y2 = obj.y + obj.height;
      }
      minX = Math.min(minX, x1); minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2);
    }
    if (minX === Infinity) return null;
    const pad = 10;
    return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  })();

  const editingObj      = editingId ? objects.find((o) => o.id === editingId) : null;
  const objectsDraggable = activeTool === 'select';
  const stageDraggable   = activeTool === 'pan';

  // Hover handlers for connector tool
  const connectorHoverProps = (objId: string) =>
    activeTool === 'connector'
      ? {
          onMouseEnter: () => setHoveredObjectId(objId),
          onMouseLeave: () => { if (!connectorStartRef.current) setHoveredObjectId(null); },
        }
      : {};

  // Drag props for shapes that participate in group drag
  const groupDragProps = (obj: BoardObject) => ({
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      dragStartPosRef.current = { x: e.target.x(), y: e.target.y() };
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => handleGroupDragMove(obj.id, e),
    onDragEnd:  (e: Konva.KonvaEventObject<DragEvent>) => handleGroupDragEnd(obj.id, e.target.x(), e.target.y()),
  });

  const renderObject = (obj: BoardObject) => {
    const isEditing  = obj.id === editingId;
    const isSelected = selectedObjectIds.includes(obj.id);
    // Merge live resize dimensions so the object tracks the handle in real-time
    const effObj = (resizingObjIdRef.current === obj.id && liveResizeDims)
      ? { ...obj, ...liveResizeDims }
      : obj;

    switch (obj.type) {
      case 'connector':
        return renderConnector(obj);

      case 'sticky-note':
        return (
          <Group
            key={obj.id}
            id={obj.id}
            x={effObj.x} y={effObj.y}
            draggable={objectsDraggable && !isEditing}
            onClick={(e) => { e.cancelBubble = true; selectObject(obj.id, shiftHeldRef.current); }}
            onDblClick={(e) => startEditing(obj, e)}
            {...groupDragProps(obj)}
            {...connectorHoverProps(obj.id)}
          >
            <Rect
              width={effObj.width} height={effObj.height}
              fill={obj.color || '#FFFF00'}
              stroke={isSelected ? '#17a2b8' : 'rgba(0,0,0,0.15)'}
              strokeWidth={isSelected ? 2 : 1}
              shadowBlur={isSelected ? 8 : 3}
              shadowColor={isSelected ? '#17a2b8' : 'black'}
              shadowOpacity={isSelected ? 0.3 : 0.15}
              shadowOffsetX={2} shadowOffsetY={2}
            />
            <Text
              text={obj.text || ''} width={effObj.width} height={effObj.height}
              padding={10} fontSize={14} fill="#1a1a1a" wrap="word"
              opacity={isEditing ? 0 : 1}
            />
          </Group>
        );

      case 'rectangle':
        return (
          <Rect
            key={obj.id} id={obj.id}
            x={effObj.x} y={effObj.y} width={effObj.width} height={effObj.height}
            fill={obj.color || '#17a2b8'}
            stroke={isSelected ? '#17a2b8' : (obj.strokeColor || 'rgba(0,0,0,0.2)')}
            strokeWidth={isSelected ? 2.5 : (obj.strokeColor ? 2 : 1)}
            draggable={objectsDraggable}
            onClick={(e) => { e.cancelBubble = true; selectObject(obj.id, shiftHeldRef.current); }}
            {...groupDragProps(obj)}
            {...connectorHoverProps(obj.id)}
          />
        );

      case 'circle':
        return (
          <Circle
            key={obj.id} id={obj.id}
            x={effObj.x} y={effObj.y} radius={effObj.width / 2}
            fill={obj.color || '#28a745'}
            stroke={isSelected ? '#dc3545' : 'rgba(0,0,0,0.2)'}
            strokeWidth={isSelected ? 2 : 1}
            draggable={objectsDraggable}
            onClick={(e) => { e.cancelBubble = true; selectObject(obj.id, shiftHeldRef.current); }}
            {...groupDragProps(obj)}
            {...connectorHoverProps(obj.id)}
          />
        );

      case 'line':
        return (
          <Line
            key={obj.id}
            points={obj.points || [obj.x, obj.y, obj.x + obj.width, obj.y + obj.height]}
            stroke={obj.color || '#1a1a1a'}
            strokeWidth={isSelected ? 3 : 2}
            lineCap="round" lineJoin="round" tension={0.3}
            onClick={(e) => { e.cancelBubble = true; selectObject(obj.id, shiftHeldRef.current); }}
          />
        );

      default:
        return null;
    }
  };

  // ── Resize handles ────────────────────────────────────────────────
  const renderResizeHandles = () => {
    if (selectedObjectIds.length !== 1 || activeTool !== 'select' || editingId !== null) return null;
    const obj = objects.find((o) => o.id === selectedObjectIds[0]);
    if (!obj || obj.type === 'connector' || obj.type === 'line') return null;

    // Use live dims if a resize is in progress for this object
    const effObj = (resizingObjIdRef.current === obj.id && liveResizeDims)
      ? { ...obj, ...liveResizeDims }
      : obj;

    const isCircle = obj.type === 'circle';
    const HS = 8 / zoom;   // handle size in canvas units → always 8 screen px
    const SW = 1.5 / zoom; // handle stroke width in canvas units

    // Bounding box top-left (circles store x/y as center)
    const bx = isCircle ? effObj.x - effObj.width / 2 : effObj.x;
    const by = isCircle ? effObj.y - effObj.width / 2 : effObj.y;
    const bw = effObj.width;
    const bh = isCircle ? effObj.width : effObj.height;

    const handles: { type: HandleType; x: number; y: number }[] = isCircle
      ? [
          { type: 'nw', x: bx,           y: by      },
          { type: 'ne', x: bx + bw,      y: by      },
          { type: 'se', x: bx + bw,      y: by + bh },
          { type: 'sw', x: bx,           y: by + bh },
        ]
      : [
          { type: 'nw', x: bx,          y: by           },
          { type: 'n',  x: bx + bw / 2, y: by           },
          { type: 'ne', x: bx + bw,     y: by           },
          { type: 'e',  x: bx + bw,     y: by + bh / 2  },
          { type: 'se', x: bx + bw,     y: by + bh      },
          { type: 's',  x: bx + bw / 2, y: by + bh      },
          { type: 'sw', x: bx,          y: by + bh      },
          { type: 'w',  x: bx,          y: by + bh / 2  },
        ];

    return (
      <>
        {/* Dashed selection bounding box */}
        <Rect
          x={bx} y={by} width={bw} height={bh}
          fill="transparent"
          stroke="#17a2b8"
          strokeWidth={1 / zoom}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
        {/* Handle squares */}
        {handles.map(({ type, x, y }) => (
          <Rect
            key={`rh-${type}`}
            x={x - HS / 2} y={y - HS / 2}
            width={HS} height={HS}
            fill="white"
            stroke="#17a2b8"
            strokeWidth={SW}
            onMouseEnter={() => setResizeCursor(HANDLE_CURSORS[type])}
            onMouseLeave={() => { if (!resizingObjIdRef.current) setResizeCursor(null); }}
            onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              const stage = stageRef.current;
              if (!stage) return;
              const pos = stage.getRelativePointerPosition();
              if (!pos) return;
              const start: ResizeStart = {
                handleType: type,
                mouseX: pos.x, mouseY: pos.y,
                objX: effObj.x, objY: effObj.y,
                objWidth: effObj.width, objHeight: effObj.height,
              };
              resizingObjIdRef.current  = obj.id;
              resizeStartRef.current    = start;
              liveResizeDimsRef.current = { x: effObj.x, y: effObj.y, width: effObj.width, height: effObj.height };
              setLiveResizeDims({ x: effObj.x, y: effObj.y, width: effObj.width, height: effObj.height });
              setResizeCursor(HANDLE_CURSORS[type]);
            }}
          />
        ))}
      </>
    );
  };

  // ── Connector properties panel ────────────────────────────────────
  const selectedConnector =
    selectedObjectIds.length === 1
      ? objects.find((o) => o.id === selectedObjectIds[0] && o.type === 'connector')
      : undefined;

  const connectorPanelPos = selectedConnector
    ? (() => {
        const src = objects.find((o) => o.id === selectedConnector.source?.objectId);
        const tgt = objects.find((o) => o.id === selectedConnector.target?.objectId);
        if (!src || !tgt || !selectedConnector.source || !selectedConnector.target) return null;
        const s = getConnectionPointCoords(src, selectedConnector.source.point);
        const t = getConnectionPointCoords(tgt, selectedConnector.target.point);
        const cr = containerRef.current?.getBoundingClientRect();
        return {
          x: (cr?.left ?? 0) + panX + ((s.x + t.x) / 2) * zoom,
          y: (cr?.top  ?? 0) + panY + ((s.y + t.y) / 2) * zoom,
        };
      })()
    : null;

  const updateConnectorProps = (partial: Partial<NonNullable<BoardObject['connectorProperties']>>) => {
    if (!selectedConnector) return;
    updateObject(selectedConnector.id, {
      connectorProperties: {
        color: '#1a1a1a', thickness: 2, arrowhead: 'one-way',
        ...selectedConnector.connectorProperties, ...partial,
      },
    });
  };

  return (
    <div
      ref={containerRef}
      className="canvas-bg"
      style={{ position: 'relative', cursor: resizeCursor ?? cursorStyle[activeTool] ?? 'default' }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height - 60}
        x={panX} y={panY}
        scaleX={zoom} scaleY={zoom}
        onWheel={handleWheel}
        onDragEnd={stageDraggable ? handleDragEnd : undefined}
        onClick={() => {
          // Suppress clear after a resize or marquee just finished
          if (justFinishedResizeRef.current) { justFinishedResizeRef.current = false; return; }
          if (selBoxDraggedRef.current) { selBoxDraggedRef.current = false; return; }
          if (activeTool === 'select' || activeTool === 'connector') clearSelection();
        }}
        draggable={stageDraggable}
        onMouseDown={handleDrawMouseDown}
        onMouseMove={handleDrawMouseMove}
        onMouseUp={handleDrawMouseUp}
      >
        <Layer>
          {objects.map((obj) => renderObject(obj))}

          {/* Freehand draw preview */}
          {isDrawing && livePoints.length >= 4 && (
            <Line points={livePoints} stroke="#1a1a1a" strokeWidth={2}
              lineCap="round" lineJoin="round" tension={0.3} listening={false} />
          )}

          {/* Rect-draw preview */}
          {liveRect && (
            <Rect x={liveRect.x} y={liveRect.y} width={liveRect.width} height={liveRect.height}
              fill="rgba(23,162,184,0.08)" stroke="#17a2b8" strokeWidth={1.5} dash={[6, 3]} listening={false} />
          )}

          {/* Marquee selection box */}
          {selBox && (
            <Rect x={selBox.x} y={selBox.y} width={selBox.width} height={selBox.height}
              fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1.5} dash={[5, 3]} listening={false} />
          )}

          {/* Group selection bounding box (shown when ≥2 objects selected) */}
          {groupBBox && (
            <Rect x={groupBBox.x} y={groupBBox.y} width={groupBBox.width} height={groupBBox.height}
              fill="transparent" stroke="#17a2b8" strokeWidth={1} dash={[6, 4]}
              opacity={0.7} listening={false} />
          )}

          {/* Resize handles for single selected object */}
          {renderResizeHandles()}

          {/* Connector-tool: connection point indicators */}
          {activeTool === 'connector' && hoveredObjectId && renderConnectionPoints(hoveredObjectId)}

          {/* Connector-tool: live preview */}
          {isConnecting && connectorStartRef.current && (
            <>
              <Circle x={connectorStartRef.current.x} y={connectorStartRef.current.y}
                radius={5} fill="#17a2b8" listening={false} />
              {liveConnectorEnd && (
                <Line
                  points={[connectorStartRef.current.x, connectorStartRef.current.y, liveConnectorEnd.x, liveConnectorEnd.y]}
                  stroke="#17a2b8" strokeWidth={2} dash={[6, 3]} listening={false}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>

      {/* Sticky-note text editor */}
      {editingObj && (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); } }}
          style={getTextareaStyle(editingObj)}
        />
      )}

      {/* Connector properties panel */}
      {selectedConnector && connectorPanelPos && (
        <div
          style={{
            position: 'fixed',
            left: connectorPanelPos.x,
            top: connectorPanelPos.y - 70,
            transform: 'translateX(-50%)',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '6px 10px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.13)',
            display: 'flex', alignItems: 'center', gap: 8,
            zIndex: 200, userSelect: 'none',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555' }}>
            <span>Color</span>
            <input type="color" value={selectedConnector.connectorProperties?.color ?? '#000000'}
              style={{ width: 28, height: 24, padding: 1, border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer' }}
              onChange={(e) => updateConnectorProps({ color: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555' }}>
            <span>Width</span>
            <input type="range" min={1} max={8} value={selectedConnector.connectorProperties?.thickness ?? 2}
              style={{ width: 56, accentColor: '#17a2b8' }}
              onChange={(e) => updateConnectorProps({ thickness: parseInt(e.target.value) })} />
          </label>
          <select value={selectedConnector.connectorProperties?.arrowhead ?? 'one-way'}
            style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#333' }}
            onChange={(e) => updateConnectorProps({ arrowhead: e.target.value as 'none' | 'one-way' | 'two-way' })}>
            <option value="none">Line</option>
            <option value="one-way">→ Arrow</option>
            <option value="two-way">↔ Both</option>
          </select>
          <button style={{ fontSize: 13, color: '#dc3545', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
            title="Delete connector" onClick={() => deleteObject(selectedConnector.id)}>✕</button>
        </div>
      )}
    </div>
  );
}
