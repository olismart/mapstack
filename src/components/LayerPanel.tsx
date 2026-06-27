import { useState } from 'react';
import type { MapLayer } from '../types';

const PRESET_COLORS = [
  '#3388ff', '#e6194b', '#3cb44b', '#ffe119', '#4363d8',
  '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
];

interface LayerPanelProps {
  layers: MapLayer[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onOpenSearch: () => void;
  onOpenGeoJSON: () => void;
  onOpenRoute: () => void;
}

export default function LayerPanel({
  layers,
  onToggle,
  onRemove,
  onRename,
  onColorChange,
  onOpenSearch,
  onOpenGeoJSON,
  onOpenRoute,
}: LayerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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
    <>
      <div className="sidebar-header">
        <h1>Mapstack</h1>
        <p>{layers.length} layer{layers.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="sidebar-content">
        {layers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#98a2b3' }}>
            <p style={{ fontSize: 13 }}>No layers yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>
              Use the buttons below to add data
            </p>
          </div>
        )}

        {layers.map((layer) => (
          <div key={layer.id} className="layer-item">
            {/* Toggle visibility */}
            <label className="toggle" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => onToggle(layer.id)}
              />
              <span className="toggle-slider" />
            </label>

            {/* Layer info */}
            <div className="layer-item-info">
              {editingId === layer.id ? (
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
                  style={{
                    width: '100%',
                    padding: '2px 6px',
                    fontSize: 13,
                    border: '1px solid #1a1a2e',
                    borderRadius: 4,
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  className="layer-item-name"
                  onDoubleClick={() => startRename(layer)}
                  title="Double-click to rename"
                >
                  {layer.name}
                </div>
              )}

              {/* Color swatches */}
              <div className="color-swatches">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch${layer.style?.color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => onColorChange(layer.id, c)}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Remove button */}
            <button
              className="btn-icon"
              onClick={() => onRemove(layer.id)}
              title="Remove layer"
              style={{ color: '#d92d20' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="btn btn-sm" onClick={onOpenSearch} title="Search places via Nominatim">
          🔍 Search
        </button>
        <button className="btn btn-sm" onClick={onOpenGeoJSON} title="Import GeoJSON from file or paste">
          📄 GeoJSON
        </button>
        <button className="btn btn-sm" onClick={onOpenRoute} title="Plan a route via OSRM">
          🗺️ Route
        </button>
      </div>
    </>
  );
}
