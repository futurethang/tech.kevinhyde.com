# Claude Code Kickoff Prompt

Copy and paste this as your first message in a Claude Code session to migrate
the citizenship hub into your tech.kevinhyde.com repo.

---

## Prompt

I have a complete React + Firebase project zipped at `citizenship-hub.zip` that I need to integrate into my existing repo. Here's the context:

**What this is:** A family collaboration web app for tracking Canadian citizenship by descent applications under Bill C-3. It has a shared family tree with document tracking, personalized "My Chain" views, document link sharing, activity log, and JSON backup/restore. Built with React 18, Vite, Firebase Firestore for real-time shared storage, and localStorage for per-user "ME" selection.

**What I need you to do:**

1. Unzip `citizenship-hub.zip` and review the file structure. The key files are:
   - `src/App.jsx` — the complete ~600-line React app (inline styles, no CSS framework)
   - `src/firebase.js` — Firebase config with placeholder API keys I need to fill in
   - `src/main.jsx` — React entry point
   - `index.html` — HTML shell
   - `package.json` — deps: react, react-dom, firebase, vite, @vitejs/plugin-react
   - `firebase.json` + `.firebaserc` + `firestore.rules` — Firebase hosting/DB config

2. Help me integrate this into my project structure. I'll tell you how my repo is organized once you've reviewed the files.

3. The ONE thing that needs manual configuration: `src/firebase.js` has placeholder values for `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`. I'll get those from the Firebase Console and provide them. Everything else should work as-is.

4. After integration, help me:
   - `npm install`
   - `npm run build` to verify it compiles clean
   - Set up Firebase Hosting if not already configured
   - `firebase deploy` to go live

**Important notes:**
- The app uses NO external CSS — all styles are inline React `style` objects
- Fonts are loaded via Google Fonts CDN link in the JSX
- Firebase Firestore is used for shared data (real-time `onSnapshot` listener)
- `localStorage` is used for the personal "ME" selection (no auth needed)
- The `seed-data.json` file is a backup — the app has the same data hardcoded as `INITIAL_DATA` in App.jsx for first-load bootstrapping
- Firestore rules are wide open (read/write: true) — this is intentional for a family app shared via private link

Let's start by you reviewing the files, then I'll tell you about my repo structure so we can figure out the cleanest integration path.
