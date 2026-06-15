import React, { useEffect, useState } from 'react';
import * as api from '../../lib/api';
import { UserPlus, Trash2, Clock, X, Loader2, Shield, Users } from 'lucide-react';

function formatDate(ts: number | null): string {
  if (!ts) return 'Sem expiração';
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysFromNow(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 86400;
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<api.BetaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', expiryDays: 30 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const expires_at = newUser.expiryDays > 0 ? daysFromNow(newUser.expiryDays) : null;
      await api.createBetaUser(newUser.username, newUser.password, expires_at);
      setNewUser({ username: '', password: '', expiryDays: 30 });
      setShowCreate(false);
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Excluir este usuário?')) return;
    try {
      await api.deleteUser(userId);
      await loadUsers();
    } catch {
      // silently fail
    }
  };

  const handleExtend = async (userId: string, days: number) => {
    const newExpiry = daysFromNow(days);
    try {
      await api.updateUser(userId, { expires_at: newExpiry });
      await loadUsers();
    } catch {
      // silently fail
    }
  };

  const isExpired = (u: api.BetaUser) => u.expires_at !== null && u.expires_at < Date.now() / 1000;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.15s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 560, maxHeight: '85vh',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'scaleIn 0.15s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={18} style={{ color: 'var(--accent-amber)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Painel Admin
            </span>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Create button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <Users size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {users.length} beta tester{users.length !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
              <UserPlus size={14} />
              Criar usuário
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <form onSubmit={handleCreate} style={{
              padding: 16, marginBottom: 16,
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Usuário
                  </label>
                  <input
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    required minLength={3}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 13,
                      background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Senha
                  </label>
                  <input
                    type="password" value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required minLength={6}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 13,
                      background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Expiração (dias)
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[7, 14, 30, 60, 90, 0].map((d) => (
                    <button
                      key={d} type="button"
                      onClick={() => setNewUser({ ...newUser, expiryDays: d })}
                      style={{
                        padding: '5px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                        border: '1px solid', cursor: 'pointer',
                        background: newUser.expiryDays === d ? 'var(--accent-blue)' : 'var(--bg-primary)',
                        borderColor: newUser.expiryDays === d ? 'var(--accent-blue)' : 'var(--border-primary)',
                        color: newUser.expiryDays === d ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {d === 0 ? 'Sem limite' : `${d}d`}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <div style={{
                  padding: '8px 10px', marginBottom: 10, fontSize: 12,
                  color: 'var(--accent-rose)', background: 'rgba(244,63,94,0.1)',
                  borderRadius: 'var(--radius-sm)',
                }}>{error}</div>
              )}
              <button type="submit" disabled={creating} className="btn btn-primary" style={{ width: '100%' }}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : 'Criar'}
              </button>
            </form>
          )}

          {/* User list */}
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum beta tester cadastrado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map((u) => (
                <div key={u.id} style={{
                  padding: '12px 14px',
                  background: isExpired(u) ? 'rgba(244,63,94,0.05)' : 'var(--bg-tertiary)',
                  border: `1px solid ${isExpired(u) ? 'rgba(244,63,94,0.2)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {u.username}
                      {isExpired(u) && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent-rose)' }}>expirado</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Criado: {formatDate(u.created_at)} · Expira: {formatDate(u.expires_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      className="btn-ghost"
                      title="Estender 30 dias"
                      onClick={() => handleExtend(u.id, 30)}
                      style={{ padding: 5 }}
                    >
                      <Clock size={13} />
                    </button>
                    <button
                      className="btn-ghost"
                      title="Excluir"
                      onClick={() => handleDelete(u.id)}
                      style={{ padding: 5, color: 'var(--accent-rose)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
