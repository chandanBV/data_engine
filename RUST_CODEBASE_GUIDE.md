# Rust Codebase Guide - WebAssembly Data Engine

## Table of Contents
1. [Project Structure Overview](#project-structure-overview)
2. [Core Modules Explained](#core-modules-explained)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Key Design Decisions](#key-design-decisions)
5. [Module Interactions](#module-interactions)
6. [Performance Considerations](#performance-considerations)
7. [Error Handling Patterns](#error-handling-patterns)
8. [WASM-Specific Code](#wasm-specific-code)

---

## Project Structure Overview

```
rust-modules/data-engine/src/
├── lib.rs                          # WASM bindings and exports
├── engine/                         # Core data processing engine
│   ├── mod.rs                     # DataEngine struct and core logic
│   └── engine.rs                  # Implementation details
├── config.rs                       # Configuration structs (PivotConfig, etc.)
├── operations/                     # Data transformation operations
│   ├── pivot/                     # Pivot table logic
│   ├── filter/                    # Data filtering
│   ├── aggregation/               # Group-by aggregations
│   └── mod.rs                     # Operation exports
├── data/                          # Data format parsers
│   ├── json_parser.rs             # JSON data loading
│   ├── csv_parser.rs              # CSV data loading
│   ├── parquet_parser.rs          # Parquet data loading
│   ├── excel_parser.rs            # Excel data loading
│   └── mod.rs                     # Data loading exports
├── convertor/                     # Data format conversions
│   ├── json.rs                    # Arrow ↔ JSON conversion
│   └── mod.rs                     # Conversion utilities
└── utils/                         # Helper functions and utilities
```

---

## Core Modules Explained

### 1. lib.rs - WASM Interface Layer

**Purpose**: Bridge between Rust and JavaScript world

```rust
// WASM bindings - makes Rust functions callable from JS
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl WasmDataEngine {
    #[wasm_bindgen(constructor)]  // new WasmDataEngine() in JS
    pub fn new() -> Self { /* ... */ }

    #[wasm_bindgen]  // dataEngine.load_csv() in JS
    pub fn load_csv(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        self.engine.load_csv(bytes)
    }
}
```

**Key Responsibilities**:
- Convert between Rust types and JavaScript `JsValue`
- Handle WASM memory boundaries
- Provide clean JavaScript API
- Convert errors to JavaScript-compatible format

### 2. engine/mod.rs - Core Data Engine

**Purpose**: Central data storage and processing coordinator

```rust
pub struct DataEngine {
    pub data: HashMap<String, Vec<RecordBatch>>,        // Current data
    pub original_data: HashMap<String, Vec<RecordBatch>>, // Backup for reset
    pub schema: Option<Schema>,                          // Data schema info
}
```

**Core Methods**:
- `load_*()` - Data ingestion from various formats
- `get_data_json_paginated()` - Convert data to JSON for frontend
- `restore_original()` - Reset to original data state

**Why HashMap<String, Vec<RecordBatch>>?**
- **HashMap**: Multiple datasets (main data, filtered results, etc.)
- **String keys**: "data", "filtered", "pivoted", etc.
- **Vec<RecordBatch>**: Apache Arrow's columnar data format

### 3. config.rs - Configuration Structures

**Purpose**: Type-safe configuration for operations

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PivotConfig {
    pub row_fields: Vec<String>,        // Fields to group rows by
    pub column_fields: Vec<String>,     // Fields to create pivot columns
    pub value_fields: Vec<String>,      // Fields to aggregate
    pub aggregation_type: String,       // "sum", "count", "avg", etc.
}
```

**Why Serde?** Enables JSON serialization for JS ↔ Rust communication

### 4. operations/pivot/mod.rs - Pivot Operations

**Purpose**: Transform tabular data into pivot table format

```rust
pub struct PivotEngine<'a> {
    pub data: &'a [RecordBatch],  // Borrowed data (no ownership)
}

impl<'a> PivotEngine<'a> {
    pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
        // Process all batches
        for batch in self.data {
            self.create_pivot_table(batch, config)?;
        }
        Ok(results)
    }
}
```

**Key Components**:
- **AggregationValue enum**: Handles different aggregation types
- **Composite keys**: `(column_value, field_name)` for multi-field pivots
- **Grouped data structure**: `HashMap<row_key, HashMap<composite_key, aggregated_value>>`

### 5. operations/filter/mod.rs - Data Filtering

**Purpose**: Apply filtering predicates to data

```rust
pub struct FilterEngine<'a> {
    pub data: &'a [RecordBatch],
}

impl<'a> FilterEngine<'a> {
    pub fn execute(&self, config: &FilterConfig) -> Result<Vec<RecordBatch>, String> {
        let mut results = Vec::new();

        for batch in self.data {
            // Apply all filters sequentially
            let mut filtered_batch = batch.clone();

            for filter_spec in &config.filters {
                filtered_batch = self.apply_filter(filtered_batch, filter_spec)?;
            }

            results.push(filtered_batch);
        }

        Ok(results)
    }
}
```

### 6. operations/aggregation/mod.rs - Group-By Aggregations

**Purpose**: Perform SQL-like GROUP BY operations

```rust
pub struct AggregationEngine<'a> {
    pub data: &'a [RecordBatch],
}

impl<'a> AggregationEngine<'a> {
    pub fn execute(&self, config: &AggregateConfig) -> Result<Vec<RecordBatch>, String> {
        let mut grouped_data: HashMap<String, HashMap<String, AggregationValue>> = HashMap::new();

        // Group and aggregate data
        for batch in self.data {
            self.group_and_aggregate(batch, config, &mut grouped_data)?;
        }

        // Convert back to RecordBatch
        self.grouped_data_to_batch(grouped_data, config)
    }
}
```

---

## Data Flow Architecture

### Data Loading Flow

```
File Upload (JS) → ArrayBuffer → WASM DataEngine.load_*()
                                      ↓
                         Parser (CSV/JSON/Parquet/Excel)
                                      ↓
                           Vec<RecordBatch> (Arrow format)
                                      ↓
                    HashMap<String, Vec<RecordBatch>>
```

### Data Processing Flow

```
User Request (JS) → JSON Config → WASM Operation Method
                           ↓                    ↓
                   serde_json::from_str()   operation.execute()
                           ↓                    ↓
                     Rust Config Struct   Filtered/Processed Data
                           ↓                    ↓
                        Result → JSON    Vec<RecordBatch> → JSON
                           ↓                    ↓
                     JsValue (Error)      JsValue (Success)
```

### Data Retrieval Flow

```
Frontend Request → get_data_json_paginated(offset, limit)
                        ↓
               Extract rows [offset..offset+limit]
                        ↓
              Convert Arrow data to serde_json::Value
                        ↓
                serde_json::to_string() → JsValue
                        ↓
                  JSON.parse() in JavaScript
```

---

## Key Design Decisions

### 1. Apache Arrow as Internal Format

**Why Arrow?**
- **Columnar storage**: Better cache performance
- **Type safety**: Rich type system
- **Interoperability**: Industry standard for data processing
- **Zero-copy operations**: Efficient memory usage

**Trade-offs**:
- **Complexity**: More complex than simple Vec<Vec<T>>
- **Learning curve**: Arrow API is extensive
- **Memory overhead**: Metadata and structure information

### 2. JSON for JavaScript Communication

**Why JSON over Arrow IPC?**
- **Web native**: JSON is built into browsers
- **Debugging**: Human-readable data transfer
- **Compatibility**: No additional JS libraries needed
- **Error handling**: Better error messages

**Performance cost**: JSON serialization is slower than IPC, but acceptable for web use

### 3. HashMap-Based Data Storage

**Structure**: `HashMap<String, Vec<RecordBatch>>`

**Keys used**:
- `"data"` - Main dataset
- `"original"` - Backup for reset functionality
- `"filtered"` - Filtered results (when applicable)

**Benefits**:
- **Multiple datasets**: Support different data views
- **Reset capability**: Easy restoration of original data
- **Memory efficient**: Only loads what you need

### 4. Borrowed Data Pattern

**Why `&[RecordBatch]` instead of owned data?**
```rust
pub struct PivotEngine<'a> {
    pub data: &'a [RecordBatch],  // Borrow, don't own
}
```

**Benefits**:
- **Memory efficient**: No data copying
- **Lifetime safety**: Compiler prevents use-after-free
- **Performance**: Zero-cost data access

### 5. String-Based Error Handling

**Simple approach**:
```rust
pub fn pivot(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
    let config: PivotConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&format!("Config error: {}", e)))?;

    // Operation logic...

    Ok(JsValue::from_str("Pivot completed"))
}
```

**Why not custom error types?**
- **Simplicity**: Easy to understand and maintain
- **WASM compatibility**: String errors work well with JavaScript
- **Debugging**: Clear error messages

### 6. Sequential Filter Application

**Why not parallel filters?**
```rust
// Sequential (current approach)
for filter_spec in &config.filters {
    filtered_batch = self.apply_filter(filtered_batch, filter_spec)?;
}

