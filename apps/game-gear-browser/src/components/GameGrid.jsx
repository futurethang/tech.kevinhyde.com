import { useEffect, useRef, useState } from 'react';
import { GameCard, GameCardSkeleton } from './GameCard';

const GAMES_PER_PAGE = 48;

export function GameGrid({ games, onPlay, isFavorite, onToggleFavorite, isLoading }) {
  const [displayCount, setDisplayCount] = useState(GAMES_PER_PAGE);
  const loadMoreRef = useRef(null);

  // Reset display count when games change (e.g., new filter)
  useEffect(() => {
    setDisplayCount(GAMES_PER_PAGE);
  }, [games]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayCount < games.length) {
          setDisplayCount(prev => Math.min(prev + GAMES_PER_PAGE, games.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [displayCount, games.length]);

  const displayedGames = games.slice(0, displayCount);
  const hasMore = displayCount < games.length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-16">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 mx-auto text-gg-teal mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-white mb-2">No games found</h3>
        <p className="text-gray-400">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {displayedGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            onPlay={onPlay}
            isFavorite={isFavorite(game.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading more games...
          </div>
        </div>
      )}

      {/* Status */}
      <div className="text-center py-4 text-sm text-gray-500">
        Showing {displayedGames.length} of {games.length} games
      </div>
    </div>
  );
}

export default GameGrid;
