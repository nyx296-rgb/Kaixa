import React, { useState } from 'react';
import { X, Tag as TagIcon, Trash2, Edit2, Check, XCircle } from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';
import { updateTag, deleteTag } from '../../lib/api';

const COLORS = [
  '#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
];

export default function TagManagerModal() {
  const setShowTagManagerModal = useEmailStore((s) => s.setShowTagManagerModal);
  const tags = useEmailStore((s) => s.tags);
  const loadTags = useEmailStore((s) => s.loadTags);
  const loadEmails = useEmailStore((s) => s.loadEmails);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEditStart = (tag: any) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const handleSave = async (id: string) => {
    if (!editName.trim()) return;
    try {
      setLoading(true);
      await updateTag(id, editName.trim(), editColor);
      await loadTags();
      await loadEmails();
      setEditingId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta tag? Ela será removida de todos os e-mails.")) return;
    try {
      setLoading(true);
      await deleteTag(id);
      await loadTags();
      await loadEmails();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="glass rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <TagIcon size={16} className="text-[var(--accent-indigo)]" />
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Gerenciar Tags</h2>
          </div>
          <button
            onClick={() => setShowTagManagerModal(false)}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {tags.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <p className="text-[13px]">Nenhuma tag criada.</p>
              <p className="text-[11px] mt-1">Crie tags ao visualizar um e-mail.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                  {editingId === tag.id ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 text-[13px] rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                          autoFocus
                        />
                        <button onClick={() => handleSave(tag.id)} disabled={loading || !editName.trim()} className="p-1.5 rounded bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/30">
                          <Check size={14} />
                        </button>
                        <button onClick={handleEditCancel} disabled={loading} className="p-1.5 rounded bg-[var(--accent-rose)]/20 text-[var(--accent-rose)] hover:bg-[var(--accent-rose)]/30">
                          <XCircle size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        {COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor: c,
                              border: editColor === c ? '2px solid var(--text-primary)' : '2px solid transparent'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="text-[13px] font-medium text-[var(--text-primary)]">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEditStart(tag)} disabled={loading} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(tag.id)} disabled={loading} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--accent-rose)] hover:bg-[var(--bg-hover)]">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
