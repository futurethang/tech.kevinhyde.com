# Dice Baseball V2 - Makefile
# Quick commands for deployment and development

.PHONY: help install setup deploy test dev clean status logs

# Default target
help:
	@echo "🎮 Dice Baseball V2 - CLI Commands"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install      - Install all dependencies"
	@echo "  make setup        - Set up CLI tools and initialize project"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Run development servers (backend + frontend)"
	@echo "  make dev-backend  - Run backend dev server only"
	@echo "  make dev-frontend - Run frontend dev server only"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed database with demo data"
	@echo "  make db-reset     - Reset database (CAUTION!)"
	@echo "  make mlb-demo     - Sync 10 demo MLB players"
	@echo "  make mlb-full     - Sync all MLB players (~750)"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy       - Full deployment (backend + frontend)"
	@echo "  make deploy-backend  - Deploy backend only"
	@echo "  make deploy-frontend - Deploy frontend only"
	@echo "  make deploy-quick - Quick deploy without migrations"
	@echo ""
	@echo "Monitoring:"
	@echo "  make status       - Show deployment status"
	@echo "  make logs         - Show backend logs"
	@echo "  make logs-db      - Show database logs"
	@echo "  make health       - Check all services health"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Clean build artifacts and node_modules"
	@echo "  make env          - Create .env files from examples"
	@echo "  make tunnel       - Create local tunnel for testing"

# ===============================================
# SETUP & INSTALLATION
# ===============================================

install:
	@echo "📦 Installing dependencies..."
	@cd backend && pnpm install
	@cd frontend && pnpm install
	@echo "✅ Dependencies installed"

setup:
	@echo "🔧 Setting up CLI tools..."
	@chmod +x scripts/setup-cli-tools.sh
	@chmod +x scripts/deploy.sh
	@./scripts/setup-cli-tools.sh
	@echo ""
	@echo "🚀 Initializing project..."
	@./scripts/deploy.sh init

setup-ci:
	@echo "🤖 Setting up for CI/CD..."
	@npm install -g pnpm
	@pnpm install --frozen-lockfile

# ===============================================
# DEVELOPMENT
# ===============================================

dev:
	@echo "🚀 Starting development servers..."
	@make -j 2 dev-backend dev-frontend

dev-backend:
	@echo "🔧 Starting backend dev server..."
	@cd backend && pnpm dev

dev-frontend:
	@echo "🎨 Starting frontend dev server..."
	@cd frontend && pnpm dev

test:
	@echo "🧪 Running all tests..."
	@cd backend && pnpm test
	@echo "✅ All tests passed"

test-watch:
	@echo "🧪 Running tests in watch mode..."
	@cd backend && pnpm test:watch

test-coverage:
	@echo "📊 Running tests with coverage..."
	@cd backend && pnpm test:coverage

lint:
	@echo "🔍 Running linters..."
	@cd backend && pnpm lint 2>/dev/null || true
	@cd frontend && pnpm lint 2>/dev/null || true

# ===============================================
# DATABASE OPERATIONS
# ===============================================

db-migrate:
	@echo "🗄️ Running database migrations..."
	@./scripts/deploy.sh supabase:migrate

db-seed:
	@echo "🌱 Seeding database..."
	@./scripts/deploy.sh supabase:seed

db-reset:
	@echo "⚠️ Resetting database..."
	@echo "This will DELETE all data. Are you sure? [y/N]"
	@read confirm && [ "$$confirm" = "y" ] || exit 1
	@cd supabase && supabase db reset

db-status:
	@echo "📊 Database status..."
	@cd supabase && supabase status

mlb-demo:
	@echo "⚾ Syncing demo MLB players..."
	@cd backend && pnpm run sync:demo

mlb-full:
	@echo "⚾ Syncing all MLB players (this will take ~10 minutes)..."
	@cd backend && pnpm run sync:full

# ===============================================
# DEPLOYMENT
# ===============================================

deploy: deploy-check
	@echo "🚀 Full deployment starting..."
	@./scripts/deploy.sh full

