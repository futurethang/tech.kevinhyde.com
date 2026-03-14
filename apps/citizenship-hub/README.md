# 🍁 Wallace-Hyde Citizenship Hub

A shared family web app for collaborating on Canadian citizenship by descent applications under Bill C-3.

## Architecture

- **Frontend**: React 18 + Vite (inline styles, no CSS framework)
- **Backend**: Firebase Firestore (real-time sync, no server to manage)
- **Hosting**: Firebase Hosting (free tier)
- **Auth**: None required — open access via private link. "ME" selection stored in localStorage per browser.

## Setup Guide

### Prerequisites

- Node.js 18+ installed
- A Google account (for Firebase console)
- Firebase CLI: `npm install -g firebase-tools`

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"** (or "Add project")
3. Name it something like `wallace-hyde-hub`
4. Disable Google Analytics (not needed) → **Create Project**
5. Wait for it to provision, then click **Continue**

### Step 2: Enable Firestore

1. In the Firebase console sidebar, click **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll set proper rules later)
4. Select a region close to your family (e.g., `us-central1` or `us-east1`)
5. Click **Enable**

### Step 3: Register a Web App

1. On the Project Overview page, click the **Web icon** (`</>`) to add an app
2. Enter a nickname: `citizenship-hub`
3. Check **"Also set up Firebase Hosting"** → select your project
4. Click **Register app**
5. You'll see a `firebaseConfig` object — **copy those values**
6. Open `src/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← paste yours
  authDomain: "wallace-hyde-hub.firebaseapp.com",
  projectId: "wallace-hyde-hub",
  storageBucket: "wallace-hyde-hub.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

7. Also update `.firebaserc` with your project ID:

```json
{
  "projects": {
    "default": "wallace-hyde-hub"
  }
}
```

### Step 4: Deploy Firestore Rules

```bash
firebase login          # one-time auth
firebase deploy --only firestore:rules
```

This deploys the rules from `firestore.rules` which allow open read/write.
Fine for a family app shared via private link.

### Step 5: Install, Build, Deploy

```bash
npm install
npm run build
firebase deploy --only hosting
```

Firebase will give you a URL like: `https://wallace-hyde-hub.web.app`

That's it. Share that URL with the family. No accounts needed.

### Step 6 (optional): Custom Domain

If you want it at `citizenship.kevinhyde.com` or similar:

1. Firebase Console → Hosting → **Add custom domain**
2. Follow the DNS verification steps
3. Add a CNAME or A record at your registrar

### Step 7: Seed the Initial Data

The app seeds itself with the initial family data on first load (hardcoded in `INITIAL_DATA` in `App.jsx`). Once anyone opens the app and makes a change, the data gets saved to Firestore and the seed data is only used as a fallback if Firestore is empty.

If you want to restore from a backup JSON file later, use the **Backup & Restore** section in the Resources tab.

---

## File Structure

```
citizenship-hub/
├── index.html              # HTML entry point
├── package.json            # Dependencies (React, Firebase, Vite)
├── vite.config.js          # Vite build config
├── firebase.json           # Firebase Hosting config
├── .firebaserc             # Firebase project ID (edit this)
├── firestore.rules         # Firestore security rules
├── seed-data.json          # Backup of initial family data
├── CLAUDE-CODE-PROMPT.md   # Kickoff prompt for Claude Code session
└── src/
    ├── main.jsx            # React entry point
    ├── firebase.js         # Firebase config + storage layer (edit this)
    └── App.jsx             # Complete app component (~600 lines)
```

## Key Design Decisions

- **No auth**: Lowest friction for non-technical family. Security through obscurity (private URL). Add Firebase Auth later if needed.
- **Real-time sync via Firestore `onSnapshot`**: When mom adds a date, you see it appear without refreshing.
- **"ME" selection in localStorage**: Each person's view is personalized without any server-side user concept.
- **Last-write-wins**: No conflict resolution. Acceptable for 5-10 family members making occasional edits.
- **Document links, not uploads**: Files stay wherever the family already has them (OneDrive, Google Drive, etc). The hub just stores share links.
- **JSON export/import**: Full data backup available in the Resources tab. Keep regular backups.

## Adding Auth Later (Optional)

If you want to lock it down:

1. Enable **Google Sign-in** in Firebase Console → Authentication → Sign-in method
2. Add Firebase Auth to `firebase.js`
3. Update `firestore.rules` to require `request.auth != null`
4. Wrap the app in an auth check component
