export function RecentlyPlayed({ games, onPlay, onClear }) {
  if (games.length === 0) return null;

  return (
    <div className="bg-gg-blue rounded-lg border border-gg-accent p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gg-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recently Played
        </h2>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gg-highlight transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => onPlay(game)}
            className="flex-shrink-0 group"
          >
            <div className="w-24 h-18 bg-gg-darker rounded overflow-hidden border border-gg-accent group-hover:border-gg-teal transition-colors">
              <img
                src={game.boxartUrl}
                alt={game.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400 group-hover:text-white truncate w-24 text-center transition-colors">
              {game.title}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default RecentlyPlayed;
