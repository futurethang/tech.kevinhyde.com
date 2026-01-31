import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing localStorage with React state
 */
export function useLocalStorage(key, initialValue) {
  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

/**
 * Hook for managing favorites
 */
export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage('gg-favorites', []);

  const toggleFavorite = useCallback((gameId) => {
    setFavorites(prev => {
      if (prev.includes(gameId)) {
        return prev.filter(id => id !== gameId);
      }
      return [...prev, gameId];
    });
  }, [setFavorites]);

  const isFavorite = useCallback((gameId) => {
    return favorites.includes(gameId);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}

/**
 * Hook for managing recently played games
 */
export function useRecentlyPlayed() {
  const [recentlyPlayed, setRecentlyPlayed] = useLocalStorage('gg-recent', []);
  const MAX_RECENT = 10;

  const addToRecent = useCallback((game) => {
    setRecentlyPlayed(prev => {
      // Remove if already exists
      const filtered = prev.filter(g => g.id !== game.id);
      // Add to front and limit to MAX_RECENT
      return [game, ...filtered].slice(0, MAX_RECENT);
    });
  }, [setRecentlyPlayed]);

  const clearRecent = useCallback(() => {
    setRecentlyPlayed([]);
  }, [setRecentlyPlayed]);

  return { recentlyPlayed, addToRecent, clearRecent };
}

export default useLocalStorage;
