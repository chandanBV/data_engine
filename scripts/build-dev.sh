#!/bin/bash
# Build for fast local development (outputs to frontend/src/wasm)

echo "🔨 Building WASM for local development..."
cd rust-modules/data-engine
wasm-pack build --target bundler --out-dir ../../frontend/src/wasm --release
echo "✅ Build complete! WASM ready in frontend/src/wasm/"
