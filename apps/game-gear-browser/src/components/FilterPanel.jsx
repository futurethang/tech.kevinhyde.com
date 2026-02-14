import { useState } from 'react';
import { SYSTEMS } from '../data/systems';

export function FilterPanel({
  filters,
  onFilterChange,
  onReset,
  sortBy,
  onSortChange,
  filterOptions,
  totalGames,
  filteredCount,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.system !== 'all' ||
    filters.region !== 'all';

  return (
    <div className="bg-gg-blue rounded-lg border border-gg-accent p-4">
      {/* System tabs - always visible */}
      {filterOptions.systems.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => onFilterChange('system', 'all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.system === 'all'
                ? 'bg-gg-highlight text-white'
                : 'bg-gg-darker text-gray-400 hover:text-white border border-gg-accent'
            }`}
          >
            All Systems
          </button>
          {filterOptions.systems.map(sys => (
            <button
              key={sys}
              onClick={() => onFilterChange('system', sys)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.system === sys
                  ? 'bg-gg-highlight text-white'
                  : 'bg-gg-darker text-gray-400 hover:text-white border border-gg-accent'
              }`}
            >
              {SYSTEMS[sys]?.name || sys}
            </button>
          ))}
        </div>
      )}

      {/* Header - always visible */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-white hover:text-gg-highlight transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="bg-gg-highlight text-white text-xs px-2 py-0.5 rounded-full">Active</span>
            )}
          </button>

          <span className="text-gray-400 text-sm">
            {filteredCount} of {totalGames} games
          </span>
        </div>

        {/* Sort dropdown - always visible */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-gg-darker border border-gg-accent rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gg-teal"
          >
            <option value="title">Title A-Z</option>
          </select>
        </div>
      </div>

      {/* Expanded filter options */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gg-accent">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Region</label>
              <select
                value={filters.region}
                onChange={(e) => onFilterChange('region', e.target.value)}
                className="w-full bg-gg-darker border border-gg-accent rounded px-3 py-2 text-white focus:outline-none focus:border-gg-teal"
              >
                <option value="all">All Regions</option>
                {filterOptions.regions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset button */}
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={onReset}
                className="text-sm text-gg-highlight hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
