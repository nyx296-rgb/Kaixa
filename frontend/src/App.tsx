import React, { useEffect, useState } from 'react';
import ThreePaneLayout from './components/Layout/ThreePaneLayout';
import Sidebar from './components/Sidebar/Sidebar';
import EmailList from './components/EmailList/EmailList';
import EmailViewer from './components/EmailViewer/EmailViewer';
import MailboxImportModal from './components/Toolbar/MailboxImportModal';
import MailboxManagerModal from './components/Toolbar/MailboxManagerModal';
import TagManagerModal from './components/Toolbar/TagManagerModal';
import ParseErrorReportModal from './components/Toolbar/ParseErrorReportModal';
import LoginPage from './components/Auth/LoginPage';
import AdminPanel from './components/Auth/AdminPanel';
import { useEmailStore } from './store/emailStore';
import { useAuthStore } from './store/authStore';
import { Keyboard, X } from 'lucide-react';
import BetaBanner from './components/Layout/BetaBanner';
import LGPDBanner from './components/Layout/LGPDBanner';
import TopBar from './components/Layout/TopBar';

export default function App() {
  const { user, isLoading, loadFromStorage, isSuperadmin } = useAuthStore();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const showImportModal = useEmailStore((s) => s.showImportModal);
  const setShowImportModal = useEmailStore((s) => s.setShowImportModal);
  const showManagerModal = useEmailStore((s) => s.showManagerModal);
  const showTagManagerModal = useEmailStore((s) => s.showTagManagerModal);
  const emails = useEmailStore((s) => s.emails);
  const selectedEmailId = useEmailStore((s) => s.selectedEmailId);
  const selectEmail = useEmailStore((s) => s.selectEmail);

  // Zoom is managed inside EmailViewer

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'j': {
          e.preventDefault();
          if (emails.length === 0) return;
          if (!selectedEmailId) { selectEmail(emails[0].id); return; }
          const idx = emails.findIndex(em => em.id === selectedEmailId);
          if (idx !== -1 && idx < emails.length - 1) {
            selectEmail(emails[idx + 1].id);
            document.getElementById(`email-row-${emails[idx + 1].id}`)?.scrollIntoView({ block: 'nearest' });
          }
          break;
        }
        case 'k': {
          e.preventDefault();
          if (emails.length === 0) return;
          if (!selectedEmailId) { selectEmail(emails[emails.length - 1].id); return; }
          const idx = emails.findIndex(em => em.id === selectedEmailId);
          if (idx > 0) {
            selectEmail(emails[idx - 1].id);
            document.getElementById(`email-row-${emails[idx - 1].id}`)?.scrollIntoView({ block: 'nearest' });
          }
          break;
        }
        case 'o': {
          e.preventDefault();
          setShowImportModal(true);
          break;
        }
        case 'p': {
          e.preventDefault();
          if (selectedEmailId) useEmailStore.getState().exportSelectedPdf();
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [emails, selectedEmailId, selectEmail, setShowImportModal]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="skeleton" style={{ width: 200, height: 20 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <LGPDBanner />
      </>
    );
  }

  return (
    <>
      {!isSuperadmin() && <BetaBanner />}
      <LGPDBanner />

      <div className="flex flex-col h-screen overflow-hidden">
        {/* ── Unified Top Bar: email actions (left) + user controls (right) ── */}
        <TopBar
          onShowAdmin={() => setShowAdmin(true)}
          onShowShortcuts={() => setShowShortcuts(true)}
        />

        {/* ── Three-pane layout fills remaining height ── */}
        <div className="flex-1 overflow-hidden h-full">
          <ThreePaneLayout
            sidebar={<Sidebar />}
            emailList={<EmailList />}
            emailViewer={<EmailViewer />}
          />
        </div>
      </div>

      {showImportModal && <MailboxImportModal />}
      {showManagerModal && <MailboxManagerModal />}
      {showTagManagerModal && <TagManagerModal />}
      <ParseErrorReportModal />
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="attachment-modal-overlay flex items-center justify-center p-4">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-5 py-4 border-b border-[var(--border-primary)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard size={18} className="text-[var(--accent-indigo)]" />
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Atalhos de Teclado</h2>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 bg-[var(--bg-primary)]">
              {[
                ['Próximo e-mail', 'J'],
                ['E-mail anterior', 'K'],
                ['Abrir Mailbox', 'O'],
                ['Exportar PDF', 'P'],
                ['Zoom +', 'Ctrl +'],
                ['Zoom −', 'Ctrl −'],
                ['Zoom 100%', 'Ctrl 0'],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
                  <kbd className="kbd">{key}</kbd>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] flex justify-end">
              <button onClick={() => setShowShortcuts(false)} className="btn btn-primary">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
