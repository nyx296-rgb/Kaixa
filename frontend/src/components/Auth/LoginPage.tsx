import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Mail, User, Lock, ArrowRight, Loader2, Shield } from 'lucide-react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);
  const { login, register, superadminLogin, error } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSuperadmin) {
        await superadminLogin(password);
      } else if (isRegister) {
        await register(username, password);
      } else {
        await login(username, password);
      }
    } catch {
      // error handled in store
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (fieldName: string): React.CSSProperties => ({
    width: '100%',
    padding: '12px 14px 12px 40px',
    fontSize: 14,
    background: focusField === fieldName ? 'var(--bg-secondary)' : 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderBottom: focusField === fieldName
      ? `2px solid ${isSuperadmin && fieldName === 'password' ? 'var(--accent-amber)' : 'var(--accent-blue)'}`
      : '1px solid var(--border-primary)',
    borderRadius: 0,
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'all var(--transition-fast)',
  });

  const btnPrimary: React.CSSProperties = {
    width: '100%',
    padding: '11px 16px',
    fontSize: 12,
    fontWeight: 600,
    background: isSuperadmin ? 'var(--accent-amber)' : 'var(--accent-blue)',
    color: '#fff',
    border: '1px solid transparent',
    borderRadius: 0,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'opacity var(--transition-fast)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '8px 16px',
    transition: 'all var(--transition-fast)',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        padding: '48px 40px 40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {isSuperadmin ? (
            <div style={{
              width: 48,
              height: 48,
              background: 'var(--accent-amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              borderRadius: '50%'
            }}>
              <Shield size={24} color="#fff" />
            </div>
          ) : (
            <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
              <img src="/icone_logo.png" alt="Kaixa Logo" style={{ width: 140, height: 'auto', display: 'block' }} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
            </div>
          )}
          <h1 style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Kaixa
          </h1>
          <p style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            margin: '8px 0 0',
          }}>
            {isSuperadmin ? 'Painel de administrador' : isRegister ? 'Registro de beta tester' : 'Acesse sua conta'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isSuperadmin && (
            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text-muted)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Usuário
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: focusField === 'username' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  transition: 'color var(--transition-fast)',
                }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nome de usuário"
                  required
                  minLength={3}
                  style={inputStyle('username')}
                  onFocus={() => setFocusField('username')}
                  onBlur={() => setFocusField(null)}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 28 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-muted)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {isSuperadmin ? 'Senha admin' : 'Senha'}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: focusField === 'password'
                  ? (isSuperadmin ? 'var(--accent-amber)' : 'var(--accent-blue)')
                  : 'var(--text-muted)',
                transition: 'color var(--transition-fast)',
              }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSuperadmin ? 'senha do administrador' : 'mínimo 6 caracteres'}
                required
                minLength={isSuperadmin ? 1 : 6}
                style={inputStyle('password')}
                onFocus={() => setFocusField('password')}
                onBlur={() => setFocusField(null)}
              />
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: 'var(--accent-rose)',
              background: 'rgba(244, 63, 94, 0.08)',
              borderLeft: '2px solid var(--accent-rose)',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={btnPrimary}>
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                {isSuperadmin ? 'Entrar' : isRegister ? 'Criar conta' : 'Entrar'}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {!isSuperadmin && (
            <button
              onClick={() => setIsRegister(!isRegister)}
              style={btnSecondary}
            >
              {isRegister ? 'Já tem conta? Entrar' : 'Criar conta de beta tester'}
            </button>
          )}
          <button
            onClick={() => { setIsSuperadmin(!isSuperadmin); setIsRegister(false); }}
            style={{
              ...btnSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-muted)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <Shield size={11} />
            {isSuperadmin ? 'Voltar ao login normal' : 'Entrar como administrador'}
          </button>
        </div>
      </div>
    </div>
  );
}
