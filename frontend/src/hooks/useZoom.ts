// hooks/useZoom.ts
// Shared zoom hook for all viewers

import { useState, useCallback, useEffect, RefObject } from 'react';

interface UseZoomOptions {
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
  scrollTarget?: RefObject<HTMLElement | null>;
}

interface UseZoomReturn {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoom: (n: number) => void;
  zoomPercent: string;
  bindWheel: {
    onWheel: (e: React.WheelEvent) => void;
  };
}

export function useZoom({
  min = 0.5,
  max = 2.0,
  step = 0.1,
  initial = 1.0,
  scrollTarget,
}: UseZoomOptions = {}): UseZoomReturn {
  const [zoom, setZoomState] = useState(initial);

  const clamp = useCallback(
    (v: number) => Math.round(Math.min(max, Math.max(min, v)) * 100) / 100,
    [min, max],
  );

  const zoomIn = useCallback(() => setZoomState((z) => clamp(z + step)), [clamp, step]);
  const zoomOut = useCallback(() => setZoomState((z) => clamp(z - step)), [clamp, step]);
  const resetZoom = useCallback(() => setZoomState(initial), [initial]);
  const setZoom = useCallback((n: number) => setZoomState(clamp(n)), [clamp]);

  // Ctrl+scroll on target element
  useEffect(() => {
    const el = scrollTarget?.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -step : step;
        setZoomState((z) => clamp(z + delta));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [scrollTarget, clamp, step]);

  // Keyboard: Ctrl+= / Ctrl+- / Ctrl+0
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, resetZoom]);

  const bindWheel = {
    onWheel: (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -step : step;
        setZoomState((z) => clamp(z + delta));
      }
    },
  };

  return {
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    zoomPercent: `${Math.round(zoom * 100)}%`,
    bindWheel,
  };
}
