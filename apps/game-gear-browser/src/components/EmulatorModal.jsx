import { useEffect, useState, useRef } from 'react';

/**
 * Generate an Internet Archive item ID from game metadata
 * IA pattern: gg_[Title_With_Underscores]_[Year]_[Publisher]
 */
function generateArchiveItemId(game) {
  // Clean title - replace spaces with underscores, remove special chars
  const cleanTitle = game.title
    .replace(/[':.,!?&\-()]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

  const year = game.year || '';
  const publisher = game.publisher ? game.publisher.replace(/\s+/g, '_') : '';

  // Build the item ID
  let itemId = `gg_${cleanTitle}`;
  if (year) itemId += `_${year}`;
  if (publisher) itemId += `_${publisher}`;

  return itemId;
}

export function EmulatorModal({ game, onClose, onAddToRecent }) {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate the archive.org embed URL
  const archiveItemId = game ? generateArchiveItemId(game) : null;
  const embedUrl = archiveItemId ? `https://archive.org/embed/${archiveItemId}` : null;

  useEffect(() => {
    if (!game) return;
    // Track that this game was played
    onAddToRecent(game);
  }, [game, onAddToRecent]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setError('Game not found on Internet Archive. Try a different title.');
    setIsLoading(false);
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!game) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/80">
      {/* Modal content */}
      <div
        ref={containerRef}
        className={`bg-gg-dark rounded-lg overflow-hidden shadow-2xl flex flex-col ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-4xl mx-4'}`}
      >
        {/* Header */}
        <div className="bg-gg-blue px-4 py-3 flex items-center justify-between border-b border-gg-accent">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-semibold text-white truncate">{game.title}</h2>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {game.publisher} {game.year && `(${game.year})`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Open in new tab */}
            <a
              href={`https://archive.org/details/${archiveItemId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Open on Internet Archive"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Close (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Emulator container */}
        <div className={`relative bg-black ${isFullscreen ? 'flex-1' : 'aspect-[4/3]'}`}>
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gg-darker z-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gg-highlight mb-4"></div>
              <p className="text-gray-400">Loading {game.title}...</p>
              <p className="text-xs text-gray-500 mt-2">Connecting to Internet Archive</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gg-darker z-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gg-highlight mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-white mb-2">{error}</p>
              <a
                href={`https://archive.org/search?query=game+gear+${encodeURIComponent(game.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gg-teal hover:text-cyan-400 text-sm"
              >
                Search on Internet Archive →
              </a>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            webkitallowfullscreen="true"
            mozallowfullscreen="true"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={`Play ${game.title}`}
          />
        </div>

        {/* Controls info */}
        {!isFullscreen && (
          <div className="bg-gg-blue px-4 py-3 border-t border-gg-accent">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">Arrow Keys</kbd> D-Pad</span>
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">Z</kbd> Button 1</span>
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">X</kbd> Button 2</span>
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">Enter</kbd> Start</span>
              <span className="text-gray-500">| Powered by Internet Archive</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmulatorModal;
