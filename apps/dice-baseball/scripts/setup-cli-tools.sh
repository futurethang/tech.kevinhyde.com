#!/bin/bash

# Dice Baseball V2 - CLI Tools Setup Script
# This script installs and configures all CLI tools needed for deployment

set -e  # Exit on error

echo "🚀 Dice Baseball V2 - CLI Tools Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print colored output
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

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    print_error "Unsupported OS: $OSTYPE"
    exit 1
fi

print_status "Detected OS: $OS"
echo ""

# ===============================================
# 1. HOMEBREW (macOS) / APT (Linux)
# ===============================================
if [[ "$OS" == "macos" ]]; then
    if ! command_exists brew; then
        print_status "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        print_success "Homebrew installed"
    else
        print_success "Homebrew already installed"
    fi
fi

# ===============================================
# 2. NODE.JS & NPM
# ===============================================
if ! command_exists node; then
    print_status "Installing Node.js..."
    if [[ "$OS" == "macos" ]]; then
        brew install node
    else
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    print_success "Node.js installed"
else
    print_success "Node.js already installed ($(node --version))"
fi

# ===============================================
# 3. PNPM
# ===============================================
if ! command_exists pnpm; then
    print_status "Installing pnpm..."
    npm install -g pnpm
    print_success "pnpm installed"
else
    print_success "pnpm already installed ($(pnpm --version))"
fi

# ===============================================
# 4. GITHUB CLI
# ===============================================
if ! command_exists gh; then
    print_status "Installing GitHub CLI..."
    if [[ "$OS" == "macos" ]]; then
        brew install gh
    else
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update
        sudo apt install gh
    fi
    print_success "GitHub CLI installed"
    
    print_status "Authenticating with GitHub..."
    gh auth login
else
    print_success "GitHub CLI already installed"
    if ! gh auth status &>/dev/null; then
        print_warning "GitHub CLI not authenticated"
        gh auth login
    else
        print_success "GitHub CLI authenticated"
    fi
fi

# ===============================================
# 5. SUPABASE CLI
# ===============================================
if ! command_exists supabase; then
    print_status "Installing Supabase CLI..."
    if [[ "$OS" == "macos" ]]; then
        brew install supabase/tap/supabase
    else
        # Linux installation
        wget -qO- https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xvz
        sudo mv supabase /usr/local/bin/
    fi
    print_success "Supabase CLI installed"
else
    print_success "Supabase CLI already installed ($(supabase --version))"
fi

# ===============================================
# 6. RAILWAY CLI
# ===============================================
if ! command_exists railway; then
    print_status "Installing Railway CLI..."
    if [[ "$OS" == "macos" ]]; then
        brew install railway
    else
        # Linux installation
        bash <(curl -fsSL https://railway.app/install.sh)
    fi
    print_success "Railway CLI installed"
    
    print_status "Authenticating with Railway..."
    railway login
else
    print_success "Railway CLI already installed"
    if ! railway whoami &>/dev/null; then
        print_warning "Railway CLI not authenticated"
        railway login
    else
        print_success "Railway CLI authenticated ($(railway whoami))"
    fi
fi

# ===============================================
# 7. JQ (JSON processor)
# ===============================================
if ! command_exists jq; then
    print_status "Installing jq..."
    if [[ "$OS" == "macos" ]]; then
        brew install jq
    else
        sudo apt-get install -y jq
    fi
    print_success "jq installed"
else
    print_success "jq already installed"
fi

# ===============================================
# 8. HTTPIE (Better curl)
# ===============================================
if ! command_exists http; then
    print_status "Installing HTTPie..."
    if [[ "$OS" == "macos" ]]; then
        brew install httpie
    else
        sudo apt-get install -y httpie
    fi
    print_success "HTTPie installed"
else
    print_success "HTTPie already installed"
fi

# ===============================================
# 9. DOCKER (Optional but recommended)
# ===============================================
if ! command_exists docker; then
    print_warning "Docker not installed (optional but recommended)"
    echo "  To install Docker, visit: https://docs.docker.com/get-docker/"
else
    print_success "Docker already installed"
fi

# ===============================================
# VERIFICATION
# ===============================================
echo ""
echo "======================================"
echo "CLI Tools Status:"
echo "======================================"

# Create status report
tools=(
    "node:Node.js"
    "pnpm:pnpm"
    "gh:GitHub CLI"
    "supabase:Supabase CLI"
    "railway:Railway CLI"
    "jq:jq"
    "http:HTTPie"
    "docker:Docker"
)

all_installed=true
for tool_pair in "${tools[@]}"; do
    IFS=':' read -r cmd name <<< "$tool_pair"
    if command_exists "$cmd"; then
        echo -e "${GREEN}✓${NC} $name"
    else
        echo -e "${RED}✗${NC} $name"
        all_installed=false
    fi
done

echo ""
if $all_installed; then
    print_success "All required tools are installed!"
    echo ""
    echo "Next steps:"
    echo "1. Run: ./scripts/deploy.sh init"
    echo "2. Follow the prompts to set up your project"
else
    print_warning "Some tools are missing. Please install them manually."
fi