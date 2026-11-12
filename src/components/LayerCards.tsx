import React, { useState } from 'react';
import type { MapLayer } from '../types';
import { Eye, EyeOff, Trash2, Edit2, Check, Layers } from 'lucide-react';

interface LayerCardsProps {
  layers: MapLayer[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onFocusLayer?: (layer: MapLayer) => void;
}

export default function LayerCards({
  layers,
  onToggle,
  onRemove,
  onRename,
  onFocusLayer,
}: LayerCardsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (layers.length === 0) return null;

  function startRename(layer: MapLayer) {
    setEditingId(layer.id);
    setEditName(layer.name);
  }

  function commitRename(id: string) {
    if (editName.trim()) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="layer-card-stack">
      {[...layers].reverse().map((layer) => (
        <div
          key={layer.id}
          className={`layer-card ${!layer.visible ? 'layer-card-hidden' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`Layer: ${layer.name}. Click or press Enter to zoom to route`}
          onClick={() => onFocusLayer?.(layer)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                onFocusLayer?.(layer);
              }
            }
          }}
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
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(layer.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  aria-label={`Edit name for layer ${layer.name}`}
                />
                <button
                  type="button"
                  className="layer-btn-icon"
                  onClick={() => commitRename(layer.id)}
                  title="Save name"
                  aria-label={`Save name for layer ${layer.name}`}
                >
                  <Check size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div
                className="layer-card-title"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(layer);
                }}
                title="Double-click to rename"
              >
                {layer.name}
              </div>
            )}
          </div>

          <div className="layer-card-actions" onClick={(e) => e.stopPropagation()}>
            {editingId !== layer.id && (
              <button
                type="button"
                className="layer-btn-icon"
                onClick={() => startRename(layer)}
                title="Rename"
                aria-label={`Rename layer ${layer.name}`}
              >
                <Edit2 size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            )}

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
