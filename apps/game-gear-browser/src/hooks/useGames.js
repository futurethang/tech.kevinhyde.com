import { useState, useMemo, useCallback } from 'react';
import gamesData from '../data/games.json';

export function useGames() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    system: 'all',
    region: 'all',
  });
  const [sortBy, setSortBy] = useState('title');

  // Systems are static — derived from all games
  const systems = useMemo(() => {
    const set = new Set();
    gamesData.forEach(game => {
      if (game.system) set.add(game.system);
    });
    return Array.from(set).sort();
  }, []);

  // Regions are context-sensitive — derived from games matching current system filter
  const regions = useMemo(() => {
    const set = new Set();
    gamesData.forEach(game => {
      if (filters.system !== 'all' && game.system !== filters.system) return;
      if (game.region) set.add(game.region);
    });
    return Array.from(set).sort();
  }, [filters.system]);

  const filterOptions = useMemo(() => ({
    systems,
    regions,
  }), [systems, regions]);

  const filteredGames = useMemo(() => {
    let result = [...gamesData];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(game =>
        game.title.toLowerCase().includes(query)
      );
    }

    if (filters.system !== 'all') {
      result = result.filter(game => game.system === filters.system);
    }

    if (filters.region !== 'all') {
      result = result.filter(game => game.region === filters.region);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'title':
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [searchQuery, filters, sortBy]);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // When switching systems, reset region if it no longer applies
      if (key === 'system') {
        const systemGames = value === 'all'
          ? gamesData
          : gamesData.filter(g => g.system === value);
        const availableRegions = new Set(systemGames.map(g => g.region).filter(Boolean));
        if (prev.region !== 'all' && !availableRegions.has(prev.region)) {
          next.region = 'all';
        }
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({
      system: 'all',
      region: 'all',
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
