export const SYSTEMS = {
  gamegear:  { name: 'Game Gear',        core: 'segaGG',  extensions: ['.gg'] },
  nes:       { name: 'NES',              core: 'nes',     extensions: ['.nes'] },
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