// Parallel would require:
// - Managing multiple result sets
// - Merging filter results
// - More complex error handling
```

**Benefits of sequential**:
- **Memory efficient**: Process one filter at a time
- **Predictable**: Each filter sees result of previous
- **Simple**: Easier to debug and understand

---

## Module Interactions

### DataEngine → Operation Engines

```rust
// In DataEngine
pub fn pivot(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
    let config: PivotConfig = serde_json::from_str(config_json)?;

    // Get current data (borrowed)
    let current_data = self.data.get("data")
        .ok_or("No data available")?;

    // Create operation engine with borrowed data
    let pivot_engine = PivotEngine::new(current_data);

    // Execute operation
    let result_batches = pivot_engine.execute(&config)?;

    // Store result (replaces current data)
    self.data.insert("data".to_string(), result_batches);

    Ok(JsValue::from_str("Pivot completed"))
}
```

### Operation Engine → DataEngine

```rust
// Operation engines don't modify DataEngine directly
// They return results, DataEngine decides how to store them

impl<'a> PivotEngine<'a> {
    pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
        // Process data and return results
        // DataEngine handles storage
    }
}
```

---

## Performance Considerations

### 1. Data Structure Choices

**HashMap vs Vec**: HashMap for O(1) key lookup vs Vec for iteration speed

**RecordBatch vs custom structs**: Arrow for ecosystem compatibility vs custom for optimization

### 2. Memory Management

**Borrowing pattern**: Avoids unnecessary data copying

**Chunked processing**: Process data in batches to control memory usage

**Reset capability**: Backup data enables quick restoration without reload

### 3. WASM-Specific Optimizations

**Avoid heap allocations in hot paths**: Pre-allocate where possible

**Minimize string operations**: Use &str instead of String where possible

**Error handling**: String errors instead of complex error types

### 4. Serialization Bottlenecks

**Current approach**:
```rust
// Creates many serde_json::Value objects
let json_rows: Vec<serde_json::Value> = // ... process rows
serde_json::to_string(&serde_json::Value::Array(json_rows))
```

**Potential optimizations**:
- Custom JSON writer (streaming)
- Pre-allocated string buffers
- Parallel JSON construction

---

## Error Handling Patterns

### 1. Operation-Level Errors

```rust
pub fn pivot(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
    // Config parsing errors
    let config: PivotConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?;

    // Data validation errors
    let current_data = self.data.get("data")
        .ok_or(JsValue::from_str("No data loaded"))?;

    // Operation errors
    let result = self.do_pivot_operation(&config)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(JsValue::from_str("Success"))
}
```

### 2. Data Validation Errors

```rust
fn validate_config(&self, config: &PivotConfig) -> Result<(), String> {
    // Check required fields
    if config.row_fields.is_empty() && config.column_fields.is_empty() {
        return Err("At least one row or column field required".to_string());
    }

    // Check field existence
    let schema = self.get_schema()?;
    for field in &config.row_fields {
        if !schema.has_field(field) {
            return Err(format!("Field '{}' not found in data", field));
        }
    }

    Ok(())
}
```

### 3. WASM Boundary Error Conversion

```rust
// Rust String error → JavaScript JsValue
impl From<String> for JsValue {
    fn from(error: String) -> JsValue {
        JsValue::from_str(&error)
    }
}

