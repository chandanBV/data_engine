#!/bin/bash
set -e

echo "🚀 Starting Vercel Build Process..."

# Install Rust and wasm-pack
echo "🛠️  Installing Rust toolchain..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo "🛠️  Installing wasm-pack..."
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM Module
echo "📦 Building WASM components..."
cd rust-modules/data-engine
wasm-pack build --target bundler --out-dir pkg --scope lumel-org --release
# Ensure package.json has correct name
cd pkg
# verify name is @lumel-org/data-engine
# (wasm-pack respects name in Cargo.toml but manual scope flag helps)
cd ../../..

# Prepare Frontend
echo "🏗️  Building Frontend..."
cd frontend

# Verify pkg exists
if [ ! -d "../rust-modules/data-engine/pkg" ]; then
  echo "❌ Error: WASM package not found at ../rust-modules/data-engine/pkg"
  exit 1
fi

# We use 'file:..' dependency in package.json, so npm install will copy it.
echo "📥 Installing dependencies..."
npm install --legacy-peer-deps

echo "⚡ Running React Build..."
npm run build

echo "✅ Build Complete!"
