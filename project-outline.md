# Tech Monorepo Scaffold Plan

> **Purpose**: This document serves as both a specification and an executable prompt. Hand this to a Claude Code session to scaffold the complete monorepo structure for `tech.kevinhyde.com`.

-----

## Project Overview

Create a monorepo that serves as:

1. **A showcase site** at `tech.kevinhyde.com` listing all mini apps
1. **A container for experimental apps** ranging from static HTML to full-stack with databases
1. **A mobile-first development platform** where new apps can be created via Claude Code mobile with minimal friction

The goal is **zero-friction app creation**: describe an app idea → Claude Code creates it in the monorepo → auto-deploys to a stable URL.

-----

## Directory Structure

```
tech.kevinhyde.com/
├── apps/                           # All mini applications live here
│   ├── _template-static/           # Template: plain HTML/CSS/JS
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── script.js
│   │   └── README.md
│   ├── _template-react/            # Template: React + Vite
│   │   ├── src/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── README.md
│   ├── _template-next/             # Template: Next.js (for apps needing API routes)
│   │   ├── app/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── README.md
│   ├── _template-worker/           # Template: Cloudflare Worker + static frontend
│   │   ├── src/
│   │   ├── functions/
│   │   ├── wrangler.toml
│   │   └── README.md
│   └── [app-name]/                 # Actual apps go here (see Slot Apps below)
│
├── site/                           # The showcase website itself
│   ├── src/
│   │   ├── components/
│   │   │   ├── AppCard.tsx         # Card component for each app
│   │   │   ├── AppGrid.tsx         # Grid layout of all apps
│   │   │   └── Header.tsx
│   │   ├── pages/
│   │   │   ├── index.tsx           # Home: grid of all apps
│   │   │   └── about.tsx           # About the tech experiments
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── lib/
│   │       └── getApps.ts          # Reads apps/manifest.json
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   └── tsconfig.json
│
├── packages/                       # Shared code (optional, for future use)
│   └── ui/                         # Shared UI components if needed
│       ├── src/
│       └── package.json
│
├── apps-manifest.json              # Registry of all apps (auto-generated + manual)
├── vercel.json                     # Root routing configuration
├── package.json                    # Workspace root
├── pnpm-workspace.yaml             # Workspace definition
├── turbo.json                      # Turborepo config (optional but recommended)
├── CLAUDE.md                       # Instructions for Claude Code sessions
└── README.md
```

-----

## Core Files to Create

### 1. `apps-manifest.json`

This is the source of truth for all apps. The showcase site reads this to generate the grid.

```json
{
  "apps": [
    {
      "slug": "example-app",
      "name": "Example App",
      "description": "A brief description of what this app does",
      "type": "static | react | next | worker",
      "status": "live | wip | idea",
      "createdAt": "2025-01-15",
      "tags": ["audio", "visualization", "tool"],
      "path": "/apps/example-app",
      "liveUrl": "/apps/example-app",
      "thumbnail": "/apps/example-app/thumbnail.png"
    }
  ],
  "slots": [
    { "slug": "slot-01", "available": true },
    { "slug": "slot-02", "available": true },
    { "slug": "slot-03", "available": true },
    { "slug": "slot-04", "available": true },
    { "slug": "slot-05", "available": true }
  ]
}
```

### 2. `vercel.json` (Root)

Handles routing from the main domain to individual apps.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/apps/:app/:path*", "destination": "/apps/:app/:path*" },
    { "source": "/:path*", "destination": "/site/:path*" }
  ],
  "buildCommand": "pnpm turbo build",
  "outputDirectory": "site/.next"
}
```

### 3. `pnpm-workspace.yaml`

```yaml
packages:
  - 'site'
  - 'apps/*'
  - 'packages/*'
