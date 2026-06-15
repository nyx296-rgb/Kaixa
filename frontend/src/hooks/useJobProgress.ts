// hooks/useJobProgress.ts
// SSE hook to stream real-time job progress updates

import { useEffect, useRef } from 'react';
import type { JobProgress } from '../lib/api';
import { useEmailStore } from '../store/emailStore';

export function useJobProgress(jobId: string | null) {
  const setJobProgress = useEmailStore((s) => s.setJobProgress);
  const setShowImportModal = useEmailStore((s) => s.setShowImportModal);
  const loadMailboxes = useEmailStore((s) => s.loadMailboxes);
  const setActiveMailbox = useEmailStore((s) => s.setActiveMailbox);
  const esRef = useRef<(EventSource & { hasReloadedPartials?: boolean }) | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    esRef.current = es;

    es.addEventListener('progress', (e) => {
      try {
        const data: JobProgress = JSON.parse(e.data);
        setJobProgress(data);

        // Auto-load mailboxes when at least 10% is processed to allow partial navigation
        if (data.progress >= 10 && esRef.current && !esRef.current.hasReloadedPartials) {
          if (esRef.current) esRef.current.hasReloadedPartials = true;
          loadMailboxes();
        }

        // Auto-open mailbox when ready
        if (data.status === 'ready') {
          es.close();
          // Reload mailboxes and activate the new one
          loadMailboxes().then(() => {
            // The mailbox_id needs to come from somewhere;
            // for now we reload and let the user pick from the list
          });
        }
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('done', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobProgress({ status: data.status, progress: 100, indexed: 0, total: 0 });
      } catch { /* ignore */ }
      es.close();
    });

    es.addEventListener('error', () => {
      // SSE can reconnect automatically, but if it fails we close
      // es.close();
    });

    return () => {
      es.close();
    };
  }, [jobId, setJobProgress, loadMailboxes, setShowImportModal, setActiveMailbox]);
}
