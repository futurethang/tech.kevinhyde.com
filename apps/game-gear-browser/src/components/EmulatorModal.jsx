import { useEffect, useRef, useState } from 'react';

export function EmulatorModal({ game, onClose, onAddToRecent }) {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!game || !containerRef.current) return;

    // Track that this game was played
    onAddToRecent(game);

    // Clear any existing emulator
    containerRef.current.innerHTML = '';

    // Create emulator div
    const gameDiv = document.createElement('div');
    gameDiv.id = 'game';
    gameDiv.style.width = '100%';
    gameDiv.style.height = '100%';
    containerRef.current.appendChild(gameDiv);

    // Configure EmulatorJS
    window.EJS_player = '#game';
    window.EJS_core = 'segaGG';
    window.EJS_gameUrl = game.romUrl;
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_startOnLoaded = true;
    window.EJS_color = '#1a1a2e';
    window.EJS_backgroundColor = '#0a0a12';

    // Enable save states to localStorage
    window.EJS_gameName = game.title;

    // Callback when ready
    window.EJS_onGameStart = () => {
      setIsLoading(false);
    };

    // Load EmulatorJS script
    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    script.async = true;
    script.onload = () => {
      // Script loaded, emulator will initialize
    };
    script.onerror = () => {
      setError('Failed to load emulator. Please try again.');
      setIsLoading(false);
    };
    document.body.appendChild(script);

    // Cleanup on unmount
    return () => {
      // Remove the script
      script.remove();

      // Clean up EmulatorJS globals
      delete window.EJS_player;
      delete window.EJS_core;
      delete window.EJS_gameUrl;
      delete window.EJS_pathtodata;
      delete window.EJS_startOnLoaded;
      delete window.EJS_color;
      delete window.EJS_backgroundColor;
      delete window.EJS_gameName;
      delete window.EJS_onGameStart;

      // Try to clean up any EJS instances
      if (window.EJS_emulator) {
        try {
          window.EJS_emulator = null;
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [game, onAddToRecent]);

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen?.();
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
      <div className={`bg-gg-dark rounded-lg overflow-hidden shadow-2xl flex flex-col ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-4xl mx-4'}`}>
        {/* Header */}
        <div className="bg-gg-blue px-4 py-3 flex items-center justify-between border-b border-gg-accent">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-white truncate">{game.title}</h2>
            <span className="text-xs text-gray-400">
              {game.publisher} {game.year && `(${game.year})`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gg-darker">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gg-highlight mb-4"></div>
              <p className="text-gray-400">Loading {game.title}...</p>
              <p className="text-xs text-gray-500 mt-2">This may take a moment on first load</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gg-darker">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gg-highlight mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-white mb-2">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-gg-highlight hover:text-red-400"
              >
                Reload page
              </button>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Controls info */}
        {!isFullscreen && (
          <div className="bg-gg-blue px-4 py-3 border-t border-gg-accent">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">Arrow Keys</kbd> D-Pad</span>
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">Z</kbd> Button 1</span>
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">X</kbd> Button 2</span>
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">Enter</kbd> Start</span>
              <span><kbd className="bg-gg-darker px-1.5 py-0.5 rounded">Shift</kbd> Select</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmulatorModal;
