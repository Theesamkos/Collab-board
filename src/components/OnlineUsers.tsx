import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../context/AuthContext';
import { colorForUser } from '../lib/cursorColors';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function OnlineUsers() {
  const { session } = useAuth();
  const users = usePresence();
  const currentUserId = session?.user?.id;

  const count = users.length;
  if (count === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '60px',
        right: '16px',
        zIndex: 10,
        minWidth: '160px',
        maxWidth: '220px',
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '10px',
        padding: '10px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#999999',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {/* Pulse dot */}
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#28a745',
            flexShrink: 0,
            animation: 'presence-pulse 2s ease-in-out infinite',
          }}
        />
        {count} {count === 1 ? 'user' : 'users'} online
      </div>

      {/* User list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {users.map((user) => {
          const color = colorForUser(user.userId);
          const isYou = user.userId === currentUserId;

          return (
            <div
              key={user.userId}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {/* Avatar circle with initials */}
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.02em',
                }}
              >
                {initials(user.userName)}
              </div>

              {/* Name */}
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: isYou ? 600 : 500,
                  color: '#1a1a1a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.userName}
                {isYou && (
                  <span style={{ color: '#999999', fontWeight: 400, marginLeft: '4px' }}>
                    (you)
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
