# Retro Browser

Browse and play classic retro games directly in your browser. This web application provides a polished retro gaming interface powered by EmulatorJS with multi-system support.

## Features

- **300+ Game Gear titles** from the TOSEC collection (more systems coming)
- **Multi-system architecture** — ready for NES, SNES, Genesis, Game Boy, GBA, N64
- **Real-time search** — filter games instantly as you type
- **Filters** — by system, region (US/EU/JP), year, and publisher
- **Favorites** — star games you love, persisted to localStorage
- **Recently Played** — quick access to your last 10 games
- **Fullscreen mode** — immersive gaming experience
- **Gamepad / Xbox controller support** — native via EmulatorJS Gamepad API
- **Keyboard controls** — Arrow keys, Z/X for buttons, Enter for Start

## Architecture

```
Browser App (React)
  └─ EmulatorJS iframe (public/emulator.html)
       └─ ROM fetched via CORS proxy
            └─ Cloudflare Worker (worker/cors-proxy.js)
                 └─ Internet Archive
```

ROMs are fetched from Internet Archive through a Cloudflare Worker CORS proxy that adds the necessary headers. A built-in proxy is included so the app works out of the box. EmulatorJS runs in a sandboxed iframe to avoid conflicts with the React SPA.

## Setup

No configuration needed — just open the app and play! The built-in CORS proxy handles ROM fetching from Internet Archive automatically.

### Custom CORS Proxy (optional)

If you want to use your own Cloudflare Worker proxy instead of the built-in one:

1. Deploy the included worker: `npx wrangler deploy worker/cors-proxy.js --name retro-browser-proxy`
2. Click the gear icon in the app header
3. Paste your Worker URL (e.g., `https://retro-browser-proxy.your-name.workers.dev`)
4. Click "Test Connection" to verify

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- EmulatorJS (multi-core: segaGG, nes, snes9x, segaMD, gb, gba, n64)
- Internet Archive for ROM hosting
- Cloudflare Workers for CORS proxy

## Controls

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| D-Pad | Arrow Keys | D-Pad/Left Stick |
| Button 1 | Z | A |
| Button 2 | X | B |
| Start | Enter | Start |
| Select | Shift | Select |

EmulatorJS also provides an in-emulator settings menu for remapping controls.

## Development

```bash
npm install
npm run dev
npm run build
```

## Catalog Generation

The game catalog is generated from the TOSEC naming convention:

```bash
npm run generate-catalog
```

## Data Sources

- **ROMs**: [Internet Archive TOSEC Collection](https://archive.org/details/Sega_Game_Gear_TOSEC_2012_04_13)
- **Box Art**: [libretro-thumbnails](https://github.com/libretro-thumbnails/Sega_-_Game_Gear)
- **Emulator**: [EmulatorJS](https://emulatorjs.org/)

## Legal

This application does not host any ROM files. It provides an interface to access publicly available files from the Internet Archive. Use responsibly and in accordance with local laws.
