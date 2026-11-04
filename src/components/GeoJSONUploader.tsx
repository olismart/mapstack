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
        <label htmlFor="upload-layer-name">Layer Name</label>
        <input
          id="upload-layer-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label id="upload-file-label">File (.gpx, .geojson, .json)</label>
        <input
          id="upload-file-input"
          ref={fileRef}
          type="file"
          accept=".geojson,.json,.gpx,application/json,application/gpx+xml"
          onChange={handleFile}
          style={{ display: 'none' }}
          aria-labelledby="upload-file-label"
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fileRef.current?.click()}
          aria-label={selectedFileName ? `Change file, currently ${selectedFileName}` : 'Choose GPX or GeoJSON file to upload'}
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
              <FileCheck size={18} strokeWidth={2} aria-hidden="true" />
              <span style={{ fontWeight: 600 }}>Change File</span>
            </>
          ) : (
            <>
              <Upload size={18} strokeWidth={2} aria-hidden="true" />
              <span style={{ fontWeight: 600 }}>Choose File</span>
            </>
          )}
        </button>

        {selectedFileName && (
          <p
            style={{
              marginTop: 8,
              fontSize: 'var(--font-size-base)',
              color: 'var(--text-secondary)',
              wordBreak: 'break-all',
            }}
          >
            {selectedFileName}
          </p>
        )}
      </div>

      {error && <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      <div className="modal-actions">
        <button type="submit" className="btn btn-primary" disabled={!fileContent}>
          Import Layer
        </button>
      </div>
    </form>
  );
}
