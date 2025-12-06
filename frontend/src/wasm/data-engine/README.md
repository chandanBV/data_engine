# Data Engine

A WebAssembly-powered data processing engine for tabular data using Apache Arrow. This library provides efficient CSV processing and data manipulation capabilities that can run in web browsers through WebAssembly.

## Project Structure

```
rust-modules/data-engine/
├── Cargo.toml              # Package configuration with WASM dependencies
├── data.csv                # Sample CSV data for testing
├── sales-1m.csv           # Large sample dataset (124MB)
├── src/
│   ├── lib.rs             # Main library entry point with module declarations
│   ├── data/
│   │   └── mod.rs         # Data structures and JSON conversion utilities
│   ├── engine/
│   │   └── mod.rs         # Core DataEngine implementation with CSV processing
│   └── tests/
│       └── mod.rs         # Unit tests for CSV loading functionality
└── pkg/                   # Generated WASM package output directory
```

## Key Components

### 1. Library Entry Point (`src/lib.rs`)

- **Purpose**: Main entry point that declares modules and provides WASM initialization
- **Key Features**:
  - Exports public API (`DataEngine`, `DataRow`, `AggregateResult`, `recordbatch_to_json`)
  - Initializes panic hook for better error handling in WASM
  - Uses conditional compilation for WASM vs native builds

### 2. Data Module (`src/data/mod.rs`)

- **Purpose**: Data structures and conversion utilities
- **Components**:
  - `DataRow`: Represents a row in the dataset with id, category, sales, and region fields
  - `AggregateResult`: Structure for aggregation results with count, total, and average sales
  - `recordbatch_to_json()`: Converts Apache Arrow RecordBatch to Vec<serde_json::Value>

### 3. Engine Module (`src/engine/mod.rs`)

- **Purpose**: Core data processing engine
- **Key Features**:
  - `DataEngine` struct: Main engine that stores data as HashMap<String, Vec<RecordBatch>>
  - CSV loading with Apache Arrow for efficient processing
  - WASM-compatible API with conditional compilation
  - Internal CSV processing logic with schema inference and batch processing

## Dependencies

- **wasm-bindgen**: Bridges Rust and JavaScript for WASM
- **serde/serde_json**: Serialization for data interchange
- **arrow**: Apache Arrow for columnar data processing
- **web-sys**: Web API bindings for browser integration
- **js-sys**: JavaScript primitive types in Rust

## Build Configuration

- **Crate Types**: Both `cdylib` (WASM) and `rlib` (native library)
- **Optimization**: Release profile optimized for size (`opt-level = "z"`, LTO enabled)
- **Features**: Supports advanced features like console error panic hooks

## Usage

### In WASM Context

```rust
use data_engine::DataEngine;

let mut engine = DataEngine::new();
let csv_data: &[u8] = // ... CSV bytes
let result = engine.load_data_from_csv(csv_data);
let json_data = engine.get_data();
```

### Testing

```bash
cargo test -- --nocapture
```

## CSV Processing Flow

1. **Input**: CSV data as byte array
2. **Schema Inference**: Automatically detects column types using Arrow
3. **Reader Creation**: Builds Arrow CSV reader with inferred schema
4. **Batch Processing**: Processes data in chunks (RecordBatches)
5. **Storage**: Stores processed batches in HashMap for later retrieval
6. **Output**: Converts to JSON for JavaScript consumption

## Data Types Supported

- String (Utf8)
- Integer (Int32, Int64)
- Float (Float64)
- Boolean

## Future Extensions

- Arrow format support for zero-copy data transfer
- Streaming API for large datasets
- Custom binary serialization
- Advanced aggregations (percentiles, variance)
- Indexing for faster filtering

## Sample Data

The included `data.csv` contains work item tracking data with columns:
- Title
- Work Item Type
- State
- ID

The `sales-1m.csv` provides a larger 1M row dataset for performance testing.
