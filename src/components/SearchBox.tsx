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
    // Only autofocus on larger screens so mobile keyboard doesn't instantly block view
    if (window.innerWidth >= 640) {
      inputRef.current?.focus();
    }
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
        <label htmlFor="search-places-input">Search query</label>
        <input
          id="search-places-input"
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search places… (e.g. restaurants in view)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search places within viewport"
        />
      </div>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginBottom: 12 }}>
        {getBounds
          ? 'Results are scoped to the current map view.'
          : 'Search worldwide — pan & zoom to scope results.'}
      </p>

      {loading && <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>Searching…</p>}
      {error && <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--danger)' }}>{error}</p>}

      {results.length > 0 && (
        <ul className="search-results" role="listbox" aria-label="Search suggestions">
          {results.map((r, i) => (
            <li key={i} role="presentation">
              <button
                type="button"
                role="option"
                className="search-result-item"
                onClick={() => handleSelect(r)}
              >
                <span>{r.displayName}</span>
                <span className="result-type">{r.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && query.length >= 2 && results.length === 0 && !error && (
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginTop: 8 }}>
          No results found
        </p>
      )}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
