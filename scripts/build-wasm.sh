#!/bin/bash

# Build all Rust WASM modules
# This script builds each module and places the output in the frontend wasm directory

set -e

echo "🚀 Building Rust WASM modules..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script and project directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUST_DIR="$PROJECT_ROOT/rust-modules"
FRONTEND_WASM_DIR="$PROJECT_ROOT/frontend/src/wasm"
CARGO_BIN_DIR="$HOME/.cargo/bin"

# Add Cargo bin directory to PATH for local installs
if [[ -d "$CARGO_BIN_DIR" && ":$PATH:" != *":$CARGO_BIN_DIR:"* ]]; then
    export PATH="$CARGO_BIN_DIR:$PATH"
fi

# Create wasm directory if it doesn't exist
mkdir -p "$FRONTEND_WASM_DIR"

# Array of modules to build
MODULES=("data-engine" "chart-renderer" "query-optimizer" "parallel-compute")

# Ensure wasm-pack is available
if ! command -v wasm-pack >/dev/null 2>&1; then
    echo "wasm-pack not found. Please install it with:\n  cargo install wasm-pack" >&2
    exit 1
fi

# Build each module
for module in "${MODULES[@]}"; do
    echo -e "${BLUE}Building $module...${NC}"
    
    cd "$RUST_DIR/$module"
    
    # Build with wasm-pack
    wasm-pack build --target web --out-dir "$FRONTEND_WASM_DIR/$module"
    
    echo -e "${GREEN}✓ $module built successfully${NC}"
done

echo ""
echo -e "${GREEN}✓ All WASM modules built successfully!${NC}"
echo ""
echo "Output directory: $FRONTEND_WASM_DIR"
echo ""
echo "Next steps:"
echo "  cd frontend"
echo "  yarn start"
