# 🎮 Dice Baseball V2 - CLI-First Deployment Guide

> Deploy everything from your terminal - no browser required (except initial auth)

## Quick Start (5 minutes)

```bash
# 1. Install CLI tools (one-time setup)
chmod +x scripts/setup-cli-tools.sh
./scripts/setup-cli-tools.sh

# 2. Initialize and deploy everything
make setup     # Configure all services
make deploy    # Full deployment

# 3. Check status
make status    # See all service URLs
make health    # Verify everything is running
```

That's it! Your game is deployed and running. 🚀

---

## Table of Contents

1. [CLI Tools Overview](#cli-tools-overview)
2. [Installation](#installation)
3. [Project Commands](#project-commands)
4. [Deployment Workflow](#deployment-workflow)
5. [Service Management](#service-management)
6. [Troubleshooting](#troubleshooting)

---

## CLI Tools Overview

| Tool | Purpose | Auth Method |
|------|---------|-------------|
| **gh** | GitHub operations, repo management | Browser OAuth (one-time) |
| **supabase** | Database, auth, migrations | Access token (one-time) |
| **railway** | Backend hosting, logs, env vars | Browser OAuth (one-time) |
| **pnpm** | Package management | None |
| **jq** | JSON parsing in scripts | None |
| **httpie** | API testing | None |
| **make** | Command orchestration | None |

---

## Installation

### Automated Setup (Recommended)

```bash
# Run the setup script
./scripts/setup-cli-tools.sh

# This will install:
# - Homebrew (macOS only)
# - Node.js & pnpm
# - GitHub CLI
# - Supabase CLI
# - Railway CLI
# - jq & httpie
```

### Manual Installation

```bash
# macOS (using Homebrew)
brew install node pnpm gh supabase/tap/supabase railway jq httpie

# Linux (Ubuntu/Debian)
# Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# Supabase CLI
wget -qO- https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xvz
sudo mv supabase /usr/local/bin/

# Railway CLI
bash <(curl -fsSL https://railway.app/install.sh)

# Utilities
sudo apt-get install -y jq httpie
```

### Authentication (One-Time)

```bash
# GitHub
gh auth login
# Choose: GitHub.com → HTTPS → Login with browser

# Supabase
supabase login
# Opens browser, paste token back to terminal

# Railway
railway login
# Opens browser, confirms in terminal
```

---

## Project Commands

### Using Make (Easiest)

```bash
# Development
make dev          # Start both backend and frontend
make test         # Run all tests
make lint         # Run linters

# Database
make db-migrate   # Run migrations
make mlb-demo     # Sync 10 MLB players
make mlb-full     # Sync all 750+ MLB players

# Deployment
make deploy       # Full deployment
make status       # Show all service URLs
make logs         # Stream backend logs
make health       # Check service health

# Utilities
make clean        # Remove build artifacts
make help         # Show all commands
```

### Using Deploy Script

```bash
# Main deployment script
./scripts/deploy.sh <command>

Commands:
  init              # Initialize project
  supabase:migrate  # Run database migrations
  backend:deploy    # Deploy to Railway
  frontend:deploy   # Deploy to GitHub Pages
  mlb:sync          # Sync MLB data
  status            # Show deployment status
  full              # Complete deployment
```

### Direct CLI Commands

```bash
# Supabase
supabase start          # Start local Supabase
supabase db push        # Push migrations
supabase status         # Show connection info
supabase db reset       # Reset database

# Railway
railway up              # Deploy current directory
railway logs            # Stream logs
railway variables set KEY=value  # Set env var
railway domain          # Get deployment URL
railway down            # Take down deployment

# GitHub
gh repo view            # Show repo info
gh workflow run deploy  # Trigger deployment
gh pr create            # Create pull request
gh release create       # Create release

# pnpm (in respective directories)
pnpm install            # Install dependencies
pnpm dev                # Start dev server
pnpm build              # Build for production
pnpm test               # Run tests
```

---

## Deployment Workflow

### First-Time Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/tech.kevinhyde.com.git
cd tech.kevinhyde.com/apps/dice-baseball

# 2. Install CLI tools
./scripts/setup-cli-tools.sh

# 3. Initialize project (interactive)
./scripts/deploy.sh init
# This will:
# - Create Supabase project
# - Set up Railway project
# - Configure GitHub Pages
# - Save all credentials

# 4. Run full deployment
make deploy
```

### Subsequent Deployments

```bash
# Quick deploy (no migrations)
make deploy-quick

# Or step by step:
make deploy-backend   # Update backend
make deploy-frontend  # Update frontend
make mlb-demo        # Update MLB data
```

### CI/CD Deployment

```bash
# GitHub Actions (automatic on push to main)
git add .
git commit -m "feat: new feature"
git push origin main

# Manual trigger
gh workflow run deploy.yml

# Monitor deployment
gh run watch
```

---

## Service Management

### Database Operations

```bash
# Local development database
docker-compose up -d supabase-db

# Production database
supabase db remote commit  # Create migration from remote changes
supabase db diff           # Show differences
supabase db lint           # Check for issues

# Direct SQL
supabase db execute "SELECT * FROM users LIMIT 10"

# Backups
supabase db dump -f backup.sql  # Export
supabase db restore backup.sql  # Import
```

### Backend Management

```bash
# Deployment
railway up                      # Deploy
railway up --detach            # Deploy without logs
railway logs --tail            # Stream logs
railway logs --last 100        # Last 100 lines

# Environment variables
railway variables              # List all
railway variables set FOO=bar  # Set one
railway variables delete FOO   # Remove

# Scaling
railway scale --min 1 --max 5  # Auto-scaling

# Rollback
railway down                   # Stop current
git revert HEAD               # Revert code
railway up                    # Deploy previous
```

### Frontend Management

```bash
# Build locally
cd frontend
pnpm build
npx serve dist  # Test production build

# Deploy to GitHub Pages
gh pages build    # Trigger build
gh pages status   # Check status

# Custom domain
echo "dice-baseball.yourdomain.com" > frontend/public/CNAME
git add . && git commit -m "Add custom domain"
git push
```

### Monitoring & Logs

```bash
# Combined monitoring
make monitor   # Opens all dashboards

# Individual services
railway logs -f                    # Backend logs
supabase db logs                  # Database logs
gh run list                        # GitHub Actions logs

# Health checks
curl https://your-backend.railway.app/api/health
http GET your-backend.railway.app/api/health  # Using HTTPie

# Performance monitoring
railway metrics                   # CPU, Memory, Network
supabase usage                   # Database usage
```

---

## Troubleshooting

### Common Issues & Solutions

```bash
# Issue: "command not found"
which <command>  # Check if installed
echo $PATH       # Check PATH
source ~/.zshrc  # Reload shell config

# Issue: Authentication expired
gh auth status        # Check GitHub
railway whoami        # Check Railway
supabase projects list # Check Supabase

# Re-authenticate if needed
gh auth refresh
railway login
supabase login

# Issue: Port already in use
lsof -i :3000    # Find process using port
kill -9 <PID>    # Kill process

# Issue: Database connection failed
supabase status  # Check connection
supabase start   # Restart local Supabase
supabase db reset # Reset if corrupted

# Issue: Build failures
pnpm install --force  # Reinstall dependencies
pnpm cache clean     # Clear cache
rm -rf node_modules  # Nuclear option
```

### Debug Commands

```bash
# Verbose output
DEBUG=* pnpm dev              # Debug Node.js
railway logs --verbose        # Verbose Railway logs
supabase --debug db push      # Debug Supabase

# Test endpoints
# Using httpie (better formatted output)
http GET localhost:3000/api/health
http POST localhost:3000/api/auth/login \
  email=test@example.com \
  password=password123

# Using curl
curl -X GET http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Database queries
supabase db execute "SELECT COUNT(*) FROM mlb_players"
supabase db execute "SELECT * FROM game_sessions WHERE status='active'"

# Check file permissions
ls -la scripts/
chmod +x scripts/*.sh  # Make executable
```

### Emergency Procedures

```bash
# Full reset (CAUTION: Deletes everything)
make clean
supabase db reset
railway down
git reset --hard origin/main

# Backup before reset
supabase db dump -f backup-$(date +%Y%m%d).sql
tar -czf frontend-backup.tar.gz frontend/dist
tar -czf backend-backup.tar.gz backend/dist

# Restore from backup
supabase db restore backup-20240222.sql
tar -xzf frontend-backup.tar.gz
tar -xzf backend-backup.tar.gz

# Roll back deployment
railway deployments list      # Find previous deployment
railway rollback <deployment-id>

# Or via git
git revert HEAD
git push
make deploy
```

---

## Advanced CLI Usage

### Aliases for Speed

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Dice Baseball aliases
alias db-dev="cd ~/tech.kevinhyde.com/apps/dice-baseball && make dev"
alias db-deploy="cd ~/tech.kevinhyde.com/apps/dice-baseball && make deploy"
alias db-logs="cd ~/tech.kevinhyde.com/apps/dice-baseball && make logs"
alias db-status="cd ~/tech.kevinhyde.com/apps/dice-baseball && make status"

# Supabase shortcuts
alias supa="supabase"
alias supa-up="supabase start"
alias supa-down="supabase stop"

# Railway shortcuts
alias rail="railway"
alias rail-up="railway up --detach"
alias rail-logs="railway logs -f"
```

### Custom Scripts

Create `scripts/custom.sh` for your workflow:

```bash
#!/bin/bash
# Daily deployment routine

echo "🌅 Good morning! Starting daily deployment..."

# Pull latest changes
git pull origin main

# Run tests
make test || { echo "Tests failed!"; exit 1; }

# Deploy
make deploy-quick

# Sync fresh MLB data
make mlb-demo

# Check health
make health

echo "✅ Daily deployment complete!"

# Open monitoring
make monitor
```

### JSON Processing with jq

```bash
# Get specific values from API responses
curl -s localhost:3000/api/players | jq '.players[0].name'

# Filter MLB players by position
curl -s localhost:3000/api/mlb/players | \
  jq '.players[] | select(.position == "SS") | .name'

# Format output nicely
railway status --json | jq -r '.projectName + " is " + .status'

# Extract all player IDs
supabase db execute "SELECT * FROM mlb_players" | \
  jq -r '.[] | .mlb_id'
```

### Automation with cron

```bash
# Edit crontab
crontab -e

# Add daily MLB sync at 5 AM
0 5 * * * cd /path/to/dice-baseball && make mlb-full

# Health check every 30 minutes
*/30 * * * * curl -f https://your-backend.railway.app/api/health || echo "Backend down!" | mail -s "Alert" you@email.com

# Weekly backup
0 0 * * 0 cd /path/to/dice-baseball && supabase db dump -f weekly-backup.sql
```

---

## Complete CLI Workflow Example

Here's a full deployment from scratch using only CLI:

```bash
# Setup (one-time)
git clone https://github.com/yourusername/tech.kevinhyde.com.git
cd tech.kevinhyde.com/apps/dice-baseball
chmod +x scripts/*.sh
./scripts/setup-cli-tools.sh

# Authenticate services
gh auth login
supabase login
railway login

# Initialize project
./scripts/deploy.sh init

# Development workflow
make dev                    # Start local servers
# Make your changes...
make test                   # Run tests
git add .
git commit -m "feat: awesome new feature"

# Deploy to production
make deploy                 # Full deployment
make mlb-demo              # Add MLB players
make status                # Check everything
make health                # Verify it's working

# Monitor
make logs                  # Watch backend logs
open $(railway domain)     # Open backend in browser
```

---

## 🎉 Congratulations!

You now have a fully CLI-managed deployment pipeline. No clicking required!

**Quick Reference Card:**
```bash
make help        # Show all commands
make status      # Check deployment
make logs        # View logs
make deploy      # Deploy everything
make health      # Check if working
```

**Support:**
- Railway Discord: https://discord.gg/railway
- Supabase Discord: https://discord.gg/supabase
- GitHub CLI Docs: https://cli.github.com/manual/