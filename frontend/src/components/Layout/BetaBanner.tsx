import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Bug } from 'lucide-react';

interface Props {
  onReportBug?: () => void;
}

export default function BetaBanner({ onReportBug }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem('beta_banner_dismissed');
    if (!isDismissed) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('beta_banner_dismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'var(--accent-amber)',
      color: '#fff',
      padding: '6px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontSize: 12,
      fontWeight: 500,
      zIndex: 9999,
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <AlertCircle size={14} className="flex-shrink-0" />
      <span>
        Versão Beta — Funcionalidades em teste. Encontrou um bug?{' '}
        <button
          onClick={onReportBug}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 12,
            padding: 0,
          }}
        >
          Reporte ao admin
        </button>
      </span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: 2,
          marginLeft: 4,
          display: 'flex',
          alignItems: 'center',
          opacity: 0.8,
        }}
        title="Fechar aviso"
      >
        <X size={14} />
      </button>
    </div>
  );
}
