import { useState, useEffect, useCallback, RefObject } from 'react';
import { Highlight, createHighlight, getHighlights, deleteHighlight } from '../lib/api';

interface UseTextHighlightOptions {
  emailId: string | null;
  containerRef: RefObject<HTMLElement | null>;
  text: string;
}

export function useTextHighlight({ emailId, containerRef, text }: UseTextHighlightOptions) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (emailId) {
      getHighlights(emailId)
        .then(setHighlights)
        .catch(console.error);
    } else {
      setHighlights([]);
    }
  }, [emailId]);

  const getAbsoluteOffset = useCallback((container: Node, node: Node, offset: number): number => {
    let absOffset = 0;
    for (let i = 0; i < container.childNodes.length; i++) {
      const child = container.childNodes[i];
      if (child === node || child.contains(node)) {
        if (child.nodeType === Node.TEXT_NODE) {
          return absOffset + offset;
        } else {
          return absOffset + getAbsoluteOffset(child, node, offset);
        }
      }
      absOffset += child.textContent?.length || 0;
    }
    return absOffset;
  }, []);

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelectionRange(null);
      setMenuPos(null);
      return;
    }

    if (!containerRef.current.contains(sel.anchorNode) || !containerRef.current.contains(sel.focusNode)) {
      return;
    }

    const startAbs = getAbsoluteOffset(containerRef.current, sel.anchorNode!, sel.anchorOffset);
    const endAbs = getAbsoluteOffset(containerRef.current, sel.focusNode!, sel.focusOffset);

    const start = Math.min(startAbs, endAbs);
    const end = Math.max(startAbs, endAbs);

    if (start === end) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionRange({ start, end, text: text.substring(start, end) });
    setMenuPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }, [containerRef, getAbsoluteOffset, text]);

  const addHighlight = async (color: string) => {
    if (!emailId || !selectionRange) return;
    try {
      const newHl = await createHighlight(emailId, selectionRange.start, selectionRange.end, color);
      setHighlights((prev) => [...prev, newHl]);
      window.getSelection()?.removeAllRanges();
      setSelectionRange(null);
      setMenuPos(null);
    } catch (e) {
      console.error('Failed to add highlight', e);
    }
  };

  const removeHighlight = async (id: string) => {
    try {
      await deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      console.error('Failed to remove highlight', e);
    }
  };

  // Helper to split text into chunks based on highlights
  const getHighlightedTextChunks = useCallback(() => {
    if (!text) return [];
    if (!highlights.length) return [{ text, highlight: null }];

    const sorted = [...highlights].sort((a, b) => a.start_pos - b.start_pos);
    const chunks: { text: string; highlight: Highlight | null }[] = [];
    let curr = 0;

    for (const hl of sorted) {
      if (hl.start_pos > curr) {
        chunks.push({ text: text.substring(curr, hl.start_pos), highlight: null });
      }
      chunks.push({ text: text.substring(Math.max(curr, hl.start_pos), hl.end_pos), highlight: hl });
      curr = Math.max(curr, hl.end_pos);
    }

    if (curr < text.length) {
      chunks.push({ text: text.substring(curr), highlight: null });
    }

    return chunks;
  }, [text, highlights]);

  return {
    highlights,
    selectionRange,
    menuPos,
    handleSelection,
    addHighlight,
    removeHighlight,
    getHighlightedTextChunks,
    clearSelection: () => {
      setSelectionRange(null);
      setMenuPos(null);
    }
  };
}
