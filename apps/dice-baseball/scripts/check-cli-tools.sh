#!/bin/bash

# Check CLI Tools Status

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "🛠️  CLI Tools Status Check"
echo "======================================"
echo ""

# Function to check tool
check_tool() {
    local cmd=$1
    local name=$2
    local version_cmd=$3
    
    if command -v $cmd &> /dev/null; then
        version=$($version_cmd 2>&1 | head -1)
        echo -e "${GREEN}✓${NC} $name: $version"
        return 0
    else
        echo -e "${RED}✗${NC} $name: Not installed"
        return 1
    fi
}

# Check each tool
check_tool "node" "Node.js" "node --version"
check_tool "pnpm" "pnpm" "pnpm --version"
check_tool "gh" "GitHub CLI" "gh --version"
check_tool "$HOME/.local/bin/supabase" "Supabase" "$HOME/.local/bin/supabase --version"
check_tool "railway" "Railway" "railway --version"
check_tool "jq" "jq" "jq --version"
check_tool "$HOME/Library/Python/3.9/bin/http" "HTTPie" "$HOME/Library/Python/3.9/bin/http --version"
check_tool "docker" "Docker" "docker --version"
check_tool "make" "Make" "make --version"

echo ""

# Check authentication status
echo "======================================"
echo "🔐 Authentication Status"
echo "======================================"
echo ""

# GitHub
if gh auth status &>/dev/null; then
    echo -e "${GREEN}✓${NC} GitHub: Authenticated as $(gh api user -q .login)"
else
    echo -e "${YELLOW}!${NC} GitHub: Not authenticated (run: gh auth login)"
fi

# Railway
if railway whoami &>/dev/null; then
    echo -e "${GREEN}✓${NC} Railway: Authenticated as $(railway whoami)"
else
    echo -e "${YELLOW}!${NC} Railway: Not authenticated (run: railway login)"
fi

# Supabase
if $HOME/.local/bin/supabase projects list &>/dev/null; then
    echo -e "${GREEN}✓${NC} Supabase: Authenticated"
else
    echo -e "${YELLOW}!${NC} Supabase: Not authenticated (run: supabase login)"
fi

echo ""
echo "======================================"
echo "📍 Path Configuration"
echo "======================================"
echo ""

echo "Add these to your ~/.zshrc or ~/.bash_profile:"
echo ""
echo 'export PATH="$HOME/.local/bin:$PATH"'
echo 'export PATH="$HOME/Library/Python/3.9/bin:$PATH"'
echo ""
echo "Then run: source ~/.zshrc"
echo ""

# Create aliases file
cat > ~/.dice-baseball-aliases << 'EOF'
# Dice Baseball CLI Aliases
alias supabase="$HOME/.local/bin/supabase"
alias http="$HOME/Library/Python/3.9/bin/http"
alias db-dev="cd $(dirname $(dirname $0)) && make dev"
alias db-deploy="cd $(dirname $(dirname $0)) && make deploy"
alias db-status="cd $(dirname $(dirname $0)) && make status"
alias db-logs="cd $(dirname $(dirname $0)) && make logs"
EOF

echo "Aliases saved to ~/.dice-baseball-aliases"
echo "Add to ~/.zshrc: source ~/.dice-baseball-aliases"