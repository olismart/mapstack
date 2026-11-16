import React, { useLayoutEffect, useRef, useState } from 'react';
import type { MapLayer } from '../types';
import { Eye, EyeOff, Trash2, Check } from 'lucide-react';

interface LayerCardsProps {
  layers: MapLayer[];
  activeLayerId: string | null;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onFocusLayer?: (layer: MapLayer) => void;
}

export default function LayerCards({
  layers,
  activeLayerId,
  onToggle,
  onRemove,
  onRename,
  onFocusLayer,
}: LayerCardsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const stackRef = useRef<HTMLDivElement>(null);
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const editFieldRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const field = editFieldRef.current;
    if (!editingId || !field) return;
    field.style.height = '0px';
    field.style.height = `${field.scrollHeight}px`;
  }, [editingId, editName]);

  if (layers.length === 0) return null;

  function startRename(layer: MapLayer) {
    setEditingId(layer.id);
    setEditName(layer.name);
  }

  function commitRename(id: string, restoreFocus = false) {
    if (editName.trim()) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
    if (restoreFocus) {
      requestAnimationFrame(() => titleButtonRef.current?.focus());
    }
  }

  function cancelRename() {
    setEditingId(null);
    requestAnimationFrame(() => titleButtonRef.current?.focus());
  }

  function activateLayer(layer: MapLayer, element: HTMLDivElement) {
    const container = stackRef.current;
    if (container) {
      const cardRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(container);
      const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
      let offset = 0;

      if (cardRect.left < containerRect.left) {
        offset = cardRect.left - containerRect.left - paddingLeft;
      } else if (cardRect.right > containerRect.right) {
        offset = cardRect.right - containerRect.right + paddingRight;
      }

      if (offset !== 0) {
        container.scrollBy({ left: offset, behavior: 'smooth' });
      }
    }
    onFocusLayer?.(layer);
  }

  return (
    <div ref={stackRef} className="layer-card-stack">
      {[...layers].reverse().map((layer) => (
        <div
          key={layer.id}
          className={`layer-card ${!layer.visible ? 'layer-card-hidden' : ''} ${activeLayerId === layer.id ? 'layer-card-active' : ''} ${editingId === layer.id ? 'layer-card-editing' : ''}`}
          role="group"
          aria-label={`Layer: ${layer.name}`}
          aria-current={activeLayerId === layer.id ? 'true' : undefined}
          onClick={(e) => activateLayer(layer, e.currentTarget)}
        >
          <div className="layer-card-main">
            <span
              className="layer-card-dot"
              style={{ backgroundColor: layer.style?.color ?? 'var(--accent)' }}
              aria-hidden="true"
            />

            {editingId === layer.id ? (
              <div
                className="layer-rename-inline"
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  ref={editFieldRef}
                  rows={1}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename(layer.id, true);
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  autoFocus
                  aria-label={`Edit name for layer ${layer.name}`}
                />
                <button
                  type="button"
                  className="layer-btn-icon"
                  onClick={() => commitRename(layer.id, true)}
                  title="Save name"
                  aria-label={`Save name for layer ${layer.name}`}
                >
                  <Check size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                ref={activeLayerId === layer.id ? titleButtonRef : undefined}
                className={`layer-card-title${activeLayerId === layer.id ? ' layer-card-title-editable' : ''}`}
                onClick={(e) => {
                  if (activeLayerId === layer.id) {
                    e.stopPropagation();
                    startRename(layer);
                  }
                }}
                title={activeLayerId === layer.id ? 'Edit route name' : 'Activate route'}
                aria-label={activeLayerId === layer.id
                  ? `Edit name for layer ${layer.name}`
                  : `Activate layer ${layer.name}`}
              >
                {layer.name}
              </button>
            )}
          </div>

          <div className="layer-card-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`layer-btn-icon ${!layer.visible ? 'layer-btn-muted' : ''}`}
              onClick={() => onToggle(layer.id)}
              title={layer.visible ? 'Hide on map' : 'Show on map'}
              aria-label={layer.visible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`}
            >
              {layer.visible ? (
                <Eye size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <EyeOff size={18} strokeWidth={2} aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              className="layer-btn-icon layer-btn-danger"
              onClick={() => onRemove(layer.id)}
              title="Delete layer"
              aria-label={`Delete layer ${layer.name}`}
            >
              <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
