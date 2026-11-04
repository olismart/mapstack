import { useState, useRef } from 'react';
import type { GeoJSON } from 'geojson';
import { isGPXContent, parseGPX } from '../utils/gpx';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

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

    if (file.size > MAX_FILE_SIZE) {
      setError('File exceeds 25 MB limit');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
      // Auto-name from file name
      if (!name) {
        setName(
          file.name
            .replace(/\.geojson$/i, '')
            .replace(/\.json$/i, '')
            .replace(/\.gpx$/i, '')
        );
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
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
      setError('Paste GeoJSON/GPX or upload a file');
      return;
    }

    // Check if the content is GPX
    if (isGPXContent(trimmed)) {
      try {
        const parsed = parseGPX(trimmed, name || 'Imported GPX Layer');
        onImport(name || parsed.name, parsed.geojson);
        onClose();
        return;
      } catch (err: any) {
        setError(`Failed to parse GPX: ${err.message}`);
        return;
      }
    }

    // Otherwise parse as GeoJSON
    try {
      const parsed = JSON.parse(trimmed) as GeoJSON;
      if (
        !parsed.type ||
        ![
          'Feature',
          'FeatureCollection',
          'GeometryCollection',
          ...'Point,LineString,Polygon,MultiPoint,MultiLineString,MultiPolygon'.split(','),
        ].includes(parsed.type)
      ) {
        throw new Error('Invalid GeoJSON type');
      }
      onImport(name || 'Imported Layer', parsed);
      onClose();
    } catch (err: any) {
      setError(`Invalid GeoJSON/JSON: ${err.message}`);
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
        <label>Upload File (.geojson, .json, .gpx)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json,.gpx,application/json,application/gpx+xml"
          onChange={handleFile}
          style={{ fontSize: 12 }}
        />
      </div>

      <div className="form-group">
        <label>Or paste GeoJSON / GPX text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"type":"FeatureCollection","features":[...]} OR <?xml version="1.0"?><gpx>...'
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
