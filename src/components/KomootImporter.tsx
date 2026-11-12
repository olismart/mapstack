import { useEffect, useRef, useState } from 'react';
import type { GeoJSON } from 'geojson';
import { isGPXContent, parseGPX } from '../utils/gpx';
import { parseKomootTourUrl } from '../utils/komoot';

interface KomootImporterProps {
  onImport: (name: string, data: GeoJSON) => void;
  onClose: () => void;
}

interface KomootImportResponse {
  gpx?: unknown;
  error?: unknown;
}

export default function KomootImporter({ onImport, onClose }: KomootImporterProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      parseKomootTourUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enter a valid Komoot Tour share link.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const response = await fetch('/api/komoot/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal,
      });

      let payload: KomootImportResponse;
      try {
        payload = await response.json() as KomootImportResponse;
      } catch {
        throw new Error('The Komoot import service returned an invalid response.');
      }

      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Unable to import this Komoot Tour.',
        );
      }
      if (typeof payload.gpx !== 'string' || !isGPXContent(payload.gpx)) {
        throw new Error('Komoot returned an invalid GPX route. Try exporting the GPX manually.');
      }

      const parsed = parseGPX(payload.gpx, 'Komoot Route');
      onImport(parsed.name, parsed.geojson);
      onClose();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unable to import this Komoot Tour.');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={loading}>
      <div className="form-group">
        <label htmlFor="komoot-tour-url">Komoot Tour share link</label>
        <input
          id="komoot-tour-url"
          type="url"
          inputMode="url"
          className="search-input"
          placeholder="https://www.komoot.com/tour/123456"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="komoot-link-help"
          disabled={loading}
        />
      </div>

      <p id="komoot-link-help" className="form-help">
        In Komoot, open a planned Tour and choose Share, then Copy link. Your Komoot login is not required.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="modal-actions">
        <button type="submit" className="btn btn-primary" disabled={loading || !url.trim()}>
          {loading ? 'Importing…' : 'Import route'}
        </button>
      </div>
    </form>
  );
}
