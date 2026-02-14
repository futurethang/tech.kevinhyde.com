import { useState, useCallback } from 'react';
import { GameGrid, SearchBar, FilterPanel, SettingsPanel } from './components';
import { RecentlyPlayed } from './components/RecentlyPlayed';
import { launchEmulator } from './components/EmulatorModal';
import { useGames } from './hooks/useGames';
import { useFavorites, useRecentlyPlayed } from './hooks/useLocalStorage';
import { useSettings } from './hooks/useSettings';

function App() {
  const {
    games,
    totalGames,
    searchQuery,
    setSearchQuery,
    filters,
    updateFilter,
    resetFilters,
    sortBy,
    setSortBy,
    filterOptions,
  } = useGames();

  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recentlyPlayed, addToRecent, clearRecent } = useRecentlyPlayed();
  const { settings, updateSetting, getProxiedUrl, isConfigured } = useSettings();

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handlePlay = useCallback((game) => {
    if (!isConfigured) {
      setShowSettings(true);
      return;
    }
    addToRecent(game);
    launchEmulator(game, getProxiedUrl);
  }, [isConfigured, getProxiedUrl, addToRecent]);

  const displayedGames = showFavoritesOnly
    ? games.filter(game => favorites.includes(game.id))
    : games;

  return (
    <div className="min-h-screen bg-gg-dark">
      {/* Header */}
      <header className="bg-gg-blue border-b border-gg-accent sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-gg-teal to-gg-highlight rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Retro Browser</h1>
                <p className="text-xs text-gray-400 hidden sm:block">Play classic games in your browser</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 sm:max-w-md">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search games..."
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Settings button */}
              <button
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-lg border transition-colors ${
                  isConfigured
                    ? 'border-gg-accent text-gray-400 hover:text-white hover:border-gg-teal'
                    : 'border-yellow-600 text-yellow-400 hover:text-yellow-300 animate-pulse'
                }`}
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Favorites toggle */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  showFavoritesOnly
                    ? 'bg-gg-highlight border-gg-highlight text-white'
                    : 'border-gg-accent text-gray-400 hover:text-white hover:border-gg-teal'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill={showFavoritesOnly ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="hidden sm:inline">Favorites</span>
                {favorites.length > 0 && (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">
                    {favorites.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Setup banner */}
      {!isConfigured && (
        <div className="bg-yellow-900/30 border-b border-yellow-800">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <p className="text-yellow-300 text-sm">
              Configure a CORS proxy in Settings to enable game playback.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm px-3 py-1 rounded bg-yellow-800 text-yellow-200 hover:bg-yellow-700 transition-colors"
            >
              Setup
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Recently Played */}
        <RecentlyPlayed
          games={recentlyPlayed}
          onPlay={handlePlay}
          onClear={clearRecent}
        />

        {/* Filters */}
        <div className="mb-6">
          <FilterPanel
            filters={filters}
            onFilterChange={updateFilter}
            onReset={resetFilters}
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterOptions={filterOptions}
            totalGames={totalGames}
            filteredCount={displayedGames.length}
          />
        </div>

        {/* Games Grid */}
        <GameGrid
          games={displayedGames}
          onPlay={handlePlay}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
        />
      </main>

      {/* Footer */}
      <footer className="bg-gg-blue border-t border-gg-accent mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <p>
              Game data sourced from{' '}
              <a
                href="https://archive.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gg-teal hover:text-white transition-colors"
              >
                Internet Archive
              </a>
              {' '}| Powered by{' '}
              <a
                href="https://emulatorjs.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gg-teal hover:text-white transition-colors"
              >
                EmulatorJS
              </a>
            </p>
            <div className="flex items-center gap-4">
              <span>Gamepad / Xbox controller supported</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdateSetting={updateSetting}
          isConfigured={isConfigured}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
