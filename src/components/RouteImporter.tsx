import { useState } from 'react';
import type { GeoJSON } from 'geojson';
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
          className={`profile-btn import-source-btn${source === 'komoot' ? ' active' : ''}`}
          aria-pressed={source === 'komoot'}
          onClick={() => setSource('komoot')}
        >
          Komoot link
        </button>
        <button
          type="button"
          className={`profile-btn import-source-btn${source === 'file' ? ' active' : ''}`}
          aria-pressed={source === 'file'}
          onClick={() => setSource('file')}
        >
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
