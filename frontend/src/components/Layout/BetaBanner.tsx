import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function BetaBanner() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'var(--accent-amber)',
      color: '#fff',
      padding: '4px 16px',
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
      zIndex: 9999,
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <AlertCircle size={14} />
      <span>Versão Beta</span>
    </div>
  );
}
