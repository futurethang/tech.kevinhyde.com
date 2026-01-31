import { useState } from 'react';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect fill="#1a1a2e" width="200" height="150"/>
  <text fill="#0f3460" font-size="14" font-family="sans-serif" text-anchor="middle" x="100" y="70">Game Gear</text>
  <text fill="#0f3460" font-size="12" font-family="sans-serif" text-anchor="middle" x="100" y="90">No Image</text>
</svg>
`);

export function GameCard({ game, onPlay, isFavorite, onToggleFavorite }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const regionBadgeColor = {
    'US': 'bg-blue-600',
    'EU': 'bg-green-600',
    'JP': 'bg-red-600',
    'World': 'bg-purple-600',
    'BR': 'bg-yellow-600',
    'KR': 'bg-pink-600',
    'AU': 'bg-orange-600',
  };

  return (
    <div className="game-card bg-gg-blue rounded-lg overflow-hidden border border-gg-accent hover:border-gg-teal transition-all cursor-pointer group">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-gg-darker overflow-hidden">
        {!imageLoaded && (
          <div className="absolute inset-0 skeleton" />
        )}
        <img
          src={imageError ? PLACEHOLDER_IMAGE : game.boxartUrl}
          alt={game.title}
          className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(game);
            }}
            className="bg-gg-highlight hover:bg-red-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transform scale-90 group-hover:scale-100 transition-transform"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Play
          </button>
        </div>

        {/* Region badge */}
        <span className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded ${regionBadgeColor[game.region] || 'bg-gray-600'}`}>
          {game.region}
        </span>

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(game.id);
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 transition-colors ${isFavorite ? 'text-gg-highlight fill-current' : 'text-white'}`}
            fill={isFavorite ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-3" onClick={() => onPlay(game)}>
        <h3 className="font-semibold text-white truncate text-sm" title={game.title}>
          {game.title}
        </h3>
        <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
          <span>{game.publisher || 'Unknown'}</span>
          <span>{game.year || '—'}</span>
        </div>
      </div>
    </div>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="bg-gg-blue rounded-lg overflow-hidden border border-gg-accent">
      <div className="aspect-[4/3] skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-4 skeleton rounded w-3/4" />
        <div className="h-3 skeleton rounded w-1/2" />
      </div>
    </div>
  );
}

export default GameCard;
