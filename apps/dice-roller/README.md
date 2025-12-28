# Dice Roller

A realistic 3D dice roller PWA with physics simulation. The screen edges act as the walls of a dice tray, and dice bounce realistically off each other and the walls.

## Features

- **3D Physics**: Real-time physics simulation using Three.js and Cannon-es
- **1-5 Dice**: Choose how many dice to roll
- **Realistic Bouncing**: Dice collide with walls and each other
- **Casino Aesthetic**: Green felt background with wooden trim
- **Mobile Optimized**: Designed for touch devices
- **PWA**: Install as an app on your device

## Tech Stack

- **Three.js**: 3D rendering
- **Cannon-es**: Physics engine
- **Vanilla JS**: No framework dependencies
- **PWA**: Offline-capable progressive web app

## Usage

1. Select number of dice (1-5)
2. Tap ROLL button
3. Watch the dice bounce and settle
4. See the total result

## Development

This is a static app with no build step. Simply serve the files or open `index.html`.

The app loads Three.js and Cannon-es from CDN via ES modules.
