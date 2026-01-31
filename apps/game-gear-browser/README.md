# Game Gear Browser

Browse and play classic Sega Game Gear games directly in your browser. This web application provides a polished retro gaming interface powered by EmulatorJS.

## Features

- **300+ Game Gear titles** from the TOSEC collection
- **Real-time search** - Filter games instantly as you type
- **Filters** - By region (US/EU/JP), year, and publisher
- **Favorites** - Star games you love, persisted to localStorage
- **Recently Played** - Quick access to your last 10 games
- **Fullscreen mode** - Immersive gaming experience
- **Gamepad support** - Native controller support via EmulatorJS
- **Keyboard controls** - Arrow keys, Z/X for buttons, Enter for Start

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- EmulatorJS (Game Gear core)
- Internet Archive for ROM hosting

## Controls

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| D-Pad | Arrow Keys | D-Pad/Left Stick |
| Button 1 | Z | A |
| Button 2 | X | B |
| Start | Enter | Start |
| Select | Shift | Select |

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Catalog Generation

The game catalog is generated from the TOSEC naming convention. To regenerate:

```bash
pnpm run generate-catalog
```

## Data Sources

- **ROMs**: [Internet Archive TOSEC Collection](https://archive.org/details/Sega_Game_Gear_TOSEC_2012_04_13)
- **Box Art**: [libretro-thumbnails](https://github.com/libretro-thumbnails/Sega_-_Game_Gear)
- **Emulator**: [EmulatorJS](https://emulatorjs.org/)

## Legal

This application does not host any ROM files. It provides an interface to access publicly available files from the Internet Archive. Use responsibly and in accordance with local laws.
