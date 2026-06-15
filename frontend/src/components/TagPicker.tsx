import React, { useState, useEffect } from 'react';
import { Tag, createTag, assignTagToEmail, removeTagFromEmail } from '../lib/api';
import { useEmailStore } from '../store/emailStore';
import TagBadge from './TagBadge';
import { Plus, Check, PlusCircle, Search } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#facc15', // yellow
  '#22c55e', // green
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
];

interface TagPickerProps {
  emailId: string;
  emailTags: Tag[];
}

export default function TagPicker({ emailId, emailTags }: TagPickerProps) {
  const { tags: globalTags, loadTags, updateEmailTags } = useEmailStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[6]); // indigo

  useEffect(() => {
    if (open) {
      loadTags();
      setSearch('');
    }
  }, [open, loadTags]);

  const assignedTagIds = new Set(emailTags.map(t => t.id));

  const filteredTags = globalTags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = globalTags.find(t => t.name.toLowerCase() === search.toLowerCase());

  const handleAssign = async (tag: Tag) => {
    try {
      setLoading(true);
      await assignTagToEmail(emailId, tag.id);
      updateEmailTags(emailId, [...emailTags, tag]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (tagId: string) => {
    try {
      setLoading(true);
      await removeTagFromEmail(emailId, tagId);
      updateEmailTags(emailId, emailTags.filter(t => t.id !== tagId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAssign = async () => {
    if (!search.trim()) return;
    try {
      setLoading(true);
      const newTag = await createTag(search.trim(), selectedColor);
      await loadTags();
      await assignTagToEmail(emailId, newTag.id);
      updateEmailTags(emailId, [...emailTags, newTag]);
      setSearch('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {emailTags.map(tag => (
        <TagBadge key={tag.id} tag={tag} onRemove={() => handleRemove(tag.id)} />
      ))}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-medium rounded-md border border-dashed transition-all duration-150 cursor-pointer"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-indigo)';
              e.currentTarget.style.color = 'var(--accent-indigo)';
              e.currentTarget.style.background = 'rgba(99,102,241,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'transparent';
            }}
            title="Adicionar Tag"
          >
            <Plus size={10} /> Tag
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            style={{
              zIndex: 9995,
              width: 240,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            className="animate-scaleIn"
          >
            {/* Search input */}
            <div style={{ position: 'relative' }}>
              <Search
                size={12}
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Buscar ou criar tag…"
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px 6px 26px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 150ms',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-indigo)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Tag list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
              {filteredTags.length > 0 ? filteredTags.map(tag => {
                const isAssigned = assignedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => isAssigned ? handleRemove(tag.id) : handleAssign(tag)}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 6px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                      transition: 'background 120ms',
                      width: '100%',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <TagBadge tag={tag} />
                    {isAssigned && (
                      <Check size={12} style={{ color: 'var(--accent-indigo)', flexShrink: 0 }} />
                    )}
                  </button>
                );
              }) : (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                  {search.trim() ? 'Nenhuma tag encontrada' : 'Sem tags criadas'}
                </p>
              )}
            </div>

            {/* Create new tag */}
            {search.trim() !== '' && !exactMatch && (
              <div
                style={{
                  paddingTop: 10,
                  borderTop: '1px solid var(--border-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Criar: <span style={{ fontStyle: 'italic' }}>"{search}"</span>
                </span>

                {/* Color palette */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: selectedColor === c
                          ? `2px solid var(--text-primary)`
                          : '2px solid transparent',
                        cursor: 'pointer',
                        transform: selectedColor === c ? 'scale(1.2)' : 'scale(1)',
                        transition: 'transform 120ms, border 120ms',
                        boxShadow: selectedColor === c ? `0 0 0 1px ${c}40` : 'none',
                        outline: 'none',
                        flexShrink: 0,
                      }}
                      title={c}
                    />
                  ))}
                </div>

                <button
                  onClick={handleCreateAndAssign}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '7px 0',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    background: 'var(--gradient-brand)',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    transition: 'opacity 150ms, filter 150ms',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                >
                  <PlusCircle size={13} />
                  Criar e Atribuir
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