```

### 4. `package.json` (Root)

```json
{
  "name": "tech-kevinhyde",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "new-app": "node scripts/new-app.js"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### 5. `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### 6. `CLAUDE.md`

This is critical—it tells Claude Code how to work in this repo.

```markdown
# Claude Code Instructions for tech.kevinhyde.com

## Repository Purpose
This is a monorepo for experimental mini applications. Each app lives in `/apps/[app-name]/`.

## Creating a New App

### Quick Start (Use a Slot)
For fast iteration, use pre-created slots:
1. Check `apps-manifest.json` for available slots
2. Navigate to `apps/slot-XX/`
3. Build the app there
4. Update `apps-manifest.json` with app details
5. Commit and push (triggers auto-deploy)

### From Template
1. Copy the appropriate template from `apps/_template-*`
2. Rename to your app slug (lowercase, hyphens only)
3. Update `apps-manifest.json`
4. Build the app
5. Commit and push

## App Types

### Static (`_template-static`)
- Plain HTML/CSS/JS
- No build step required
- Best for: simple tools, visualizations, single-page experiments

### React (`_template-react`)  
- Vite + React
- Run `pnpm install` then `pnpm dev` locally
- Best for: interactive apps, component-heavy UIs

### Next.js (`_template-next`)
- Next.js with App Router
- Includes API routes capability
- Best for: apps needing server functions, database access

### Worker (`_template-worker`)
- Cloudflare Workers + static frontend
- `wrangler.toml` for configuration
- Best for: apps needing backend logic, external API calls

## Deployment

All apps deploy automatically on push to `main`:
- Vercel handles the build and hosting
- Each app is available at `tech.kevinhyde.com/apps/[slug]`
- The showcase site auto-updates based on `apps-manifest.json`

## File Conventions

Each app MUST have:
- `README.md` - Brief description
- `thumbnail.png` - 800x600 screenshot for showcase grid

Each app SHOULD have:
- Descriptive entry in `apps-manifest.json`
- Clear, self-documenting code

## Database/Persistence Options

If the app needs data persistence, use one of:
- **Vercel KV** - Key-value store (add to `vercel.json` in app folder)
- **Vercel Postgres** - Full SQL database
- **Cloudflare D1** - SQLite at the edge (for Worker apps)
- **localStorage** - Client-side only, no account needed

## Git Workflow

1. Create feature branch: `git checkout -b app/[app-name]`
2. Build the app
3. Update manifest
4. Commit with message: `feat(apps): add [app-name] - [brief description]`
5. Push and create PR (or push directly to main for quick iterations)

## Common Commands

```bash
# Install dependencies
pnpm install

# Run site locally
pnpm dev --filter=site

# Run specific app locally
pnpm dev --filter=[app-name]

# Build everything
pnpm build

# Deploy (happens automatically on push, but manual if needed)
vercel --prod
```

## Mobile Development Notes

When working via Claude Code mobile:

1. Keep changes focused and atomic
1. Use slots for fastest iteration
1. Let Claude Code handle the full implementation
1. Review the PR before merging

## Showcase Site

The site at `/site` automatically reads `apps-manifest.json` and displays:

- App grid with thumbnails
- Filter by tags
- Status indicators (live/wip/idea)
- Direct links to each app

No manual updates needed—just update the manifest.

```
---

## Slot Apps (Pre-Created Empty Apps)

Create 5 slot apps for mobile-first rapid development. Each slot is a minimal static app ready to be overwritten.

### `apps/slot-01/index.html` (repeat for slot-01 through slot-05)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Slot 01 - Available</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a2e;
      color: #eee;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { color: #00d4ff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Slot 01</h1>
    <p>This slot is available for a new app.</p>
    <p><small>Replace this with your app code.</small></p>
  </div>
</body>
</html>
```

-----

## Showcase Site Components

### `site/src/lib/getApps.ts`

```typescript
import manifest from '../../../apps-manifest.json';

export interface App {
  slug: string;
  name: string;
  description: string;
  type: 'static' | 'react' | 'next' | 'worker';
  status: 'live' | 'wip' | 'idea';
  createdAt: string;
  tags: string[];
  path: string;
  liveUrl: string;
  thumbnail?: string;
}

export function getApps(): App[] {
  return manifest.apps.filter(app => !app.slug.startsWith('slot-'));
}

export function getAppBySlug(slug: string): App | undefined {
  return manifest.apps.find(app => app.slug === slug);
}

export function getAvailableSlots(): string[] {
  return manifest.slots.filter(s => s.available).map(s => s.slug);
}
```

### `site/src/components/AppCard.tsx`

```tsx
import type { App } from '../lib/getApps';

interface AppCardProps {
  app: App;
}

export function AppCard({ app }: AppCardProps) {
  return (
    <a 
      href={app.liveUrl} 
      className="app-card"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="thumbnail">
        {app.thumbnail ? (
          <img src={app.thumbnail} alt={app.name} />
        ) : (
          <div className="placeholder">{app.name[0]}</div>
        )}
      </div>
      <div className="content">
        <h3>{app.name}</h3>
        <p>{app.description}</p>
        <div className="meta">
          <span className={`status status-${app.status}`}>{app.status}</span>
          <span className="type">{app.type}</span>
        </div>
        <div className="tags">
          {app.tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      </div>
    </a>
  );
}
```

### `site/src/pages/index.tsx`

```tsx
import { getApps } from '../lib/getApps';
import { AppCard } from '../components/AppCard';
import { Header } from '../components/Header';

export default function Home() {
  const apps = getApps();
  
  return (
    <main>
      <Header />
      <section className="intro">
        <h1>Tech Experiments</h1>
        <p>A collection of mini applications, tools, and creative coding experiments.</p>
      </section>
      <section className="app-grid">
        {apps.map(app => (
          <AppCard key={app.slug} app={app} />
        ))}
      </section>
    </main>
  );
}
```

-----

## Setup Commands

After scaffolding, run these commands:

```bash
# Initialize git if not already
git init

# Install dependencies
pnpm install

# Create initial commit
git add .
git commit -m "chore: initial monorepo scaffold"

# Connect to GitHub
gh repo create tech.kevinhyde.com --public --source=. --push

# Connect to Vercel
vercel link
vercel --prod
```

-----

## DNS/Domain Setup (Manual Steps)

1. In Vercel dashboard, add custom domain: `tech.kevinhyde.com`
1. In your DNS provider (Cloudflare?), add:
- CNAME: `tech` → `cname.vercel-dns.com`
1. Wait for SSL certificate provisioning

-----

## Success Criteria

After scaffold is complete:

- [ ] `pnpm install` runs without errors
- [ ] `pnpm dev` starts the showcase site
- [ ] All 5 slot apps are accessible at `/apps/slot-01` through `/apps/slot-05`
- [ ] `apps-manifest.json` contains slot entries
- [ ] `CLAUDE.md` is comprehensive and accurate
- [ ] Templates exist for static, react, next, and worker apps
- [ ] The showcase site displays a “no apps yet” state or sample app

-----

## Next Steps After Scaffold

1. **Add a sample app** to validate the full workflow
1. **Test mobile flow**: Create an app using Claude Code mobile
1. **Set up Vercel environment variables** if any apps need them
1. **Optional**: Add Blink Shell + Tailscale for full CLI access from mobile

-----

*This document is both human-readable documentation and a Claude Code prompt. Hand it to a Claude Code session with: “Scaffold this monorepo structure following this specification exactly.”*