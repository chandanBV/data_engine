# Rust + WebAssembly Boilerplate

## Project Overview

This is a complete, production-ready boilerplate for building high-performance browser applications with Rust and WebAssembly. It includes four fully-functional examples demonstrating real-world use cases.

## What's Included

### Frontend (React + Vite)
- Modern React application with routing
- Beautiful UI built with Tailwind CSS and shadcn/ui
- Four interactive demo pages showcasing each use case
- Dark/light theme support
- Responsive design

### Backend (Rust + WASM)
- **data-engine**: Process large tabular datasets with aggregations, filtering, and pivots
- **chart-renderer**: Handle 1M+ data points with efficient rendering
- **query-optimizer**: Execute SQL-like queries on CSV/JSON data
- **parallel-compute**: Multi-core processing with Web Workers

## Quick Start

### Prerequisites

1. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

2. Install Node.js dependencies:
```bash
cd frontend
yarn install
```

### Build and Run

1. Build WASM modules:
```bash
chmod +x scripts/build-wasm.sh
./scripts/build-wasm.sh
```

2. Start frontend:
```bash
cd frontend
yarn start
```

Open http://localhost:3000 in your browser.

## Project Structure

```
.
├── rust-modules/
│   ├── data-engine/        # Data processing engine
│   ├── chart-renderer/     # Chart rendering optimizations
│   ├── query-optimizer/    # SQL query engine
│   ├── parallel-compute/   # Parallel processing
│   └── Cargo.toml          # Workspace config
│
├── frontend/
│   ├── src/
│   │   ├── pages/          # Demo pages
│   │   ├── components/     # React components
│   │   └── wasm/           # Compiled WASM (generated)
│   └── package.json
│
├── scripts/
│   ├── build-wasm.sh      # Build all modules
│   └── build-module.sh    # Build single module
│
└── README.md
```

## Use Cases

### 1. Data Engine
Process large datasets with aggregations, pivots, and filters. Demonstrates efficient data serialization between JS and WASM.

**Key Features:**
- Aggregations (SUM, AVG, COUNT)
- GROUP BY operations
- Filtering with predicates
- Pivot tables

### 2. Chart Renderer
Render 1M+ data points smoothly at 60 FPS. Shows async chunking and downsampling techniques.

**Key Features:**
- Chunk-based streaming
- Downsampling algorithms
- Canvas 2D rendering
- Real-time updates

### 3. Query Optimizer
Execute SQL-like queries on browser-side data. Demonstrates query parsing and optimization.

**Key Features:**
- SQL syntax support
- Query plan generation
- In-memory execution
- Result streaming

### 4. Parallel Compute
Leverage multiple CPU cores with Web Workers. Shows true parallel processing in the browser.

**Key Features:**
- Web Workers integration
- Work partitioning
- Result aggregation
- Progress tracking

## Development

### Building Individual Modules

```bash
# Build single module in dev mode (faster)
./scripts/build-module.sh data-engine
```

### Release Build

```bash
cd rust-modules/data-engine
wasm-pack build --release --target web --out-dir ../../frontend/src/wasm/data-engine
```

### Adding New Modules

1. Create new Rust crate in `rust-modules/`
2. Add to workspace in `rust-modules/Cargo.toml`
3. Implement WASM bindings with `wasm-bindgen`
4. Build and integrate with frontend

## Performance Tips

1. **Minimize JS ↔ WASM calls**: Batch operations
2. **Use typed arrays**: Float64Array, Uint8Array for numeric data
3. **SharedArrayBuffer**: For zero-copy transfers (when available)
4. **Release builds**: Always use `--release` for production
5. **Profile**: Use browser DevTools to identify bottlenecks

## Browser Compatibility

- Chrome 88+
- Firefox 89+
- Safari 15+
- Edge 88+

Note: Some features (SharedArrayBuffer, WASM threads) require specific headers and may have limited support.

## Resources

- [Rust and WebAssembly Book](https://rustwasm.github.io/book/)
- [wasm-bindgen Documentation](https://rustwasm.github.io/wasm-bindgen/)
- [Detailed README in rust-modules/](./rust-modules/README.md)

## License

MIT
