// ImageViewer.tsx
import React, { useRef, useState, useEffect } from 'react';
import { Attachment } from '../../hooks/useAttachmentViewer';
import api from '../../lib/api';
import { useZoom } from '../../hooks/useZoom';
import ZoomBar from '../ZoomBar';
import { Loader2 } from 'lucide-react';

interface Props {
  attachment: Attachment;
}

const ImageViewer: React.FC<Props> = ({ attachment }) => {
  const { id, filename } = attachment;
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { zoom, zoomIn, zoomOut, resetZoom, zoomPercent, setZoom, bindWheel } = useZoom({
    min: 0.1,
    max: 5.0,
    step: 0.2,
    initial: 1.0,
    scrollTarget: containerRef,
  });

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    
    setLoading(true);
    api.get(`/attachment/${id}?inline=true`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setImgUrl(objectUrl);
        setLoading(false);
      })
      .catch(e => {
        if (!cancelled) {
          console.error(e);
          setLoading(false);
        }
      });
      
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Reset pan when reset zoom
  const handleReset = () => {
    resetZoom();
    setPan({ x: 0, y: 0 });
  };

  const handleFit = () => {
    // Basic fit logic: we could calculate aspect ratio, but for now just reset to 1.0 and pan to center
    handleReset();
  };

  return (
    <div 
      className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center select-none"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur border border-white/10 rounded p-1 shadow-lg">
        <ZoomBar
          zoom={zoom}
          zoomPercent={zoomPercent}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={handleReset}
          onFit={handleFit}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 absolute z-0">
          <Loader2 className="animate-spin" size={20} />
          Carregando imagem…
        </div>
      )}
      
      {imgUrl && (
        <img
          src={imgUrl}
          alt={filename}
          draggable={false}
          className="max-w-none transition-transform duration-75 origin-center relative z-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            maxHeight: zoom <= 1.0 ? '80vh' : 'none',
            maxWidth: zoom <= 1.0 ? '100%' : 'none',
          }}
        />
      )}
    </div>
  );
};

export default ImageViewer;
