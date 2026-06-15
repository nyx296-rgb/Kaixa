// useAttachmentViewer.ts
import { create } from 'zustand';
import { Attachment } from '../lib/api';

interface AttachmentViewerState {
  isOpen: boolean;
  selectedAttachment: Attachment | null;
  openViewer: (attachment: Attachment) => void;
  closeViewer: () => void;
}

export const useAttachmentViewer = create<AttachmentViewerState>((set) => ({
  isOpen: false,
  selectedAttachment: null,
  openViewer: (attachment) => set({ isOpen: true, selectedAttachment: attachment }),
  closeViewer: () => set({ isOpen: false, selectedAttachment: null }),
}));

export type { Attachment };
