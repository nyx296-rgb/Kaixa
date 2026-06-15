// components/Toolbar/ParseErrorReportModal.tsx
import React from 'react';
import { X, AlertTriangle, FileDown, Bug } from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';

export default function ParseErrorReportModal() {
  const showErrorsModal = useEmailStore((s) => s.showErrorsModal);
  const setShowErrorsModal = useEmailStore((s) => s.setShowErrorsModal);
  const parseErrors = useEmailStore((s) => s.parseErrors);
  const activeMailbox = useEmailStore((s) => s.activeMailbox);

  if (!showErrorsModal) return null;

  const exportCsv = () => {
    if (!parseErrors.length) return;
    
    const headers = ['Folder', 'Index', 'Type', 'Detail'];
    const rows = parseErrors.map(e => [
      `"${(e.folder_path || '').replace(/"/g, '""')}"`,
      e.message_index ?? '',
      `"${(e.error_type || '').replace(/"/g, '""')}"`,
      `"${(e.error_detail || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `parse_errors_${activeMailbox?.name || 'mailbox'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="glass rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border)] bg-rose-500/10">
          <div className="flex items-center gap-2">
            <Bug size={16} className="text-rose-400" />
            <h2 className="text-[14px] font-semibold text-rose-100">Relatório de Corrupção e Erros</h2>
          </div>
          <button
            onClick={() => setShowErrorsModal(false)}
            className="p-1 rounded-md hover:bg-white/10 transition-colors text-rose-400 hover:text-rose-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] text-slate-300">
              Foram encontrados <strong className="text-rose-400">{parseErrors.length}</strong> problemas ao indexar este mailbox.
            </p>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <FileDown size={13} />
              Exportar CSV
            </button>
          </div>

          <div className="border border-[var(--glass-border)] rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px] text-slate-300">
              <thead className="bg-white/5 text-slate-200">
                <tr>
                  <th className="px-3 py-2 font-medium w-[20%]">Pasta</th>
                  <th className="px-3 py-2 font-medium w-[10%]">Índice</th>
                  <th className="px-3 py-2 font-medium w-[15%]">Tipo</th>
                  <th className="px-3 py-2 font-medium w-[55%]">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {parseErrors.map((err, i) => (
                  <tr key={err.id || i} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 truncate max-w-[150px]" title={err.folder_path}>
                      {err.folder_path || '-'}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400">
                      {err.message_index ?? '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 whitespace-nowrap">
                        {err.error_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400 font-mono text-[10px] break-words whitespace-pre-wrap">
                      {err.error_detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-[var(--glass-border)]">
          <button
            onClick={() => setShowErrorsModal(false)}
            className="btn btn-ghost text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
