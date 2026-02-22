#!/bin/bash

# Verify authentication status before deployment

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "🔐 Checking Authentication Status"
echo "======================================"
echo ""

all_authenticated=true

# Check GitHub
if gh auth status &>/dev/null; then
    echo -e "${GREEN}✓${NC} GitHub: Authenticated as $(gh api user -q .login)"
else
    echo -e "${RED}✗${NC} GitHub: Not authenticated"
    echo "  Run: gh auth login"
    all_authenticated=false
fi

# Check Supabase
if ~/.local/bin/supabase projects list &>/dev/null; then
    echo -e "${GREEN}✓${NC} Supabase: Authenticated"
else
    echo -e "${RED}✗${NC} Supabase: Not authenticated"
    echo "  Run: ~/.local/bin/supabase login"
    all_authenticated=false
fi

# Check Railway
if railway whoami &>/dev/null; then
    echo -e "${GREEN}✓${NC} Railway: Authenticated as $(railway whoami)"
else
    echo -e "${RED}✗${NC} Railway: Not authenticated"
    echo "  Run: railway login"
    all_authenticated=false
fi

echo ""
echo "======================================"

if $all_authenticated; then
    echo -e "${GREEN}✅ All services authenticated!${NC}"
    echo ""
    echo "You're ready to deploy. Run:"
    echo "  make setup   # Initialize project"
    echo "  make deploy  # Deploy everything"
else
    echo -e "${YELLOW}⚠️  Some services need authentication${NC}"
    echo ""
    echo "Please authenticate the services listed above,"
    echo "then run this script again to verify."
fi

echo "======================================"