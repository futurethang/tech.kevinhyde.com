import { getCoreForSystem } from '../data/systems';

/**
 * Instead of rendering a modal, navigates to the standalone emulator page.
 * This avoids all React/iframe/StrictMode conflicts with EmulatorJS.
 */
export function launchEmulator(game, getProxiedUrl) {
  const core = getCoreForSystem(game.system || 'gamegear');
  const romUrl = getProxiedUrl(game.romUrl);

  const config = {
    core,
    romUrl,
    title: game.title,
  };

  const hash = encodeURIComponent(JSON.stringify(config));
  window.location.href = `./emulator.html#${hash}`;
}

// Keep the named export for backwards compat with component index
export function EmulatorModal() {
  return null;
}

export default EmulatorModal;
