import React from 'react';
import { Tag } from '../lib/api';
import { X } from 'lucide-react';

interface TagBadgeProps {
  tag: Tag;
  onRemove?: (tagId: string) => void;
  className?: string;
  large?: boolean;
}

function getLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const toLinear = (v: number) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function TagBadge({ tag, onRemove, className = '', large = false }: TagBadgeProps) {
  const luminance = getLuminance(tag.color.startsWith('#') ? tag.color : '#3b82f6');
  const isDark = luminance < 0.35;

  const textColor   = isDark ? '#ffffff' : '#1a1f2c';
  const bgColor     = hexToRgba(tag.color, 0.18);
  const borderColor = hexToRgba(tag.color, 0.35);

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium transition-all duration-100
        ${large ? 'px-2.5 py-0.5 text-[11px] rounded-md' : 'px-2 py-[2px] text-[10px] rounded-md'}
        ${className}
      `}
      style={{
        backgroundColor: bgColor,
        color: tag.color,
        border: `1px solid ${borderColor}`,
        letterSpacing: '0.01em',
      }}
      title={tag.name}
    >
      {/* Dot indicator */}
      <span
        className="inline-block rounded-full flex-shrink-0"
        style={{
          width: large ? 6 : 5,
          height: large ? 6 : 5,
          backgroundColor: tag.color,
          opacity: 0.9,
        }}
      />
      <span className="truncate max-w-[110px]">{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag.id);
          }}
          className="flex-shrink-0 rounded-full transition-all duration-100 hover:opacity-70"
          style={{ color: tag.color, marginLeft: 1, padding: 1 }}
          title="Remover tag"
        >
          <X size={large ? 11 : 9} />
        </button>
      )}
    </span>
  );
}
