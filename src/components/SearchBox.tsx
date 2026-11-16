import { useState } from 'react';
import { usePlaceSearch } from '../hooks/usePlaceSearch';
import type { CategorySearch, SearchResult, SearchBounds } from '../types';

interface SearchBoxProps {
  onResultClick: (result: SearchResult) => void;
  onCategoryResults: (
    results: SearchResult[],
    category: CategorySearch,
    selected?: SearchResult,
  ) => void;
  onClose: () => void;
  /** Callback that returns the current map viewport bounds, or null if unknown */
  getBounds?: () => SearchBounds | null;
}

export default function SearchBox({ onResultClick, onCategoryResults, onClose, getBounds }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const {
    results, category, truncated, loading, error, hasSearched, search, clear,
  } = usePlaceSearch();

  function finish() {
    clear();
    setQuery('');
    onClose();
  }

  function handleSelect(result: SearchResult) {
    if (category) onCategoryResults(results, category, result);
    else onResultClick(result);
    finish();
  }

  function handleShowAll() {
    if (!category || results.length === 0) return;
    onCategoryResults(results, category);
    finish();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void search(query, getBounds?.() ?? undefined);
      }}
      aria-busy={loading}
    >
      <div className="form-group">
        <label htmlFor="search-places-input">Search query</label>
        <div className="search-form-row">
          <input
            id="search-places-input"
            type="search"
            className="search-input"
            placeholder="Search places or categories…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              clear();
            }}
            aria-label="Search places and categories within viewport"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" disabled={loading || query.trim().length < 2}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {loading && <p className="search-status" role="status">Searching…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {truncated && (
        <p className="search-status">Showing the first {results.length} results. Zoom in to narrow the area.</p>
      )}

      {results.length > 0 && (
        <ul className="search-results" role="listbox" aria-label="Search suggestions">
          {results.map((result, index) => (
            <li key={result.id ?? `${result.lat},${result.lon},${index}`} role="presentation">
              <button
                type="button"
                role="option"
                className="search-result-item"
                onClick={() => handleSelect(result)}
              >
                <span className="result-name">{result.displayName}</span>
                <span className="result-type">{result.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && hasSearched && results.length === 0 && !error && (
        <p className="search-status">No results found</p>
      )}

      <div className="modal-actions search-actions">
        {category && results.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={handleShowAll}>
            Show all {results.length} on map
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
