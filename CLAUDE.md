# Claude Code Instructions for tech.kevinhyde.com

## Repository Purpose

This is a monorepo for experimental mini applications and tech experiments. The site deploys to GitHub Pages at `tech.kevinhyde.com`.

- **Main site**: Showcase grid at the root
- **Apps**: Each app lives in `/apps/[app-name]/` and is accessible at `tech.kevinhyde.com/apps/[app-name]`

## Directory Structure

```
tech.kevinhyde.com/
├── apps/                    # All mini applications
│   ├── _template-static/    # Template: plain HTML/CSS/JS
│   ├── _template-react/     # Template: React + Vite
│   ├── slot-01/ to slot-05/ # Pre-created slots for rapid development
│   └── [app-name]/          # Your apps go here
├── site/                    # The showcase website (Astro)
├── packages/                # Shared code (future use)
├── apps-manifest.json       # Registry of all apps
└── dist/                    # Built output for GitHub Pages
```

## Creating a New App

### Quick Start (Use a Slot)

For fast iteration, use pre-created slots:

1. Check `apps-manifest.json` for available slots
2. Navigate to `apps/slot-XX/`
3. Build the app there (replace contents)
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
- Files are copied directly to `dist/apps/[name]/`

### React (`_template-react`)

- Vite + React
- Run `pnpm install` then `pnpm dev` locally
- Builds to `dist/` folder within app directory
- Best for: interactive apps, component-heavy UIs

## Deployment (GitHub Pages)

All apps deploy automatically on push to `main` via GitHub Actions:

1. The workflow builds the showcase site
2. Copies all static apps to `dist/apps/`
3. Builds React/Vite apps and copies output
4. Deploys everything to GitHub Pages

Each app is available at `tech.kevinhyde.com/apps/[slug]`

## File Conventions

Each app MUST have:

- `README.md` - Brief description
- `index.html` - Entry point (or built output)

Each app SHOULD have:

- `thumbnail.png` - 800x600 screenshot for showcase grid
- Entry in `apps-manifest.json`

## apps-manifest.json Structure

```json
{
  "apps": [
    {
      "slug": "my-app",
      "name": "My App",
      "description": "What this app does",
      "type": "static | react",
      "status": "live | wip | idea",
      "createdAt": "2025-01-15",
      "tags": ["tool", "game", "visualization"]
    }
  ],
  "slots": [
    { "slug": "slot-01", "available": true }
  ]
}
```

## Common Commands

```bash
# Install dependencies
pnpm install

# Run showcase site locally
pnpm dev --filter=site

# Run specific app locally
pnpm dev --filter=[app-name]

# Build everything
pnpm build

# Build just the site
pnpm build --filter=site
```

## Git Workflow

1. Create feature branch: `git checkout -b app/[app-name]`
2. Build the app
3. Update `apps-manifest.json`
4. Commit: `feat(apps): add [app-name] - [brief description]`
5. Push and create PR (or push directly to main)

## Mobile Development Notes

When working via Claude Code mobile:

1. Use slots for fastest iteration
2. Keep changes focused and atomic
3. Static apps work best (no build step needed)
4. Review the PR before merging

## Showcase Site

The site automatically reads `apps-manifest.json` and displays:

- App grid with thumbnails
- Filter by tags
- Status indicators (live/wip/idea)
- Direct links to each app

No manual updates needed beyond updating the manifest.

## Adding Database/Persistence

For apps needing data persistence:

- **localStorage** - Client-side only, simplest option
- **IndexedDB** - Client-side, larger storage
- **External APIs** - Supabase, Firebase, etc. (static apps can still call APIs)

## Troubleshooting

### App not showing in showcase

1. Check `apps-manifest.json` has the entry
2. Verify the slug matches the folder name
3. Ensure `status` is not `idea` (those may be filtered)

### Build failing

1. Run `pnpm install` at root
2. Check for TypeScript errors: `pnpm build`
3. Verify all imports resolve correctly
