#!/bin/bash
# Build as npm package (outputs to pkg/ for publishing)

echo "📦 Building WASM as npm package..."
cd rust-modules/data-engine
wasm-pack build --target bundler --out-dir pkg --release --scope lumel-org
echo "✅ NPM package built in rust-modules/data-engine/pkg/"
echo ""
echo "To publish:"
echo "  cd rust-modules/data-engine/pkg"
echo "  npm publish --access public"
echo ""
echo "To test locally:"
echo "  cd rust-modules/data-engine/pkg"
echo "  npm link"
echo "  cd ../../../frontend"
echo "  npm link @lumel-org/data-engine"