// Arrow errors → JavaScript errors
impl From<arrow::error::ArrowError> for JsValue {
    fn from(error: arrow::error::ArrowError) -> JsValue {
        JsValue::from_str(&format!("Arrow error: {}", error))
    }
}
```

---

## WASM-Specific Code

### 1. Conditional Compilation

```rust
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl WasmDataEngine {
    // Only compiled for WASM target
}

#[cfg(target_arch = "wasm32")]
use web_sys::{console, window};
```

### 2. Memory Management

**WASM memory is separate from JavaScript heap**
- Data passed across boundary must be copied
- No shared memory between Rust and JS
- Strings are UTF-8 encoded at boundary

### 3. JavaScript Interop

```rust
// Import JS functions (if needed)
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Export to JS
#[wasm_bindgen]
pub fn exposed_function(&self) -> JsValue {
    log("Called from Rust!");
    JsValue::from_str("Result")
}
```

### 4. Build Configuration

**Cargo.toml WASM settings**:
```toml
[lib]
crate-type = ["cdylib", "rlib"]  # Dynamic lib for WASM

[package.metadata.wasm-pack.profile.release]
wasm-opt = false  # Skip optimization for bulk memory
```

**Build process**:
```bash
# Compile Rust to WASM
wasm-pack build --target web --out-dir frontend/src/wasm

# Bundle with webpack
cd frontend && npm run build
```

---

## Common Patterns in This Codebase

### 1. Engine Pattern

```rust
// Separate engine structs for different operations
pub struct PivotEngine<'a> { data: &'a [RecordBatch] }
pub struct FilterEngine<'a> { data: &'a [RecordBatch] }
pub struct AggregationEngine<'a> { data: &'a [RecordBatch] }

// Each focuses on single responsibility
impl<'a> PivotEngine<'a> {
    pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String>
}
```

### 2. Builder Pattern Avoidance

```rust
// Direct construction instead of builders
let config = PivotConfig {
    row_fields: vec!["country".to_string()],
    column_fields: vec!["product".to_string()],
    value_fields: vec!["sales".to_string()],
    aggregation_type: "sum".to_string(),
};
```

### 3. Result Chaining

```rust
pub fn complex_operation(&self) -> Result<JsValue, JsValue> {
    self.validate_input()?
        .parse_config()?
        .execute_operation()?
        .format_output()
}
```

### 4. HashMap Data Storage

```rust
// Central data storage pattern
pub struct DataEngine {
    data: HashMap<String, Vec<RecordBatch>>,
}

// Keys for different data states
data.insert("data".to_string(), batches);        // Current data
data.insert("original".to_string(), batches);    // Backup
```

This codebase demonstrates practical Rust patterns for WebAssembly development, balancing performance, safety, and JavaScript interoperability.
