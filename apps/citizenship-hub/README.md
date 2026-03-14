# Citizenship Hub

A family collaboration web app for tracking Canadian citizenship by descent applications under Bill C-3.

## Features

- Shared family tree with document tracking
- Personalized "My Chain" views showing your line of descent
- Document link sharing (OneDrive, Google Drive, etc.)
- Activity log tracking all changes
- JSON backup/restore
- Real-time sync via Firebase Firestore

## Setup

1. Copy your Firebase config values into `src/firebase.js`
2. Update `.firebaserc` with your Firebase project ID
3. `pnpm install` and `pnpm dev` to run locally
4. `pnpm build` then `firebase deploy` to go live

## Tech Stack

- React 18 + Vite
- Firebase Firestore (real-time sync)
- All inline styles (no CSS framework)
- localStorage for per-user "ME" selection
