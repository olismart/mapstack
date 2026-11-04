import { useState, useEffect, useRef, useCallback } from 'react';
import { useNominatim } from '../hooks/useNominatim';
import type { SearchResult, SearchBounds } from '../types';

interface SearchBoxProps {
  onResultClick: (result: SearchResult) => void;
  onClose: () => void;
  /** Callback that returns the current map viewport bounds, or null if unknown */
  getBounds?: () => SearchBounds | null;
}

export default function SearchBox({ onResultClick, onClose, getBounds }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const { results, loading, error, search, clear } = useNominatim();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Snapshot map bounds on every keystroke so results stay scoped to the viewport
  const doSearch = useCallback((q: string) => {
    search(q, getBounds?.() ?? undefined);
  }, [search, getBounds]);

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  function handleSelect(result: SearchResult) {
    onResultClick(result);
    clear();
    setQuery('');
    onClose();
  }

  return (
    <div>
      <div className="form-group">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search places… (e.g. restaurants in view)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p style={{ fontSize: 11, color: '#98a2b3', marginBottom: 12 }}>
        {getBounds
          ? 'Results are scoped to the current map view.'
          : 'Search worldwide — pan & zoom to scope results.'}
      </p>

      {loading && <p style={{ fontSize: 12, color: '#667085' }}>Searching…</p>}
      {error && <p style={{ fontSize: 12, color: '#d92d20' }}>{error}</p>}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li
              key={i}
              className="search-result-item"
              onClick={() => handleSelect(r)}
            >
              {r.displayName}
              <span className="result-type">{r.type}</span>
            </li>
          ))}
        </ul>
      )}

      {!loading && query.length >= 2 && results.length === 0 && !error && (
        <p style={{ fontSize: 12, color: '#98a2b3', marginTop: 8 }}>
          No results found
        </p>
      )}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
