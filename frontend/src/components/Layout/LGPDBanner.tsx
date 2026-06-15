import React, { useState, useEffect } from 'react';

export default function LGPDBanner() {
  const [accepted, setAccepted] = useState(true);

  useEffect(() => {
    const isAccepted = localStorage.getItem('lgpd_accepted');
    if (!isAccepted) {
      setAccepted(false);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('lgpd_accepted', 'true');
    setAccepted(true);
  };

  if (accepted) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: 24,
      right: 24,
      maxWidth: 600,
      margin: '0 auto',
      backgroundColor: 'var(--bg-elevated)',
      color: 'var(--text-primary)',
      padding: '20px 24px',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      zIndex: 99999,
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      border: '1px solid var(--border-primary)',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
        <strong>Privacidade e Cookies (LGPD):</strong> Utilizamos cookies e tecnologias semelhantes para fornecer recursos essenciais e melhorar sua experiência no Kaixa. 
        Ao continuar utilizando a plataforma, você concorda com nosso uso de cookies e o processamento de seus dados de acordo com a Lei Geral de Proteção de Dados.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={handleAccept}
          className="btn-primary"
          style={{ 
            padding: '8px 24px', 
            fontSize: 13, 
            fontWeight: 600,
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          Aceitar e Continuar
        </button>
      </div>
    </div>
  );
}
