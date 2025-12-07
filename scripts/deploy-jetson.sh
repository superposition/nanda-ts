#!/bin/bash
#
# Deploy NANDA Jetson UGV Agent
#
# Usage:
#   ./scripts/deploy-jetson.sh [JETSON_HOST] [REGISTRY_URL]
#
# Examples:
#   ./scripts/deploy-jetson.sh jetson@192.168.0.192
#   ./scripts/deploy-jetson.sh jetson@192.168.0.192 http://192.168.0.100:3000
#
# Or run directly on Jetson:
#   curl -fsSL https://raw.githubusercontent.com/superposition/nanda-ts/main/scripts/deploy-jetson.sh | bash
#

set -e

JETSON_HOST="${1:-}"
REGISTRY_URL="${2:-}"
REPO_URL="https://github.com/superposition/nanda-ts.git"
INSTALL_DIR="/opt/nanda-ugv"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[NANDA]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# If running locally on Jetson (no SSH target)
deploy_local() {
    log "Deploying NANDA UGV Agent locally..."

    # Check for Docker
    if ! command -v docker &> /dev/null; then
        error "Docker not found. Install with: sudo apt install docker.io docker-compose"
    fi

    # Clone or update repo
    if [ -d "$INSTALL_DIR" ]; then
        log "Updating existing installation..."
        cd "$INSTALL_DIR"
        git pull
    else
        log "Cloning repository..."
        sudo mkdir -p "$INSTALL_DIR"
        sudo chown $USER:$USER "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    # Create .env file if registry URL provided
    if [ -n "$REGISTRY_URL" ]; then
        log "Configuring registry: $REGISTRY_URL"
        echo "REGISTRY_URL=$REGISTRY_URL" > .env
    fi

    # Build and start
    log "Building Docker image (this may take a few minutes)..."
    docker compose -f docker-compose.jetson.yml build

    log "Starting NANDA UGV Agent..."
    docker compose -f docker-compose.jetson.yml up -d

    # Get local IP
    LOCAL_IP=$(hostname -I | awk '{print $1}')

    echo ""
    log "${GREEN}Deployment complete!${NC}"
    echo ""
    echo -e "${CYAN}Agent running at:${NC}"
    echo "  http://${LOCAL_IP}:8000"
    echo ""
    echo -e "${CYAN}Endpoints:${NC}"
    echo "  Agent Card: http://${LOCAL_IP}:8000/.well-known/agent.json"
    echo "  Health:     http://${LOCAL_IP}:8000/health"
    echo "  JSON-RPC:   http://${LOCAL_IP}:8000/rpc"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo "  View logs:  docker logs -f nanda-jetson-ugv"
    echo "  Stop:       docker compose -f docker-compose.jetson.yml down"
    echo "  Restart:    docker compose -f docker-compose.jetson.yml restart"
    echo ""
}

# Deploy to remote Jetson via SSH
deploy_remote() {
    log "Deploying to remote Jetson: $JETSON_HOST"

    # Test SSH connection
    if ! ssh -o ConnectTimeout=5 "$JETSON_HOST" "echo 'SSH OK'" &> /dev/null; then
        error "Cannot connect to $JETSON_HOST via SSH"
    fi

    # Build deploy command
    REMOTE_CMD="
        export REGISTRY_URL='$REGISTRY_URL'
        export INSTALL_DIR='$INSTALL_DIR'
        export REPO_URL='$REPO_URL'

        # Install Docker if needed
        if ! command -v docker &> /dev/null; then
            echo 'Installing Docker...'
            sudo apt-get update
            sudo apt-get install -y docker.io docker-compose
            sudo usermod -aG docker \$USER
            echo 'Docker installed. You may need to log out and back in.'
        fi

        # Clone or update
        if [ -d \"\$INSTALL_DIR\" ]; then
            cd \"\$INSTALL_DIR\" && git pull
        else
            sudo mkdir -p \"\$INSTALL_DIR\"
            sudo chown \$USER:\$USER \"\$INSTALL_DIR\"
            git clone \"\$REPO_URL\" \"\$INSTALL_DIR\"
        fi

        cd \"\$INSTALL_DIR\"

        # Set registry URL
        if [ -n \"\$REGISTRY_URL\" ]; then
            echo \"REGISTRY_URL=\$REGISTRY_URL\" > .env
        fi

        # Build and run
        docker compose -f docker-compose.jetson.yml build
        docker compose -f docker-compose.jetson.yml up -d

        # Show status
        echo ''
        echo 'Agent started! Check with:'
        echo '  docker logs -f nanda-jetson-ugv'
    "

    ssh -t "$JETSON_HOST" "$REMOTE_CMD"

    log "Deployment complete!"
}

# Main
echo -e "${CYAN}"
echo "  _   _    _    _   _ ____    _    "
echo " | \ | |  / \  | \ | |  _ \  / \   "
echo " |  \| | / _ \ |  \| | | | |/ _ \  "
echo " | |\  |/ ___ \| |\  | |_| / ___ \ "
echo " |_| \_/_/   \_\_| \_|____/_/   \_\\"
echo ""
echo " Jetson UGV Agent Deployer"
echo -e "${NC}"

if [ -z "$JETSON_HOST" ]; then
    # Check if we're on a Jetson (ARM64 + NVIDIA)
    if [ -f /proc/device-tree/model ] && grep -qi "jetson\|tegra" /proc/device-tree/model 2>/dev/null; then
        log "Detected Jetson device, deploying locally..."
        deploy_local
    else
        echo "Usage: $0 [JETSON_HOST] [REGISTRY_URL]"
        echo ""
        echo "Examples:"
        echo "  $0 jetson@192.168.0.192"
        echo "  $0 jetson@192.168.0.192 http://192.168.0.100:3000"
        echo ""
        echo "Or run directly on Jetson:"
        echo "  curl -fsSL https://raw.githubusercontent.com/superposition/nanda-ts/main/scripts/deploy-jetson.sh | bash"
        exit 1
    fi
else
    deploy_remote
fi
