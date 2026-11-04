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
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={`layer-card ${!layer.visible ? 'layer-card-hidden' : ''}`}
          onClick={() => onFocusLayer?.(layer)}
        >
          <div className="layer-card-main">
            <span className="layer-card-dot" />

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
                />
                <button
                  type="button"
                  className="layer-btn-icon"
                  onClick={() => commitRename(layer.id)}
                  title="Save name"
                >
                  <Check size={14} />
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
              >
                <Edit2 size={13} />
              </button>
            )}

            <button
              type="button"
              className={`layer-btn-icon ${!layer.visible ? 'layer-btn-muted' : ''}`}
              onClick={() => onToggle(layer.id)}
              title={layer.visible ? 'Hide on map' : 'Show on map'}
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            <button
              type="button"
              className="layer-btn-icon layer-btn-danger"
              onClick={() => onRemove(layer.id)}
              title="Delete layer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
