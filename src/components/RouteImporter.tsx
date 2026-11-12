import { useState } from 'react';
import type { GeoJSON } from 'geojson';
import { Link2, Upload } from 'lucide-react';
import GeoJSONUploader from './GeoJSONUploader';
import KomootImporter from './KomootImporter';

interface RouteImporterProps {
  onImport: (name: string, data: GeoJSON) => void;
  onClose: () => void;
}

type ImportSource = 'komoot' | 'file';

export default function RouteImporter({ onImport, onClose }: RouteImporterProps) {
  const [source, setSource] = useState<ImportSource>('komoot');

  return (
    <div>
      <div className="import-source-switch" role="group" aria-label="Route import source">
        <button
          type="button"
          className={`btn import-source-btn ${source === 'komoot' ? 'btn-secondary' : ''}`}
          aria-pressed={source === 'komoot'}
          onClick={() => setSource('komoot')}
        >
          <Link2 size={18} strokeWidth={2} aria-hidden="true" />
          Komoot link
        </button>
        <button
          type="button"
          className={`btn import-source-btn ${source === 'file' ? 'btn-secondary' : ''}`}
          aria-pressed={source === 'file'}
          onClick={() => setSource('file')}
        >
          <Upload size={18} strokeWidth={2} aria-hidden="true" />
          File upload
        </button>
      </div>

      {source === 'komoot' ? (
        <KomootImporter onImport={onImport} onClose={onClose} />
      ) : (
        <GeoJSONUploader onImport={onImport} onClose={onClose} />
      )}
    </div>
  );
}
