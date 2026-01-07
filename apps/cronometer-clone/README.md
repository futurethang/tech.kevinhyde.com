# CalTrack - Calorie Tracker

A simple, frictionless calorie and nutrition tracking PWA. Built to replace expensive subscription apps with a free, offline-first alternative.

## Features

- **Food Search**: Search Open Food Facts (2.8M+ products) and USDA FoodData Central
- **Barcode Scanning**: Instantly look up packaged foods by scanning their barcode
- **Quick Add**: Log calories when you can't find a food in the database
- **Daily Diary**: Track meals by breakfast, lunch, dinner, and snacks
- **Macro Tracking**: Monitor calories, protein, carbs, and fat
- **Weight Logging**: Track your weight over time
- **Goal Setting**: Set weight loss/gain goals with target dates
- **TDEE Calculator**: Automatic calorie budget based on your stats
- **Offline-First**: All data stored locally, works without internet

## Tech Stack

- React 18 + TypeScript
- Vite with PWA plugin
- Tailwind CSS
- Zustand for state management
- Dexie.js (IndexedDB wrapper)
- html5-qrcode for barcode scanning

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Data Sources

- [Open Food Facts](https://world.openfoodfacts.org/) - Free, open food database
- [USDA FoodData Central](https://fdc.nal.usda.gov/) - US government food database

## Privacy

All data is stored locally in your browser's IndexedDB. No accounts, no cloud sync, no tracking. Your data stays on your device.

## License

MIT
