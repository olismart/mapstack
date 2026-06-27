import { useState, useRef } from 'react';
import type { GeoJSON } from 'geojson';

interface GeoJSONUploaderProps {
  onImport: (name: string, data: GeoJSON) => void;
  onClose: () => void;
}

export default function GeoJSONUploader({ onImport, onClose }: GeoJSONUploaderProps) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
      // Auto-name from file name
      if (!name) {
        setName(file.name.replace(/\.geojson$/i, '').replace(/\.json$/i, ''));
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setError('Paste GeoJSON or upload a file');
      return;
    }

    try {
      const parsed = JSON.parse(trimmed) as GeoJSON;
      if (!parsed.type || !['Feature', 'FeatureCollection', 'GeometryCollection', ...'Point,LineString,Polygon,MultiPoint,MultiLineString,MultiPolygon'.split(',')].includes(parsed.type)) {
        throw new Error('Invalid GeoJSON type');
      }
      onImport(name || 'Imported Layer', parsed);
      onClose();
    } catch (err: any) {
      setError(`Invalid GeoJSON: ${err.message}`);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Layer Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Layer"
        />
      </div>

      <div className="form-group">
        <label>Upload File</label>
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json"
          onChange={handleFile}
          style={{ fontSize: 12 }}
        />
      </div>

      <div className="form-group">
        <label>Or paste GeoJSON</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"type":"FeatureCollection","features":[...]}'
        />
      </div>

      {error && <p style={{ fontSize: 12, color: '#d92d20', marginBottom: 8 }}>{error}</p>}

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Import Layer</button>
      </div>
    </form>
  );
}
