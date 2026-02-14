export const SYSTEMS = {
  gamegear: {
    name: 'Game Gear',
    core: 'segaGG',
    extensions: ['.gg'],
    archiveId: 'game-gear-full-set-usa',
    thumbnailRepo: 'Sega_-_Game_Gear',
  },
  nes: {
    name: 'NES',
    core: 'nes',
    extensions: ['.nes'],
    archiveId: 'ef_nintendo_entertainment_-system_-no-intro_2024-04-23',
    thumbnailRepo: 'Nintendo_-_Nintendo_Entertainment_System',
  },
  snes:      { name: 'SNES',             core: 'snes9x',  extensions: ['.smc', '.sfc'] },
  genesis:   { name: 'Genesis',          core: 'segaMD',  extensions: ['.md', '.gen'] },
  gb:        { name: 'Game Boy',         core: 'gb',      extensions: ['.gb'] },
  gba:       { name: 'Game Boy Advance', core: 'gba',     extensions: ['.gba'] },
  n64:       { name: 'Nintendo 64',      core: 'n64',     extensions: ['.n64', '.z64'] },
};

export function getCoreForSystem(systemId) {
  return SYSTEMS[systemId]?.core || 'segaGG';
}

export function getSystemName(systemId) {
  return SYSTEMS[systemId]?.name || systemId;
}
