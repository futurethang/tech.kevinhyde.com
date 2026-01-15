# Print Cost Tracker

Track your 3D printing costs and calculate how much you're saving compared to buying products on Amazon.

## Features

- **Print Tracking**: Log prints with filament usage, time, and notes
- **Filament Management**: Track different filaments with cost per kg
- **Amazon Comparisons**: Link prints to comparable products with prices
- **Break-Even Calculator**: See progress toward ROI on your printer investment
- **Dashboard**: Visual overview of savings, costs, and statistics
- **Data Export/Import**: Full backup and restore capability (Firebase-ready)

## Data Schema

The data layer is designed for easy migration to Firebase/Firestore:

- All IDs are UUIDs (string format)
- Timestamps are ISO 8601 strings
- Collections are flat (no deep nesting)
- Export format matches Firestore document structure

## Future Enhancements

- [ ] Firebase/Firestore data persistence
- [ ] Bambu Lab Cloud API integration (auto-import prints)
- [ ] Electricity cost calculation
- [ ] Print time vs estimated time tracking
- [ ] Multi-printer support
- [ ] Charts and historical trends

## Local Development

This is a static app - just open `index.html` in a browser or serve with any static file server.

```bash
# From the app directory
python -m http.server 8080
# or
npx serve
```
