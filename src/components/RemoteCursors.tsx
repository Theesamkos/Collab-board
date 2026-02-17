import { useCollab } from '../context/CollabContext';

export function RemoteCursors() {
  const { remoteCursors } = useCollab();

  return (
    <>
      {remoteCursors.map((cursor) => (
        <div
          key={cursor.userId}
          style={{
            position: 'fixed',
            left: cursor.x,
            top: cursor.y,
            pointerEvents: 'none',
            zIndex: 1000,
            transform: 'translate(-2px, -2px)',
            transition: 'left 80ms ease-out, top 80ms ease-out',
          }}
        >
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
            <path
              d="M3 3L17 11L10 13L7 19L3 3Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              fontSize: '11px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontWeight: 600,
              backgroundColor: cursor.color,
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          >
            {cursor.userName}
          </div>
        </div>
      ))}
    </>
  );
}
