import React, { useEffect, useRef } from 'react';
import { useNotificationStore } from '../../store/notificationStore';
import { Bell, X, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
  success: <CheckCircle size={16} />,
  error: <AlertCircle size={16} />,
};

const typeColors: Record<string, string> = {
  info: 'var(--accent-blue)',
  warning: 'var(--accent-amber)',
  success: 'var(--accent-emerald)',
  error: 'var(--accent-rose)',
};

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationBanner() {
  const { notifications, unreadCount, isOpen, fetchNotifications, fetchUnreadCount, markAsRead, togglePanel } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if (isOpen) togglePanel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, togglePanel]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={togglePanel}
        className="btn-ghost"
        style={{ position: 'relative', padding: 8 }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--accent-rose)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: 340,
          maxHeight: 420,
          overflowY: 'auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9990,
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Notificações
            </span>
            <button onClick={togglePanel} className="btn-ghost" style={{ padding: 4 }}>
              <X size={14} />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markAsRead(n.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: n.read ? 'default' : 'pointer',
                  opacity: n.read ? 0.6 : 1,
                  background: n.read ? 'transparent' : 'var(--bg-hover)',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: typeColors[n.type] || typeColors.info, marginTop: 1, flexShrink: 0 }}>
                    {typeIcons[n.type] || typeIcons.info}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent-blue)',
                      flexShrink: 0,
                      marginTop: 6,
                    }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
