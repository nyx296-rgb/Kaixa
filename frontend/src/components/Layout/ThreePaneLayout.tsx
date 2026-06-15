// components/Layout/ThreePaneLayout.tsx
// Three-panel email client layout with draggable resize handles

import React, { useRef, useCallback, useEffect } from 'react';
import { useEmailStore } from '../../store/emailStore';

interface ThreePaneLayoutProps {
  sidebar: React.ReactNode;
  emailList: React.ReactNode;
  emailViewer: React.ReactNode;
}

export default function ThreePaneLayout({ sidebar, emailList, emailViewer }: ThreePaneLayoutProps) {
  const sidebarWidth = useEmailStore((s) => s.sidebarWidth);
  const listWidth = useEmailStore((s) => s.listWidth);
  const setSidebarWidth = useEmailStore((s) => s.setSidebarWidth);
  const setListWidth = useEmailStore((s) => s.setListWidth);

  const draggingRef = useRef<'sidebar' | 'list' | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent, target: 'sidebar' | 'list') => {
    e.preventDefault();
    draggingRef.current = target;
    startXRef.current = e.clientX;
    startWidthRef.current = target === 'sidebar' ? sidebarWidth : listWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, listWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + delta;

      if (draggingRef.current === 'sidebar') {
        setSidebarWidth(newWidth);
      } else {
        setListWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setSidebarWidth, setListWidth]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* ── Sidebar ── */}
      <div
        className="flex-shrink-0 h-full overflow-hidden border-r border-[var(--border-primary)]"
        style={{ width: `${sidebarWidth}px` }}
      >
        {sidebar}
      </div>

      {/* ── Resize handle: Sidebar ↔ EmailList ── */}
      <div
        className="resize-handle"
        onMouseDown={(e) => handleMouseDown(e, 'sidebar')}
      />

      {/* ── Email List ── */}
      <div
        className="flex-shrink-0 h-full overflow-hidden border-r border-[var(--border-primary)]"
        style={{ width: `${listWidth}px` }}
      >
        {emailList}
      </div>

      {/* ── Resize handle: EmailList ↔ EmailViewer ── */}
      <div
        className="resize-handle"
        onMouseDown={(e) => handleMouseDown(e, 'list')}
      />

      {/* ── Email Viewer ── */}
      <div className="flex-1 h-full overflow-hidden min-w-[300px]">
        {emailViewer}
      </div>
    </div>
  );
}
