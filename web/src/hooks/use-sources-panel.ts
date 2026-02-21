
import { useState } from 'react';

export interface SourcesPanelState {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

export function useSourcesPanel(): SourcesPanelState {
  const [isOpen, setIsOpen] = useState(false);

  const openPanel = () => setIsOpen(true);
  const closePanel = () => setIsOpen(false);
  const togglePanel = () => setIsOpen((prev) => !prev);

  return { isOpen, openPanel, closePanel, togglePanel };
}
