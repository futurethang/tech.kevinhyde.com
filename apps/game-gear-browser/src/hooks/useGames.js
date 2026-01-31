import { useState, useMemo, useCallback } from 'react';
import gamesData from '../data/games.json';

/**
 * Hook for managing games data with filtering and sorting
 */
export function useGames() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    region: 'all',
    yearStart: null,
    yearEnd: null,
    publisher: 'all',
  });
  const [sortBy, setSortBy] = useState('title'); // title, year, publisher

  // Get unique publishers and regions for filter options
  const filterOptions = useMemo(() => {
    const publishers = new Set();
    const regions = new Set();
    const years = new Set();

    gamesData.forEach(game => {
      if (game.publisher) publishers.add(game.publisher);
      if (game.region) regions.add(game.region);
      if (game.year) years.add(game.year);
    });

    return {
      publishers: Array.from(publishers).sort(),
      regions: Array.from(regions).sort(),
      years: Array.from(years).sort((a, b) => a - b),
    };
  }, []);

  // Filter and sort games
  const filteredGames = useMemo(() => {
    let result = [...gamesData];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(game =>
        game.title.toLowerCase().includes(query) ||
        (game.publisher && game.publisher.toLowerCase().includes(query))
      );
    }

    // Region filter
    if (filters.region !== 'all') {
      result = result.filter(game => game.region === filters.region);
    }

    // Year range filter
    if (filters.yearStart) {
      result = result.filter(game => game.year && game.year >= filters.yearStart);
    }
    if (filters.yearEnd) {
      result = result.filter(game => game.year && game.year <= filters.yearEnd);
    }

    // Publisher filter
    if (filters.publisher !== 'all') {
      result = result.filter(game => game.publisher === filters.publisher);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'year':
          return (a.year || 9999) - (b.year || 9999);
        case 'publisher':
          return (a.publisher || 'ZZZ').localeCompare(b.publisher || 'ZZZ');
        case 'title':
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [searchQuery, filters, sortBy]);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({
      region: 'all',
      yearStart: null,
      yearEnd: null,
      publisher: 'all',
    });
    setSortBy('title');
  }, []);

  return {
    games: filteredGames,
    totalGames: gamesData.length,
    searchQuery,
    setSearchQuery,
    filters,
    updateFilter,
    resetFilters,
    sortBy,
    setSortBy,
    filterOptions,
  };
}

export default useGames;
