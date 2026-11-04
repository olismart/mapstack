import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalDialogProps {
  id: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ModalDialog({ id, title, onClose, children }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${id}`;

  useEffect(() => {
    // Save element that was focused before opening dialog
    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Handle Escape key
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Trap focus inside modal
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    // Initial focus on the first input or focusable element
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const initialFocus =
          dialogRef.current.querySelector<HTMLElement>('input:not([type="hidden"]), button:not(.modal-close-btn)') ||
          dialogRef.current.querySelector<HTMLElement>('button');
        initialFocus?.focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous element upon unmount
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label={`Close ${title} dialog`}
            title="Close"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
