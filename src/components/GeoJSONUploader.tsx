import { useState, useRef } from 'react';
import type { GeoJSON } from 'geojson';
import { Upload, FileCheck } from 'lucide-react';
import { isGPXContent, parseGPX } from '../utils/gpx';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

interface GeoJSONUploaderProps {
  onImport: (name: string, data: GeoJSON) => void;
  onClose: () => void;
}

export default function GeoJSONUploader({ onImport, onClose }: GeoJSONUploaderProps) {
  const [name, setName] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError('File exceeds 25 MB limit');
      e.target.value = '';
      return;
    }

    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setFileContent(reader.result as string);
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
    e.target.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = (fileContent || '').trim();
    if (!trimmed) {
      setError('Please choose a file to upload');
      return;
    }

    if (isGPXContent(trimmed)) {
      try {
        const parsed = parseGPX(trimmed, name || selectedFileName || 'Imported GPX Layer');
        onImport(name || parsed.name, parsed.geojson);
        onClose();
        return;
      } catch (err: any) {
        setError(`Failed to parse GPX: ${err.message}`);
        return;
      }
    }

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
      onImport(name || selectedFileName || 'Imported Layer', parsed);
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
        />
      </div>

      <div className="form-group">
        <label>File (.gpx, .geojson, .json)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json,.gpx,application/json,application/gpx+xml"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {selectedFileName ? (
            <>
              <FileCheck size={16} />
              <span style={{ fontWeight: 600 }}>{selectedFileName}</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span style={{ fontWeight: 600 }}>Choose File</span>
            </>
          )}
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      <div className="modal-actions">
        <button type="submit" className="btn btn-primary" disabled={!fileContent}>
          Import Layer
        </button>
      </div>
    </form>
  );
}
