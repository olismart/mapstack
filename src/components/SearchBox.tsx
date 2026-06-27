import { useState, useEffect, useRef } from 'react';
import { useNominatim } from '../hooks/useNominatim';
import type { SearchResult } from '../types';

interface SearchBoxProps {
  onResultClick: (result: SearchResult) => void;
  onClose: () => void;
}

export default function SearchBox({ onResultClick, onClose }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const { results, loading, error, search, clear } = useNominatim();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

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
          placeholder="Search places… (e.g. cafes in Paris)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

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
