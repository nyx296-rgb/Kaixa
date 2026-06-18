import React, { useState } from 'react';
import { Bug, X, Send, Loader2, CheckCircle } from 'lucide-react';
import { reportBug } from '../../lib/api';

interface Props {
  onClose: () => void;
}

export default function BugReportModal({ onClose }: Props) {
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Descreva o bug encontrado.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await reportBug(description.trim(), steps.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Falha ao enviar reporte. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attachment-modal-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-primary)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug size={18} className="text-rose-400" />
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Reportar Bug</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 bg-[var(--bg-primary)]">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle size={32} className="text-emerald-400" />
              <p className="text-[13px] text-[var(--text-secondary)] text-center">
                Bug reportado com sucesso! O admin foi notificado.
              </p>
              <button onClick={onClose} className="btn btn-primary mt-2">
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Descrição do bug *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o que aconteceu..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] resize-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Passos para reproduzir (opcional)
                </label>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="1. Cliquei em...&#10;2. Acessei...&#10;3. Então..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] resize-none"
                />
              </div>
              {error && (
                <p className="text-[12px] text-rose-400">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] flex justify-end gap-2">
            <button onClick={onClose} className="btn">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !description.trim()}
              className="btn btn-primary flex items-center gap-1.5 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
