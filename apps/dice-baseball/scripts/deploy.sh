#!/bin/bash

# Dice Baseball V2 - Main Deployment Script
# Handles all deployment operations via CLI

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Project directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SUPABASE_DIR="$PROJECT_ROOT/supabase"

# Config file
CONFIG_FILE="$PROJECT_ROOT/.deploy.env"

# Load config if exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Helper functions
print_header() {
    echo ""
    echo "======================================"
    echo "$1"
    echo "======================================"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Save configuration
save_config() {
    cat > "$CONFIG_FILE" << EOF
# Dice Baseball Deployment Configuration
# Generated: $(date)

# Supabase
SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
SUPABASE_PROJECT_NAME=$SUPABASE_PROJECT_NAME
SUPABASE_DB_PASSWORD=$SUPABASE_DB_PASSWORD
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET

# Railway
RAILWAY_PROJECT_ID=$RAILWAY_PROJECT_ID
RAILWAY_PROJECT_NAME=$RAILWAY_PROJECT_NAME
RAILWAY_BACKEND_URL=$RAILWAY_BACKEND_URL

# GitHub
GITHUB_REPO=$GITHUB_REPO
GITHUB_PAGES_URL=$GITHUB_PAGES_URL
EOF
    print_success "Configuration saved to .deploy.env"
}

# ===============================================
# INITIALIZATION
# ===============================================
init_project() {
    print_header "🚀 Initializing Dice Baseball Deployment"
    
    # Check for required tools
    print_status "Checking required CLI tools..."
    required_tools=("gh" "supabase" "railway" "jq" "pnpm")
    missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        echo "Please run: ./scripts/setup-cli-tools.sh"
        exit 1
    fi
    
    print_success "All required tools installed"
    
    # Get GitHub repo
    if [ -z "$GITHUB_REPO" ]; then
        GITHUB_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
        if [ -z "$GITHUB_REPO" ]; then
            read -p "Enter GitHub repository (owner/repo): " GITHUB_REPO
        fi
    fi
    print_success "GitHub repository: $GITHUB_REPO"
    
    # Initialize Supabase
    init_supabase
    
    # Initialize Railway
    init_railway
    
    # Save configuration
    save_config
    
    print_success "Initialization complete!"
    echo ""
    echo "Next steps:"
    echo "1. Run: ./scripts/deploy.sh supabase:migrate"
    echo "2. Run: ./scripts/deploy.sh backend:deploy"
    echo "3. Run: ./scripts/deploy.sh frontend:deploy"
    echo "4. Run: ./scripts/deploy.sh mlb:sync"
}

# ===============================================
# SUPABASE OPERATIONS
# ===============================================
init_supabase() {
    print_header "Setting up Supabase"
    
    # Check if already logged in
    if ! supabase projects list &>/dev/null; then
        print_status "Logging into Supabase..."
        supabase login
    fi
    
    # Create or link project
    cd "$SUPABASE_DIR"
    
    if [ ! -f "config.toml" ]; then
        print_status "Creating new Supabase project..."
        
        read -p "Project name (dice-baseball): " project_name
        project_name=${project_name:-dice-baseball}
        
        read -p "Database password (leave empty to generate): " db_password
        if [ -z "$db_password" ]; then
            db_password=$(openssl rand -base64 32)
            echo "Generated password: $db_password"
        fi
        
        read -p "Region (us-east-1, us-west-1, eu-west-1, etc.): " region
        region=${region:-us-east-1}
        
        # Create project via CLI
        supabase projects create "$project_name" \
            --db-password "$db_password" \
            --region "$region" \
            --org-id "$(supabase orgs list --output json | jq -r '.[0].id')"
        
        # Wait for project to be ready
        print_status "Waiting for project to be ready (this may take 2-3 minutes)..."
        sleep 120
        
        # Get project details
        project_info=$(supabase projects list --output json | jq -r ".[] | select(.name == \"$project_name\")")
        SUPABASE_PROJECT_ID=$(echo "$project_info" | jq -r '.id')
        
        # Initialize local project
        supabase init
        supabase link --project-ref "$SUPABASE_PROJECT_ID"
        
        SUPABASE_PROJECT_NAME="$project_name"
        SUPABASE_DB_PASSWORD="$db_password"
    else
        print_success "Supabase already initialized"
        SUPABASE_PROJECT_ID=$(grep 'project_id' config.toml | cut -d'"' -f2)
    fi
    
    # Get API keys
    print_status "Fetching Supabase API keys..."
    SUPABASE_URL=$(supabase status --output json | jq -r '.API_URL')
    SUPABASE_ANON_KEY=$(supabase status --output json | jq -r '.ANON_KEY')
    SUPABASE_SERVICE_KEY=$(supabase status --output json | jq -r '.SERVICE_ROLE_KEY')
    
    # Get JWT secret (requires dashboard API call)
    print_warning "JWT Secret must be retrieved from Supabase Dashboard"
    echo "Visit: https://app.supabase.com/project/$SUPABASE_PROJECT_ID/settings/api"
    read -p "Enter JWT Secret: " SUPABASE_JWT_SECRET
    
    cd "$PROJECT_ROOT"
    print_success "Supabase configured"
}

migrate_database() {
    print_header "Running Database Migrations"
    
    cd "$SUPABASE_DIR"
    
    # Run migrations via Supabase CLI
    print_status "Applying migrations..."
    supabase db push
    
    # Alternatively, run SQL files directly
    if [ $? -ne 0 ]; then
        print_warning "Auto-migration failed, running SQL files directly..."
        
        for migration in migrations/*.sql; do
            print_status "Running $(basename $migration)..."
            supabase db execute -f "$migration"
        done
    fi
    
    cd "$PROJECT_ROOT"
    print_success "Migrations complete"
}

seed_database() {
    print_header "Seeding Database"
    
    # Create .env file for backend
    cat > "$BACKEND_DIR/.env" << EOF
NODE_ENV=production
PORT=3001
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET
CORS_ORIGIN=http://localhost:5173
EOF
    
    cd "$BACKEND_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing backend dependencies..."
        pnpm install
    fi
    
    # Run MLB sync
    print_status "Syncing MLB demo players..."
    pnpm run sync:demo
    
    cd "$PROJECT_ROOT"
    print_success "Database seeded with demo MLB players"
}

# ===============================================
# RAILWAY OPERATIONS  
# ===============================================
init_railway() {
    print_header "Setting up Railway"
    
    # Check if logged in
    if ! railway whoami &>/dev/null; then
        print_status "Logging into Railway..."
        railway login
    fi
    
    cd "$BACKEND_DIR"
    
    # Check if project exists
    if ! railway status &>/dev/null; then
        print_status "Creating new Railway project..."
        
        read -p "Railway project name (dice-baseball-backend): " project_name
        project_name=${project_name:-dice-baseball-backend}
        
        # Create and link project
        railway init -n "$project_name"
        RAILWAY_PROJECT_NAME="$project_name"
        
        # Get project ID
        RAILWAY_PROJECT_ID=$(railway status --json | jq -r '.projectId')
    else
        print_success "Railway project already linked"
        RAILWAY_PROJECT_ID=$(railway status --json | jq -r '.projectId')
        RAILWAY_PROJECT_NAME=$(railway status --json | jq -r '.projectName')
    fi
    
    cd "$PROJECT_ROOT"
    print_success "Railway configured"
}

deploy_backend() {
    print_header "Deploying Backend to Railway"
    
    cd "$BACKEND_DIR"
    
    # Set environment variables
    print_status "Setting environment variables..."
    railway variables set NODE_ENV=production
    railway variables set PORT=3000
    railway variables set SUPABASE_URL="$SUPABASE_URL"
    railway variables set SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
    railway variables set SUPABASE_JWT_SECRET="$SUPABASE_JWT_SECRET"
    railway variables set CORS_ORIGIN="$GITHUB_PAGES_URL"
    
    # Deploy
    print_status "Deploying to Railway..."
    railway up --detach
    
    # Wait for deployment
    print_status "Waiting for deployment to complete..."
    sleep 30
    
    # Get deployment URL
    RAILWAY_BACKEND_URL=$(railway domain --json | jq -r '.')
    if [ "$RAILWAY_BACKEND_URL" == "null" ] || [ -z "$RAILWAY_BACKEND_URL" ]; then
        print_status "Generating Railway domain..."
        railway domain create
        RAILWAY_BACKEND_URL=$(railway domain --json | jq -r '.')
    fi
    
    print_success "Backend deployed to: https://$RAILWAY_BACKEND_URL"
    
    # Test health endpoint
    print_status "Testing backend health..."
    if curl -s "https://$RAILWAY_BACKEND_URL/api/health" | grep -q "ok"; then
        print_success "Backend is healthy"
    else
        print_warning "Backend health check failed - may still be starting"
    fi
    
    cd "$PROJECT_ROOT"
}

# ===============================================
# FRONTEND OPERATIONS
# ===============================================
deploy_frontend() {
    print_header "Deploying Frontend to GitHub Pages"
    
    cd "$FRONTEND_DIR"
    
    # Create production environment file
    cat > ".env.production" << EOF
VITE_API_URL=https://$RAILWAY_BACKEND_URL/api
VITE_WS_URL=wss://$RAILWAY_BACKEND_URL
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        pnpm install
    fi
    
    # Build frontend
    print_status "Building frontend..."
    pnpm run build
    
    # Copy to monorepo dist
    print_status "Copying to monorepo dist..."
    mkdir -p "$PROJECT_ROOT/../../dist/apps/dice-baseball"
    cp -r dist/* "$PROJECT_ROOT/../../dist/apps/dice-baseball/"
    
    cd "$PROJECT_ROOT/../.."
    
    # Commit and push
    print_status "Deploying to GitHub Pages..."
    git add -A dist/apps/dice-baseball
    git commit -m "deploy: dice-baseball frontend" || true
    git push origin main
    
    # Trigger GitHub Pages deployment via API
    print_status "Triggering GitHub Pages build..."
    gh api repos/$GITHUB_REPO/pages/builds -X POST
    
    GITHUB_PAGES_URL="https://$(echo $GITHUB_REPO | cut -d'/' -f1).github.io/$(echo $GITHUB_REPO | cut -d'/' -f2)"
    print_success "Frontend will be available at: $GITHUB_PAGES_URL/apps/dice-baseball/"
    
    cd "$PROJECT_ROOT"
}

# ===============================================
# MLB DATA OPERATIONS
# ===============================================
sync_mlb_data() {
    print_header "Syncing MLB Player Data"
    
    cd "$BACKEND_DIR"
    
    # Update .env with production values
    cat > ".env" << EOF
NODE_ENV=production
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
EOF
    
    # Choose sync type
    echo "Select sync type:"
    echo "1) Demo (10 star players)"
    echo "2) Full (all ~750 active players)"
    read -p "Choice (1/2): " choice
    
    case $choice in
        1)
            print_status "Syncing demo players..."
            pnpm run sync:demo
            ;;
        2)
            print_warning "Full sync will take ~10 minutes"
            read -p "Continue? (y/n): " confirm
            if [ "$confirm" == "y" ]; then
                print_status "Syncing all MLB players..."
                pnpm run sync:full
            fi
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    cd "$PROJECT_ROOT"
    print_success "MLB data sync complete"
}

# ===============================================
# STATUS & MONITORING
# ===============================================
show_status() {
    print_header "Deployment Status"
    
    echo ""
    echo "Configuration:"
    echo "--------------"
    echo "GitHub Repo: $GITHUB_REPO"
    echo "Supabase Project: $SUPABASE_PROJECT_NAME ($SUPABASE_PROJECT_ID)"
    echo "Railway Project: $RAILWAY_PROJECT_NAME ($RAILWAY_PROJECT_ID)"
    echo ""
    
    echo "URLs:"
    echo "-----"
    echo "Backend: https://$RAILWAY_BACKEND_URL"
    echo "Frontend: $GITHUB_PAGES_URL/apps/dice-baseball/"
    echo "Supabase: $SUPABASE_URL"
    echo ""
    
    # Check backend health
    echo "Service Health:"
    echo "---------------"
    if curl -s "https://$RAILWAY_BACKEND_URL/api/health" &>/dev/null; then
        print_success "Backend: Online"
    else
        print_error "Backend: Offline or starting"
    fi
    
    # Check database
    if supabase status &>/dev/null; then
        print_success "Database: Connected"
    else
        print_error "Database: Not connected"
    fi
    
    # Check frontend
    if curl -s "$GITHUB_PAGES_URL/apps/dice-baseball/" &>/dev/null; then
        print_success "Frontend: Online"
    else
        print_warning "Frontend: Not deployed or building"
    fi
}

logs_backend() {
    print_header "Backend Logs (Railway)"
    railway logs -f
}

logs_database() {
    print_header "Database Logs (Supabase)"
    supabase db logs
}

# ===============================================
# MAIN COMMAND HANDLER
# ===============================================
case "$1" in
    init)
        init_project
        ;;
    supabase:migrate)
        migrate_database
        ;;
    supabase:seed)
        seed_database
        ;;
    backend:deploy)
        deploy_backend
        ;;
    backend:logs)
        logs_backend
        ;;
    frontend:deploy)
        deploy_frontend
        ;;
    mlb:sync)
        sync_mlb_data
        ;;
    status)
        show_status
        ;;
    db:logs)
        logs_database
        ;;
    full)
        # Full deployment sequence
        init_project
        migrate_database
        deploy_backend
        deploy_frontend
        seed_database
        show_status
        ;;
    *)
        echo "🎮 Dice Baseball V2 - Deployment CLI"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  init              - Initialize project and configure services"
        echo "  supabase:migrate  - Run database migrations"
        echo "  supabase:seed     - Seed database with demo data"
        echo "  backend:deploy    - Deploy backend to Railway"
        echo "  backend:logs      - Stream backend logs"
        echo "  frontend:deploy   - Deploy frontend to GitHub Pages"
        echo "  mlb:sync          - Sync MLB player data"
        echo "  status            - Show deployment status"
        echo "  db:logs           - Show database logs"
        echo "  full              - Run full deployment sequence"
        echo ""
        echo "First time setup:"
        echo "  1. ./scripts/setup-cli-tools.sh"
        echo "  2. ./scripts/deploy.sh init"
        echo "  3. ./scripts/deploy.sh full"
        ;;
esac