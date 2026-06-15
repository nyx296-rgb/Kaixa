// components/Layout/TopBar.tsx
// Unified top bar: user controls only

import React from 'react';
import { Shield, Keyboard } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationBanner from '../Notifications/NotificationBanner';

interface TopBarProps {
  onShowAdmin: () => void;
  onShowShortcuts: () => void;
}

export default function TopBar({ onShowAdmin, onShowShortcuts }: TopBarProps) {
  const { user, isSuperadmin } = useAuthStore();

  return (
    <div
      className="flex-shrink-0 flex items-center gap-1 px-3 border-b border-[var(--border-primary)]"
      style={{
        background: 'var(--bg-secondary)',
        height: 36,
        minHeight: 36,
        zIndex: 100,
      }}
    >
      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: User controls ── */}
      <NotificationBanner />

      {isSuperadmin() && (
        <button
          onClick={onShowAdmin}
          className="btn-ghost"
          title="Painel Admin"
          style={{ padding: 6, color: 'var(--accent-amber)' }}
        >
          <Shield size={16} />
        </button>
      )}

      <button
        onClick={onShowShortcuts}
        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        title="Atalhos de teclado"
      >
        <Keyboard size={15} />
      </button>

      {/* User Badge */}
      {user && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-primary)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-full)',
            padding: '2px 10px 2px 3px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 10,
              fontWeight: 'bold',
            }}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
          <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.username}
          </span>
          <div style={{ width: 1, height: 12, background: 'var(--border-primary)' }} />
          <button
            onClick={() => useAuthStore.getState().logout()}
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-rose)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
