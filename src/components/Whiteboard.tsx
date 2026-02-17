import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group } from 'react-konva';
import Konva from 'konva';
import { useBoardStore } from '../store/boardStore';
import { BoardObject } from '../store/boardStore';

export function Whiteboard() {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { objects, panX, panY, zoom, setPan, setZoom, updateObject, selectObject, clearSelection } = useBoardStore();
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingId]);

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

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Ctrl/Cmd + scroll → zoom toward cursor
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
      const newScale = oldScale * (1 + direction * 0.05);
      const clampedScale = Math.max(0.5, Math.min(3, newScale));

      const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      };

      setPan(newPos.x, newPos.y);
      setZoom(clampedScale);
    } else {
      // Plain scroll → pan
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
      border: '2px solid #555',
      borderRadius: 0,
      resize: 'none',
      outline: 'none',
      wordBreak: 'break-word',
      overflow: 'hidden',
      boxShadow: '2px 2px 5px rgba(0,0,0,0.3)',
      zIndex: 1000,
      color: '#000000',
    };
  };

  const editingObj = editingId ? objects.find((o) => o.id === editingId) : null;

  const renderObject = (obj: BoardObject) => {
    const key = obj.id;
    const isEditing = obj.id === editingId;

    switch (obj.type) {
      case 'sticky-note':
        return (
          <Group
            key={key}
            x={obj.x}
            y={obj.y}
            draggable={!isEditing}
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
              stroke={isEditing ? '#555' : 'black'}
              strokeWidth={isEditing ? 2 : 1}
              shadowBlur={5}
              shadowColor="black"
              shadowOpacity={0.3}
              shadowOffsetX={2}
              shadowOffsetY={2}
            />
            <Text
              text={obj.text || ''}
              width={obj.width}
              height={obj.height}
              padding={10}
              fontSize={14}
              fill="#000000"
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
            fill={obj.color || '#3B82F6'}
            stroke="black"
            strokeWidth={1}
            draggable
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
            fill={obj.color || '#10B981'}
            stroke="black"
            strokeWidth={1}
            draggable
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
            points={[obj.x, obj.y, obj.x + obj.width, obj.y + obj.height]}
            stroke={obj.color || '#000000'}
            strokeWidth={2}
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
    <div ref={containerRef} className="canvas-bg" style={{ position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height - 60}
        x={panX}
        y={panY}
        scaleX={zoom}
        scaleY={zoom}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={clearSelection}
        draggable
      >
        <Layer>
          {objects.map((obj) => renderObject(obj))}
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
