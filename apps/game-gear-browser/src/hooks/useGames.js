import { useState, useMemo, useCallback } from 'react';
import gamesData from '../data/games.json';

export function useGames() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    system: 'all',
    region: 'all',
    yearStart: null,
    yearEnd: null,
    publisher: 'all',
  });
  const [sortBy, setSortBy] = useState('title');

  const filterOptions = useMemo(() => {
    const publishers = new Set();
    const regions = new Set();
    const years = new Set();
    const systems = new Set();

    gamesData.forEach(game => {
      if (game.publisher) publishers.add(game.publisher);
      if (game.region) regions.add(game.region);
      if (game.year) years.add(game.year);
      if (game.system) systems.add(game.system);
    });

    return {
      publishers: Array.from(publishers).sort(),
      regions: Array.from(regions).sort(),
      years: Array.from(years).sort((a, b) => a - b),
      systems: Array.from(systems).sort(),
    };
  }, []);

  const filteredGames = useMemo(() => {
    let result = [...gamesData];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(game =>
        game.title.toLowerCase().includes(query) ||
        (game.publisher && game.publisher.toLowerCase().includes(query))
      );
    }

    if (filters.system !== 'all') {
      result = result.filter(game => game.system === filters.system);
    }

    if (filters.region !== 'all') {
      result = result.filter(game => game.region === filters.region);
    }

    if (filters.yearStart) {
      result = result.filter(game => game.year && game.year >= filters.yearStart);
    }
    if (filters.yearEnd) {
      result = result.filter(game => game.year && game.year <= filters.yearEnd);
    }

    if (filters.publisher !== 'all') {
      result = result.filter(game => game.publisher === filters.publisher);
    }

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
      system: 'all',
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
