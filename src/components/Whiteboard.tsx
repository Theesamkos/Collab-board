import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group } from 'react-konva';
import Konva from 'konva';
import { useBoardStore } from '../store/boardStore';
import { BoardObject } from '../store/boardStore';

export function Whiteboard() {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    objects, panX, panY, zoom,
    setPan, setZoom,
    addObject, updateObject, selectObject, clearSelection,
    activeTool, deleteSelectedObjects, selectedObjectIds,
  } = useBoardStore();
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [livePoints, setLivePoints] = useState<number[]>([]);
  const drawPointsRef = useRef<number[]>([]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-focus textarea when editing
  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingId]);

  // Delete key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && editingId === null) {
        // Only delete when not editing text
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        deleteSelectedObjects();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingId, deleteSelectedObjects]);

  // Cursor style based on tool
  const cursorStyle: Record<string, string> = {
    select: 'default',
    pan:    'grab',
    draw:   'crosshair',
  };

  const startEditing = (obj: BoardObject, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectObject(obj.id);
    setEditingText(obj.text || '');
    setEditingId(obj.id);
  };

  const commitEdit = () => {
    if (editingId) {
      updateObject(editingId, { text: editingText });
      setEditingId(null);
    }
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
      const mousePointTo = {
        x: (pointer.x - panX) / oldScale,
        y: (pointer.y - panY) / oldScale,
      };
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
      top: offsetY + panY + obj.y * zoom,
      width: obj.width * zoom,
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

  // ── Freehand drawing handlers ──────────────────────────────────
  const handleDrawMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'draw') return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    drawPointsRef.current = [pos.x, pos.y];
    setLivePoints([pos.x, pos.y]);
    setIsDrawing(true);
  }, [activeTool]);

  const handleDrawMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || activeTool !== 'draw') return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    drawPointsRef.current = [...drawPointsRef.current, pos.x, pos.y];
    setLivePoints([...drawPointsRef.current]);
  }, [isDrawing, activeTool]);

  const handleDrawMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const pts = drawPointsRef.current;
    drawPointsRef.current = [];
    setLivePoints([]);
    if (pts.length < 4) return; // need at least 2 points
    addObject({
      id: crypto.randomUUID(),
      type: 'line',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      points: pts,
      color: '#1a1a1a',
    });
  }, [isDrawing, addObject]);

  const editingObj = editingId ? objects.find((o) => o.id === editingId) : null;

  // Objects are draggable only in select mode; stage drags only in pan mode
  const objectsDraggable = activeTool === 'select';
  const stageDraggable = activeTool === 'pan';

  const renderObject = (obj: BoardObject) => {
    const key = obj.id;
    const isEditing = obj.id === editingId;
    const isSelected = selectedObjectIds.includes(obj.id);

    switch (obj.type) {
      case 'sticky-note':
        return (
          <Group
            key={key}
            x={obj.x}
            y={obj.y}
            draggable={objectsDraggable && !isEditing}
            onClick={(e) => {
              e.cancelBubble = true;
              selectObject(obj.id);
            }}
            onDblClick={(e) => startEditing(obj, e)}
            onDragEnd={(e) => updateObject(obj.id, { x: e.target.x(), y: e.target.y() })}
          >
            <Rect
              width={obj.width}
              height={obj.height}
              fill={obj.color || '#FFFF00'}
              stroke={isSelected ? '#17a2b8' : 'rgba(0,0,0,0.15)'}
              strokeWidth={isSelected ? 2 : 1}
              shadowBlur={isSelected ? 8 : 3}
              shadowColor={isSelected ? '#17a2b8' : 'black'}
              shadowOpacity={isSelected ? 0.3 : 0.15}
              shadowOffsetX={2}
              shadowOffsetY={2}
            />
            <Text
              text={obj.text || ''}
              width={obj.width}
              height={obj.height}
              padding={10}
              fontSize={14}
              fill="#1a1a1a"
              wrap="word"
              opacity={isEditing ? 0 : 1}
            />
          </Group>
        );

      case 'rectangle':
        return (
          <Rect
            key={key}
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill={obj.color || '#17a2b8'}
            stroke={isSelected ? '#dc3545' : 'rgba(0,0,0,0.2)'}
            strokeWidth={isSelected ? 2 : 1}
            draggable={objectsDraggable}
            onClick={(e) => {
              e.cancelBubble = true;
              selectObject(obj.id);
            }}
            onDragEnd={(e) => updateObject(obj.id, { x: e.target.x(), y: e.target.y() })}
          />
        );

      case 'circle':
        return (
          <Circle
            key={key}
            x={obj.x}
            y={obj.y}
            radius={obj.width / 2}
            fill={obj.color || '#28a745'}
            stroke={isSelected ? '#dc3545' : 'rgba(0,0,0,0.2)'}
            strokeWidth={isSelected ? 2 : 1}
            draggable={objectsDraggable}
            onClick={(e) => {
              e.cancelBubble = true;
              selectObject(obj.id);
            }}
            onDragEnd={(e) => updateObject(obj.id, { x: e.target.x(), y: e.target.y() })}
          />
        );

      case 'line':
        return (
          <Line
            key={key}
            points={obj.points || [obj.x, obj.y, obj.x + obj.width, obj.y + obj.height]}
            stroke={obj.color || '#1a1a1a'}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
            tension={0.3}
            onClick={(e) => {
              e.cancelBubble = true;
              selectObject(obj.id);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="canvas-bg"
      style={{ position: 'relative', cursor: cursorStyle[activeTool] ?? 'default' }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height - 60}
        x={panX}
        y={panY}
        scaleX={zoom}
        scaleY={zoom}
        onWheel={handleWheel}
        onDragEnd={stageDraggable ? handleDragEnd : undefined}
        onClick={activeTool !== 'draw' ? clearSelection : undefined}
        draggable={stageDraggable}
        onMouseDown={handleDrawMouseDown}
        onMouseMove={handleDrawMouseMove}
        onMouseUp={handleDrawMouseUp}
      >
        <Layer>
          {objects.map((obj) => renderObject(obj))}
          {isDrawing && livePoints.length >= 4 && (
            <Line
              points={livePoints}
              stroke="#1a1a1a"
              strokeWidth={2}
              lineCap="round"
              lineJoin="round"
              tension={0.3}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {editingObj && (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
          style={getTextareaStyle(editingObj)}
        />
      )}
    </div>
  );
}
