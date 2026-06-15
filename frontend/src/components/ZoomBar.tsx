// components/ZoomBar.tsx
// Reusable zoom toolbar component

import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomBarProps {
  zoom: number;
  zoomPercent: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit?: () => void;
  className?: string;
  compact?: boolean;
}

const ZoomBar: React.FC<ZoomBarProps> = ({
  zoom,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onReset,
  className = '',
  compact = false,
}) => {
  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-sm)',
        padding: '1px 2px',
      }}
    >
      <button
        onClick={onZoomOut}
        disabled={zoom <= 0.5}
        className="p-1 rounded transition-all duration-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        title="Diminuir zoom"
      >
        <ZoomOut size={compact ? 12 : 14} />
      </button>

      <span
        className="font-mono select-none cursor-pointer transition-colors duration-100"
        style={{
          fontSize: 10,
          minWidth: 34,
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
        onClick={onReset}
        title="Resetar zoom"
      >
        {zoomPercent}
      </span>

      <button
        onClick={onZoomIn}
        disabled={zoom >= 2.0}
        className="p-1 rounded transition-all duration-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        title="Aumentar zoom"
      >
        <ZoomIn size={compact ? 12 : 14} />
      </button>

      <button
        onClick={onReset}
        className="p-1 rounded transition-all duration-100 cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        title="Resetar zoom"
      >
        <RotateCcw size={compact ? 11 : 13} />
      </button>
    </div>
  );
};

export default ZoomBar;
