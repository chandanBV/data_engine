#!/bin/bash

# Build a single WASM module for development
# Usage: ./build-module.sh <module-name>

set -e

if [ -z "$1" ]; then
    echo "Usage: ./build-module.sh <module-name>"
    echo "Available modules: data-engine, chart-renderer, query-optimizer, parallel-compute"
    exit 1
fi

MODULE="$1"

echo "🚀 Building $MODULE..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUST_DIR="$ROOT_DIR/rust-modules"
FRONTEND_WASM_DIR="$ROOT_DIR/frontend/src/wasm"

cd "$RUST_DIR/$MODULE"

# Build in dev mode for faster compilation
wasm-pack build --dev --target web --out-dir "$FRONTEND_WASM_DIR/$MODULE"

echo "✓ $MODULE built successfully"
echo "Output: $FRONTEND_WASM_DIR/$MODULE"
