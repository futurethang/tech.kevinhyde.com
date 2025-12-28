# Spinner - Game Night Selector

A progressive web app that works like "spin the bottle" for game night. Place your phone in the center of the table, tap to spin, and see who it points to!

## Features

- **360-degree random selection** - Truly random using crypto.getRandomValues()
- **PWA support** - Install on your phone for quick access
- **Works offline** - No internet needed after first load
- **Haptic feedback** - Feel the spin on supported devices
- **Mobile optimized** - Works great on phones placed in table center
- **Visually appealing** - Smooth animations and modern design

## How to Use

1. Open the app on your phone
2. Place your phone in the center of the table
3. Players sit around the table
4. Tap the SPIN button or the spinner itself
5. Wait for it to stop - whoever it points to is selected!

## Installation

### As a PWA (Recommended)
1. Open the app in your mobile browser
2. Add to home screen when prompted (or use browser menu)
3. Launch from your home screen for fullscreen experience

### Development
This is a static app - no build step required. Just serve the files.

## Technical Details

- Uses `crypto.getRandomValues()` for cryptographically secure randomness
- Multiple entropy sources combined for maximum unpredictability
- CSS transitions for smooth, natural-feeling spin physics
- Service worker for offline functionality
- Responsive design works on any screen size

## Files

- `index.html` - Main app structure
- `styles.css` - Visual styling and animations
- `script.js` - Spinner logic and PWA setup
- `manifest.json` - PWA configuration
- `sw.js` - Service worker for offline support
- `icon-*.png` - App icons
