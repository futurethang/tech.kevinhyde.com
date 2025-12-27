# tech.kevinhyde.com

A monorepo for experimental mini applications and tech experiments.

## Structure

```
tech.kevinhyde.com/
├── apps/                    # All mini applications
│   ├── _template-static/    # Template: plain HTML/CSS/JS
│   ├── _template-react/     # Template: React + Vite
│   └── slot-01 to slot-05/  # Pre-created slots for rapid development
├── site/                    # The showcase website (Astro)
└── apps-manifest.json       # Registry of all apps
```

## Development

```bash
# Install dependencies
pnpm install

# Run the showcase site locally
pnpm dev --filter=site

# Build everything
pnpm build
```

## Creating a New App

1. Copy a template from `apps/_template-*` or use an available slot
2. Update `apps-manifest.json` with your app details
3. Commit and push to deploy

## Deployment

The site deploys automatically to GitHub Pages on push to `main`.

- Main site: https://tech.kevinhyde.com
- Apps: https://tech.kevinhyde.com/apps/[app-name]

## GitHub Pages Setup

1. Go to repository Settings > Pages
2. Under "Build and deployment", select "GitHub Actions"
3. The included workflow will handle builds and deployment