deploy-backend:
	@echo "🔧 Deploying backend..."
	@./scripts/deploy.sh backend:deploy

deploy-frontend:
	@echo "🎨 Deploying frontend..."
	@./scripts/deploy.sh frontend:deploy

deploy-quick:
	@echo "⚡ Quick deployment (no migrations)..."
	@make deploy-backend
	@make deploy-frontend
	@make status

deploy-check:
	@echo "🔍 Pre-deployment checks..."
	@cd backend && pnpm test:unit
	@cd frontend && pnpm build
	@echo "✅ Pre-deployment checks passed"

# ===============================================
# MONITORING & STATUS
# ===============================================

status:
	@./scripts/deploy.sh status

logs:
	@echo "📜 Streaming backend logs..."
	@./scripts/deploy.sh backend:logs

logs-db:
	@echo "📜 Database logs..."
	@./scripts/deploy.sh db:logs

health:
	@echo "🏥 Checking service health..."
	@curl -s $$(cat .deploy.env 2>/dev/null | grep RAILWAY_BACKEND_URL | cut -d'=' -f2)/api/health || echo "Backend: Offline"
	@echo ""
	@cd supabase && supabase status || echo "Database: Offline"

monitor:
	@echo "📊 Opening monitoring dashboards..."
	@open "https://railway.app/project/$$(cat .deploy.env | grep RAILWAY_PROJECT_ID | cut -d'=' -f2)"
	@open "https://app.supabase.com/project/$$(cat .deploy.env | grep SUPABASE_PROJECT_ID | cut -d'=' -f2)"

# ===============================================
# UTILITY COMMANDS
# ===============================================

clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf backend/dist backend/node_modules backend/.env
	@rm -rf frontend/dist frontend/node_modules frontend/.env
	@rm -rf .deploy.env
	@echo "✅ Cleaned"

env:
	@echo "📝 Creating .env files..."
	@cp backend/.env.example backend/.env 2>/dev/null || true
	@cp frontend/.env.example frontend/.env 2>/dev/null || true
	@echo "✅ .env files created (please update with your values)"

tunnel:
	@echo "🌐 Creating local tunnel for testing..."
	@command -v ngrok >/dev/null 2>&1 || (echo "Installing ngrok..." && brew install ngrok)
	@ngrok http 3001

open-backend:
	@open "https://$$(cat .deploy.env | grep RAILWAY_BACKEND_URL | cut -d'=' -f2)"

open-frontend:
	@open "$$(cat .deploy.env | grep GITHUB_PAGES_URL | cut -d'=' -f2)/apps/dice-baseball/"

open-supabase:
	@open "https://app.supabase.com/project/$$(cat .deploy.env | grep SUPABASE_PROJECT_ID | cut -d'=' -f2)"

# ===============================================
# DOCKER OPERATIONS (Optional)
# ===============================================

docker-build:
	@echo "🐳 Building Docker images..."
	@docker-compose build

docker-up:
	@echo "🐳 Starting Docker containers..."
	@docker-compose up -d

docker-down:
	@echo "🐳 Stopping Docker containers..."
	@docker-compose down

docker-logs:
	@docker-compose logs -f

# ===============================================
# CI/CD HELPERS
# ===============================================

ci-test:
	@cd backend && SKIP_NETWORK_TESTS=1 pnpm test

ci-build:
	@cd backend && pnpm build
	@cd frontend && pnpm build

ci-deploy:
	@echo "🚀 CI/CD Deployment..."
	@make deploy-check
	@make deploy

# ===============================================
# QUICK COMMANDS (Aliases)
# ===============================================

d: dev
t: test
s: status
l: logs
h: health

# Development workflow shortcuts
start: dev
restart:
	@make clean
	@make install
	@make dev

# Quick deployment
ship: 
	@make test
	@make deploy
	@make health

# Emergency rollback
rollback:
	@echo "⚠️ Rolling back deployment..."
	@cd backend && railway down
	@git revert HEAD
	@git push
	@make deploy