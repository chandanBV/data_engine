# WebAssembly Data Engine - Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Code Flow & Data Pipeline](#code-flow--data-pipeline)
3. [Frontend Components](#frontend-components)
4. [Rust Backend (WASM Module)](#rust-backend-wasm-module)
5. [Key Features Implementation](#key-features-implementation)
6. [Data Processing Operations](#data-processing-operations)
7. [Performance Optimizations](#performance-optimizations)
8. [API Reference](#api-reference)

---

## Architecture Overview

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │ Rust WASM Module │    │ Apache Arrow    │
│                 │    │                 │    │ Data Engine      │
│ • Data Uploader │───▶│ • Data Engine   │───▶│ • RecordBatches  │
│ • Processing    │    │ • Operations     │    │ • Schema Mgmt   │
│ • Result Viewer │    │ • JSON/Arrow     │    │ • Type System    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Rust with WebAssembly (wasm32 target)
- **Data Processing**: Apache Arrow (internal), JSON (communication)
- **Build System**: wasm-pack, Webpack
- **State Management**: React hooks, local component state

### Core Principles
- **Performance First**: Rust backend handles heavy computations
- **Memory Efficient**: Apache Arrow columnar format (internal storage)
- **JSON Communication**: Web-compatible data transfer (not IPC)
- **Type Safe**: Full type safety across Rust-JS boundary

---

## Code Flow & Data Pipeline

### 1. Application Initialization
```javascript
// frontend/src/App.js
<Route path="/" element={<EnhancedDataEnginePage />} />

// EnhancedDataEnginePage.jsx - WASM Loading
const engine = await createDataEngine(); // utils/wasmLoader.js
setDataEngine(engine);
```

### 2. Data Upload Flow
```
User Uploads File → DataUploader → File Parsing → WASM DataEngine.load_data()
                      ↓
                File → ArrayBuffer → Rust RecordBatch → Store in HashMap
```

### 3. Data Processing Flow
```
User Action → ProcessingControls → WASM Operation → Result → ResultViewer
     ↓              ↓                     ↓           ↓          ↓
  Click Filter  → Filter Config      → filter()   → JSON    → Display
  Click Pivot   → Pivot Config       → pivot()    → JSON    → Display
  Click Agg     → Aggregate Config   → aggregate()-> JSON    → Display
```

### 4. Display Flow
```
Raw Data:    load_data() → get_data_json_paginated() → Display 10K chunks
Processed:   operation() → return JSON directly → Display all results
```

---

## Frontend Components

### EnhancedDataEnginePage (`pages/EnhancedDataEnginePage.jsx`)
**Purpose**: Main application page orchestrating all components
**Key States**:
```javascript
const [dataEngine, setDataEngine] = useState(null);      // WASM instance
const [uploadedData, setUploadedData] = useState(null);  // File metadata
const [processingResult, setProcessingResult] = useState(null); // Operation results
```

**Functions**:
- `handleDataLoaded()`: Processes uploaded files, stores metadata
- `handleProcessingResult()`: Handles pivot/filter/aggregate results
- `handleReset()`: Calls `dataEngine.restore_original()`

### DataUploader (`components/DataUploader.jsx`)
**Purpose**: File upload interface with drag & drop
**Supported Formats**: CSV, JSON, Parquet, Excel (1M-5M rows)
**Key Logic**:
```javascript
const handleFileUpload = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await dataEngine.load_data(new Uint8Array(arrayBuffer), file.name);
  // Store file metadata for UI display
};
```

### ProcessingControls (`components/ProcessingControls.jsx`)
**Purpose**: UI for configuring data operations (Pivot, Aggregate, Filter)
**State Management**:
```javascript
const [pivotConfig, setPivotConfig] = useState({
  rowFields: [], columnFields: [], valueFields: [],
  aggregationType: 'sum'  // 'sum', 'count', 'avg', 'min', 'max'
});
```

**Operation Handlers**:
- `handlePivot()`: Validates config, calls `dataEngine.pivot(JSON.stringify(config))`
- `handleAggregate()`: Similar pattern for aggregations
- `handleFilter()`: Sequential filter application to prevent race conditions

### ResultViewer (`components/ResultViewer.jsx`)
**Purpose**: Displays data results with pagination, search, and export
**Key Features**:
- **Paginated Display**: Shows filtered data in pages (25/50/100/200 rows)
- **Search & Filters**: Real-time client-side filtering
- **Load More**: Progressive loading for raw data (not processed results)
- **Export**: CSV/JSON export functionality

**State Management**:
```javascript
const [tableData, setTableData] = useState(null);        // Current display data
const [totalRows, setTotalRows] = useState(0);          // Total available rows
const [currentPage, setCurrentPage] = useState(1);      // Pagination state
const [performanceMetrics, setPerformanceMetrics] = useState(null); // Timing data
```

**Data Loading Logic**:
```javascript
// Raw data: Load first 10K, show "Load More" button
if (result.data) {
  const count = await dataEngine.get_row_count();
  const jsonData = await dataEngine.get_data_json_paginated(0, 10000);
  parsed = JSON.parse(jsonData);
  setHasMoreData(count > 10000);
}

// Processed results: All data returned at once, no "Load More"
if (result.type && result.data) {
  parsed = JSON.parse(result.data);
  setTotalRows(parsed.length);  // Update to actual result count
}
```

---

## Rust Backend (WASM Module)

### Project Structure
```
rust-modules/data-engine/src/
├── lib.rs              # WASM bindings and exports
├── engine/             # Core data engine
│   ├── mod.rs         # DataEngine struct and methods
│   └── engine.rs      # Implementation
├── config.rs           # Configuration structs (PivotConfig, etc.)
├── operations/         # Data operations
│   ├── pivot/
│   ├── filter/
│   ├── aggregation/
│   └── mod.rs
└── utils/              # Helper functions
```

### DataEngine (`engine/mod.rs`)
**Core Structure**:
```rust
pub struct DataEngine {
    pub data: HashMap<String, Vec<RecordBatch>>,  // Stored data
    pub original_data: HashMap<String, Vec<RecordBatch>>, // Backup for reset
    pub schema: Option<Schema>,                    // Data schema
}
```

**Key Methods**:
- `load_data()`: Parses uploaded files into Arrow RecordBatches
- `get_row_count()`: Returns total row count
- `get_data_json_paginated()`: Extracts paginated data as JSON
- `restore_original()`: Resets to original uploaded data

### Pivot Engine (`pivot/mod.rs`)
**Purpose**: Handles pivot table operations with multiple aggregation types
**Key Features**:
- **Multiple Value Fields**: Supports multiple columns in pivot values
- **Aggregation Types**: Sum, Count, Average, Min, Max
- **Composite Keys**: Handles row + column field combinations

**Data Structure**:
```rust
enum AggregationValue {
    Count(u64),              // For COUNT operations
    Sum(f64),               // For SUM operations
    Min(f64),               // For MIN operations
    Max(f64),               // For MAX operations
    SumCount(f64, u64),     // For AVG: (sum, count)
}
```

**Pivot Logic**:
```rust
// 1. Group data by row fields
// 2. Create composite keys (col_key, value_field)
// 3. Apply aggregation based on config.aggregation_type
// 4. Convert back to RecordBatch with proper column naming
```

### Filter Engine (`filter/mod.rs`)
**Purpose**: Applies filtering operations on data
**Features**:
- **Multiple Filter Types**: Equals, Contains, Range, Date Range
- **Sequential Application**: Prevents race conditions
- **Column Validation**: Checks column existence before filtering

### Aggregation Engine (`aggregation/mod.rs`)
**Purpose**: Performs group-by aggregations
**Features**:
- **Multiple Operations**: Sum, Count, Avg, Min, Max per field
- **Custom Aliases**: User-defined output column names
- **Group By**: Multiple grouping fields supported

---

## Key Features Implementation

### 1. Paginated Data Loading
**Problem**: Loading 1M+ rows at once crashes browsers
**Solution**: Progressive loading with `get_data_json_paginated()`

```rust
// Rust side: Extract specific row range
pub fn get_data_json_paginated(&self, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
    let mut json_rows = Vec::new();
    let mut rows_processed = 0;

    for batch in self.data.values().flatten() {
        for row_idx in 0..batch.num_rows() {
            if global_row_idx < offset { continue; }
            if rows_processed >= limit { break; }

            // Convert Arrow row to JSON object
            let mut row_obj = serde_json::Map::new();
            // ... field extraction logic
        }
    }
    Ok(JsValue::from_str(&serde_json::to_string(&json_rows)?))
}
```

### 2. Dynamic Aggregation Types
**Problem**: Pivot operations only supported SUM
**Solution**: Enum-based aggregation system

```rust
impl AggregationValue {
    fn new(agg_type: &str, value: f64) -> Self {
        match agg_type {
            "count" => AggregationValue::Count(1),
            "sum" => AggregationValue::Sum(value),
            "avg" => AggregationValue::SumCount(value, 1),
            // ... other types
        }
    }

    fn finalize(&self) -> f64 {
        match self {
            AggregationValue::Count(count) => *count as f64,
            AggregationValue::SumCount(sum, count) => sum / count as f64,
            // ... other finalizers
        }
    }
}
```

### 3. Memory Management
**Problem**: WASM memory leaks and bounds issues
**Solution**: Proper cleanup and bounds checking

```rust
// Store original data for reset operations
pub fn restore_original(&mut self) {
    self.data = self.original_data.clone();
}

// Bounds checking in filter operations
if column_idx >= batch.num_columns() {
    return Err(JsValue::from_str("Column index out of bounds"));
}
```

### 4. Type-Safe Data Conversion
**Problem**: JavaScript/Rust type mismatches
**Solution**: Comprehensive type handling in data conversion

```rust
fn extract_numeric_value(&self, column: &ArrayRef, row_idx: usize) -> f64 {
    match column.data_type() {
        DataType::Float64 => {
            let array = column.as_any().downcast_ref::<Float64Array>().unwrap();
            array.value(row_idx)
        }
        DataType::Int64 => {
            let array = column.as_any().downcast_ref::<Int64Array>().unwrap();
            array.value(row_idx) as f64
        }
        // ... handle all Arrow data types
    }
}
```

---

## Data Processing Operations

### Pivot Operations
1. **Input**: Row fields, Column fields, Value fields, Aggregation type
2. **Process**:
   - Group data by row field combinations
   - Create pivot columns from unique column field values
   - Apply aggregation to value fields
3. **Output**: New RecordBatch with pivoted structure

### Filter Operations
1. **Input**: Array of filter specifications
2. **Process**:
   - Apply each filter sequentially to avoid race conditions
   - Support multiple filter types (equals, contains, range, etc.)
3. **Output**: Filtered RecordBatch

### Aggregation Operations
1. **Input**: Group-by fields, aggregation specifications
2. **Process**:
   - Group data by specified fields
   - Apply aggregations to each group
   - Support multiple aggregations per operation
3. **Output**: Aggregated RecordBatch

---

## Performance Optimizations

### 1. Apache Arrow Columnar Format
- **Benefit**: Efficient memory layout, SIMD operations
- **Usage**: All data stored as RecordBatches internally in Rust
- **Communication**: JSON serialization for web compatibility (not IPC)

### 2. WASM Compilation
- **Target**: `wasm32-unknown-unknown` for web deployment
- **Optimization**: Release builds with `--release` flag
- **Size**: ~2MB compressed WASM module

### 3. JSON-Based Communication
- **Decision**: Chose JSON over Apache Arrow IPC for web compatibility
- **Benefit**: Native browser support, easier debugging, better error handling
- **Trade-off**: Slightly larger payload vs IPC efficiency (acceptable for web use)
- **Current**: Using `serde_json` for serialization (mature, battle-tested)
- **Alternative Considered**: `simd-json` for SIMD-accelerated parsing

### SIMD-JSON Analysis
**Pros of `simd-json`:**
- **2-5x faster JSON parsing** using SIMD instructions (SSE/AVX)
- **Better for large payloads** from frontend to Rust
- **Hardware acceleration** when available

**Cons of `simd-json`:**
- **Primarily a parser**, not a serializer (we'd still need `serde` for output)
- **Less mature** than `serde_json` (newer, smaller ecosystem)
- **Limited WASM support** (SIMD in WASM is still evolving)
- **API differences** require code changes
- **Memory allocation patterns** may differ

**Our Use Case Analysis:**
```rust
// Current bottleneck (serialization - serde_json::to_string):
let json_result = serde_json::Value::Array(json_rows);  // 10K+ objects
serde_json::to_string(&json_result)  // ← Main perf cost

// Potential benefit area (parsing - small configs):
let config: PivotConfig = serde_json::from_str(config_json)?;  // Small, infrequent
```

**Recommendation**: `serde_json` is optimal for our current architecture. SIMD optimization would provide minimal benefit given our JSON serialization patterns and WASM constraints.

### 4. Progressive Loading
- **Chunk Size**: 10,000 rows per request
- **Benefit**: Prevents browser hangs on large datasets
- **Fallback**: Filter/pivot operations return all results at once

### 5. Memory Management
- **Cleanup**: Explicit memory management in Rust
- **Bounds Checking**: Prevent array access violations
- **Reset Capability**: `restore_original()` for state recovery

---

## API Reference

### WASM Module Exports
```rust
// Data Loading
load_data(data: Uint8Array, filename: String) -> Result<String, JsValue>
get_row_count() -> Result<usize, JsValue>
get_data_json_paginated(offset: usize, limit: usize) -> Result<JsValue, JsValue>
restore_original() -> Result<(), JsValue>

// Data Operations
pivot(config_json: String) -> Result<JsValue, JsValue>
aggregate(config_json: String) -> Result<JsValue, JsValue>
filter(config_json: String) -> Result<JsValue, JsValue>

// Schema Information
get_schema() -> Result<String, JsValue>
```

### Configuration Objects

#### PivotConfig
```typescript
interface PivotConfig {
  row_fields: string[];        // Fields to group rows by
  column_fields: string[];     // Fields to create pivot columns from
  value_fields: string[];      // Fields to aggregate
  aggregation_type: 'sum' | 'count' | 'avg' | 'min' | 'max';
}
```

#### AggregateConfig
```typescript
interface AggregateConfig {
  group_by_fields: string[];    // Fields to group by
  aggregations: AggregationSpec[];
}

interface AggregationSpec {
  field: string;                // Field to aggregate
  operation: 'sum' | 'count' | 'avg' | 'min' | 'max';
  alias?: string;              // Optional output column name
}
```

#### FilterConfig
```typescript
interface FilterConfig {
  filters: FilterSpec[];
}

interface FilterSpec {
  field: string;               // Field to filter
  filter_type: 'equals' | 'contains' | 'range' | 'date_range';
  value?: string;              // For equals/contains
  min_value?: string;          // For range filters
  max_value?: string;          // For range filters
}
```

### Frontend Component Props

#### ResultViewer Props
```typescript
interface ResultViewerProps {
  result?: {
    type?: 'pivot' | 'aggregate' | 'filter';
    data: string | any;        // JSON string or parsed object
    config?: any;              // Operation configuration
  };
  dataEngine: any;             // WASM data engine instance
  showPagination?: boolean;    // Enable pagination controls
  initialView?: 'table';       // Initial display mode
  onReset?: () => void;        // Reset callback
  schema?: string;             // Data schema string
  compact?: boolean;           // Compact UI mode
}
```

#### ProcessingControls Props
```typescript
interface ProcessingControlsProps {
  dataEngine: any;             // WASM data engine instance
  onResult: (result: any) => void; // Result callback
  schema?: string;             // Data schema for field validation
  compact?: boolean;           // Compact UI mode
}
```

---

## Deployment & Build Process

### Build Commands
```bash
# Build WASM module
./scripts/build-wasm.sh

# Start development server
cd frontend && yarn start

# Production build
cd frontend && yarn build
```

### File Structure
```
/app
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── pages/             # Page components
│   │   ├── utils/             # Utilities (wasmLoader)
│   │   └── wasm/              # Compiled WASM modules
│   └── package.json
├── rust-modules/               # Rust WASM modules
│   └── data-engine/
│       ├── src/
│       └── Cargo.toml
└── scripts/
    └── build-wasm.sh          # Build script
```

### Environment Requirements
- **Rust**: 1.70+ with wasm32 target
- **Node.js**: 18+ with yarn
- **Browser**: Modern browser with WASM support
- **Memory**: 4GB+ RAM for large datasets

---

## Troubleshooting

### Common Issues

#### 1. WASM Loading Errors
**Symptom**: "Failed to initialize data engine"
**Solution**: Check browser console, ensure WASM files are served correctly

#### 2. Memory Issues
**Symptom**: Browser crashes on large files
**Solution**: Reduce initial load limit, use progressive loading

#### 3. Filter Not Working
**Symptom**: Filters don't apply correctly
**Solution**: Check column names match schema, ensure sequential application

#### 4. Performance Issues
**Symptom**: Slow operations on large datasets
**Solution**: Use pagination, check aggregation types, monitor memory usage

### Debug Information
- **Performance Metrics**: Displayed in ResultViewer for all operations
- **Console Logs**: Detailed logging in both frontend and Rust code
- **Schema Validation**: Check field names match Arrow schema

---

## Future Enhancements

### Planned Features
- **Advanced Filtering**: Regex, fuzzy matching, multi-column filters
- **Data Visualization**: Charts and graphs integration
- **Export Formats**: Excel, PDF, Parquet output
- **Query Language**: SQL-like syntax for complex operations
- **Real-time Updates**: Streaming data support
- **Collaborative Editing**: Multi-user data manipulation

### Performance Improvements
- **Parallel Processing**: Web Workers for frontend computations
- **Compression**: LZ4 compression for data transfer
- **Caching**: Result caching for repeated operations
- **Incremental Updates**: Partial data updates without full reload

---

*This documentation covers the WebAssembly Data Engine implementation as of December 2024. For the latest updates and additional features, check the codebase and commit history.*
