# Rust Tutorial - WebAssembly Data Engine Concepts

## Table of Contents
1. [Introduction to Rust](#introduction-to-rust)
2. [Core Concepts Used in This Project](#core-concepts-used-in-this-project)
3. [WebAssembly with Rust](#webassembly-with-rust)
4. [Memory Management](#memory-management)
5. [Error Handling](#error-handling)
6. [Data Structures & Collections](#data-structures--collections)
7. [Traits and Generics](#traits-and-generics)
8. [Async Programming](#async-programming)
9. [Foreign Function Interface (FFI)](#foreign-function-interface-ffi)
10. [Project-Specific Patterns](#project-specific-patterns)

---

## Introduction to Rust

### Why Rust for WebAssembly?
- **Performance**: Near C/C++ performance with memory safety
- **Safety**: No null pointer exceptions, no data races
- **WebAssembly**: Excellent WASM target support
- **Ecosystem**: Rich crates for data processing

### Key Rust Principles
- **Zero-cost abstractions**: High-level code = fast machine code
- **Ownership & Borrowing**: Memory safety without garbage collection
- **Pattern matching**: Powerful control flow
- **Type safety**: Compile-time guarantees

---

## Core Concepts Used in This Project

### 1. Ownership & Borrowing System

**Ownership**: Each value has a single owner
```rust
let data = vec![1, 2, 3];        // data owns the vector
let data2 = data;                // ownership moves to data2
// data is no longer valid here
```

**Borrowing**: Temporary access without ownership transfer
```rust
fn process_data(data: &Vec<i32>) {  // Borrow (immutable)
    // Can read data but not modify
}

fn modify_data(data: &mut Vec<i32>) {  // Mutable borrow
    data.push(4);  // Can modify
}
```

**In Your Code**:
```rust
pub struct DataEngine {
    pub data: HashMap<String, Vec<RecordBatch>>,  // Owned data
}

impl DataEngine {
    pub fn get_data_json_paginated(&self, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        // self is borrowed immutably
        // Can access self.data but not modify it
    }
}
```

### 2. Structs and Enums

**Structs**: Custom data types
```rust
struct DataEngine {
    data: HashMap<String, Vec<RecordBatch>>,
    original_data: HashMap<String, Vec<RecordBatch>>,
    schema: Option<Schema>,
}
```

**Enums**: Types with multiple variants
```rust
enum AggregationValue {
    Count(u64),              // For COUNT operations
    Sum(f64),               // For SUM operations
    Min(f64),               // For MIN operations
    Max(f64),               // For MAX operations
    SumCount(f64, u64),     // For AVG: (sum, count)
}
```

### 3. Result<T, E> and Error Handling

**Result Type**: Represents success or failure
```rust
fn load_csv(&mut self, bytes: &[u8]) -> Result<String, String> {
    match self.try_load_csv(bytes) {
        Ok(message) => Ok(message),
        Err(error) => Err(format!("CSV loading failed: {}", error))
    }
}
```

**Question Mark Operator**: Propagates errors
```rust
fn process_data(&self) -> Result<JsValue, JsValue> {
    let json_result = serde_json::Value::Array(json_rows);
    let json_string = serde_json::to_string(&json_result)?;  // ? propagates error
    Ok(JsValue::from_str(&json_string))
}
```

---

## WebAssembly with Rust

### wasm-bindgen

**Purpose**: Bridge between Rust and JavaScript
```rust
use wasm_bindgen::prelude::*;

// Make function callable from JavaScript
#[wasm_bindgen]
pub fn get_data_json_paginated(&self, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
    // Implementation
}

// Make struct constructible from JavaScript
#[wasm_bindgen]
impl WasmDataEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { engine: DataEngine::init_engine() }
    }
}
```

### JsValue Type

**Purpose**: Represents JavaScript values in Rust
```rust
// Convert Rust types to JavaScript
let js_string = JsValue::from_str("Hello from Rust!");
let js_number = JsValue::from_f64(42.0);

// Handle errors
if let Err(error) = result {
    return Err(JsValue::from_str(&error.to_string()));
}
```

### Target Architecture

**WASM32**: Special Rust compilation target
```toml
# In Cargo.toml
[lib]
crate-type = ["cdylib"]  # Dynamic library for WASM
```

---

## Memory Management

### Stack vs Heap

**Stack**: Fast, automatic cleanup, fixed size
```rust
let x = 42;              // Stack allocated
let arr = [1, 2, 3];     // Stack allocated array
```

**Heap**: Dynamic size, slower, manual lifetime management
```rust
let vec = vec![1, 2, 3];     // Heap allocated (Vec<T>)
let string = String::from("hello");  // Heap allocated
```

### Box<T> - Heap Allocation

**Purpose**: Store data on heap when size is unknown at compile time
```rust
// For recursive types (like linked lists)
enum List {
    Cons(i32, Box<List>),
    Nil,
}
```

### Reference Counting (Not Used Here)

**Rc<T> and Arc<T>**: Shared ownership
```rust
use std::rc::Rc;

// Multiple owners of same data
let data = Rc::new(vec![1, 2, 3]);
let data_clone = Rc::clone(&data);  // Reference count increases
```

---

## Error Handling

### Custom Error Types

**This Pattern**: Simple string errors
```rust
pub fn create_pivot_table(&self, batch: &RecordBatch, config: &PivotConfig) -> Result<RecordBatch, String> {
    // Return descriptive error messages
    return Err("Column not found in schema".to_string());
}
```

**Better Pattern**: Custom error enums
```rust
#[derive(Debug)]
enum DataEngineError {
    ColumnNotFound(String),
    InvalidDataType(String),
    SerializationError(String),
}

impl std::fmt::Display for DataEngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            DataEngineError::ColumnNotFound(col) => write!(f, "Column '{}' not found", col),
            // ... other variants
        }
    }
}
```

### Error Conversion

**From Trait**: Automatic error conversion
```rust
impl From<serde_json::Error> for JsValue {
    fn from(error: serde_json::Error) -> JsValue {
        JsValue::from_str(&format!("JSON error: {}", error))
    }
}
```

---

## Data Structures & Collections

### HashMap<K, V>

**Purpose**: Key-value storage
```rust
use std::collections::HashMap;

let mut data: HashMap<String, Vec<RecordBatch>> = HashMap::new();

// Insert data
data.insert("main".to_string(), batches);

// Access data
if let Some(batches) = data.get("main") {
    // Use batches
}
```

### Vec<T> - Dynamic Arrays

**Purpose**: Resizable arrays
```rust
let mut rows = Vec::new();

// Add elements
for row_idx in 0..batch.num_rows() {
    rows.push(process_row(row_idx));
}

// Convert to JSON
let json_array = serde_json::Value::Array(rows);
```

### HashSet<T> - Unique Values

**Purpose**: Store unique values
```rust
use std::collections::HashSet;

let mut unique_keys = HashSet::new();
unique_keys.insert("key1");
unique_keys.insert("key2");

// Check membership
if unique_keys.contains("key1") {
    // Key exists
}
```

---

## Traits and Generics

### Traits - Interface Definition

**Purpose**: Define shared behavior
```rust
trait DataProcessor {
    fn process(&self, data: &RecordBatch) -> Result<RecordBatch, String>;
}

struct FilterProcessor;
impl DataProcessor for FilterProcessor {
    fn process(&self, data: &RecordBatch) -> Result<RecordBatch, String> {
        // Filter logic
    }
}
```

### Generics - Type Parameters

**Purpose**: Write code that works with multiple types
```rust
struct Processor<T> {
    processor: T,
}

impl<T: DataProcessor> Processor<T> {
    fn execute(&self, data: &RecordBatch) -> Result<RecordBatch, String> {
        self.processor.process(data)
    }
}
```

---

## Async Programming

### Not Heavily Used in This Project

**Why?** WASM has limited async support, operations are synchronous

**Basic Pattern** (if needed):
```rust
use wasm_bindgen_futures::JsFuture;

#[wasm_bindgen]
pub async fn async_operation(&self) -> Result<JsValue, JsValue> {
    // Convert JavaScript Promise to Rust Future
    let promise = some_js_api();
    let result = JsFuture::from(promise).await?;
    Ok(result)
}
```

---

## Foreign Function Interface (FFI)

### wasm-bindgen Bridge

**Export to JavaScript**:
```rust
#[wasm_bindgen]
impl MyStruct {
    #[wasm_bindgen(constructor)]
    pub fn new() -> MyStruct {
        MyStruct { /* ... */ }
    }

    #[wasm_bindgen]
    pub fn method(&self) -> String {
        "Hello from Rust!".to_string()
    }
}
```

**Import from JavaScript** (if needed):
```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Usage
log("Debug message from Rust");
```

---

## Project-Specific Patterns

### Builder Pattern (Not Used)

**Alternative**: Direct struct construction
```rust
let config = PivotConfig {
    row_fields: vec!["Country".to_string()],
    column_fields: vec!["Product".to_string()],
    value_fields: vec!["Sales".to_string()],
    aggregation_type: "sum".to_string(),
};
```

### Iterator Pattern

**Processing rows**:
```rust
for row_idx in 0..batch.num_rows() {
    // Process each row
    let row_data = extract_row_data(batch, row_idx)?;
    results.push(row_data);
}
```

### RAII Pattern (Resource Acquisition Is Initialization)

**Automatic cleanup**:
```rust
{
    let data = load_data()?;  // Acquire resource
    process_data(&data)?;     // Use resource
}  // Resource automatically cleaned up here
```

---

## Lifetimes in This Codebase

### What Are Lifetimes?

**Lifetimes** are Rust's way of ensuring memory safety by tracking how long references are valid. They prevent **dangling references** - accessing memory that's been freed.

**Key Concept**: Every reference has a lifetime that indicates how long it's valid.

### Why Lifetimes Matter in Your Code

**Your codebase uses lifetimes** because operation engines borrow data instead of owning it. This prevents expensive data copying while ensuring memory safety.

### Lifetime Syntax

```rust
// Lifetime parameter 'a
pub struct PivotEngine<'a> {
    pub data: &'a [RecordBatch],  // Reference valid for lifetime 'a
}

impl<'a> PivotEngine<'a> {        // Implementation for any lifetime 'a
    // Methods...
}
```

### Your Lifetime Usage Examples

#### 1. PivotEngine with Lifetimes

**Why lifetime?** Engine borrows data from DataEngine instead of copying it.

```rust
// In pivot/mod.rs
pub struct PivotEngine<'a> {
    pub data: &'a [RecordBatch],  // Borrows data for lifetime 'a
}

impl<'a> PivotEngine<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        // data parameter has lifetime 'a
        Self { data }
    }

    pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
        // self.data is valid here because engine lives as long as 'a
        for batch in self.data {  // Safe to access
            // Process batch...
        }
        Ok(results)
    }
}
```

**Lifetime Flow**:
```
DataEngine owns data → PivotEngine borrows data → PivotEngine processes → Returns owned results
     ↓                        ↓                           ↓                        ↓
  'static lifetime      lifetime 'a                 lifetime 'a           owned Vec
```

#### 2. FilterEngine Lifetime Pattern

```rust
// In filter/mod.rs
pub struct FilterEngine<'a> {
    pub data: &'a [RecordBatch],  // Same pattern
}

impl<'a> FilterEngine<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        Self { data }
    }

    pub fn execute(&self, config: &FilterConfig) -> Result<Vec<RecordBatch>, String> {
        for batch in self.data {  // Safe access
            let filtered_batch = self.apply_filters(batch, config)?;
            results.push(filtered_batch);
        }
        Ok(results)
    }
}
```

#### 3. AggregationEngine Lifetime Pattern

```rust
// In aggregation/mod.rs
pub struct AggregationEngine<'a> {
    pub data: &'a [RecordBatch],  // Same pattern
}

impl<'a> AggregationEngine<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        Self { data }
    }

    pub fn execute(&self, config: &AggregateConfig) -> Result<Vec<RecordBatch>, String> {
        let batch = &self.data[0];  // Safe access
        // Process aggregations...
    }
}
```

### Why This Lifetime Pattern?

#### Alternative 1: Engine Owns Data (Expensive)

```rust
// BAD: Expensive copying
pub struct PivotEngine {
    pub data: Vec<RecordBatch>,  // Owns data - expensive copy
}

impl PivotEngine {
    pub fn new(data: Vec<RecordBatch>) -> Self {  // Takes ownership
        Self { data }
    }
}

// Usage would require expensive clones
let engine = PivotEngine::new(data.clone());  // Expensive!
```

#### Alternative 2: No Lifetime (Unsafe)

```rust
// BAD: Unsafe - could access freed memory
pub struct PivotEngine {
    pub data: &[RecordBatch],  // No lifetime - unsafe!
}
```

#### Your Approach: Borrowed Data (Optimal)

```rust
// GOOD: Safe and efficient
pub struct PivotEngine<'a> {
    pub data: &'a [RecordBatch],  // Borrows safely
}

impl<'a> PivotEngine<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {  // Borrows reference
        Self { data }
    }
}

// Usage is efficient
let engine = PivotEngine::new(&data);  // Just borrows - no copying!
```

### Lifetime Rules in Action

#### Rule 1: References can't outlive their data

```rust
{
    let data = vec![batch1, batch2];  // data lives in this scope
    {
        let engine = PivotEngine::new(&data);  // engine borrows data
        engine.execute(config)?;               // Safe to use here
    }  // engine dies here - safe
}  // data dies here - safe
```

#### Rule 2: Multiple borrows are OK (immutable)

```rust
let data = vec![batch1, batch2];
let engine1 = PivotEngine::new(&data);  // First borrow
let engine2 = FilterEngine::new(&data); // Second borrow - OK for immutable

// Can't have mutable borrow here while engine1/engine2 exist
// let mut_data = &mut data;  // ERROR: Would conflict
```

#### Rule 3: Mutable borrows are exclusive

```rust
let mut data = vec![batch1, batch2];

// OK: One mutable borrow at a time
{
    let mut_ref = &mut data;
    // Can modify data here
}  // mut_ref dies

// Now immutable borrows are OK again
let engine = PivotEngine::new(&data);
```

### Lifetime Elision (Simplified Syntax)

**Rust sometimes infers lifetimes automatically**:

```rust
// Elided lifetime (Rust infers 'a)
pub fn process_data(&self, config: &Config) -> Result<Data, Error>

// Explicit lifetime (same meaning)
pub fn process_data<'a>(&'a self, config: &'a Config) -> Result<Data, Error>
```

### Common Lifetime Patterns in Your Code

#### 1. Self Borrowing

```rust
impl<'a> PivotEngine<'a> {
    // self borrows data immutably
    pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
        // self.data is accessible here
    }

    // Method borrows self and parameters
    fn create_pivot_table(&self, batch: &RecordBatch, config: &PivotConfig) -> Result<RecordBatch, String> {
        // All references have compatible lifetimes
    }
}
```

#### 2. Temporary References

```rust
pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
    // config is borrowed for this function call
    let batch = &self.data[0];  // batch borrows from self.data

    self.create_pivot_table(batch, config)?;  // Both references valid here

    Ok(results)  // Results own their data
}
```

### Lifetime Errors You'll Encounter

#### Error 1: Reference outlives data

```rust
// ERROR: `data` does not live long enough
fn bad_function() -> &Vec<RecordBatch> {
    let data = vec![batch];  // data created
    &data                    // ERROR: data dies, reference invalid
}
```

**How to Fix This Lifetime Error:**

#### **Solution 1: Return Owned Data (Most Common)**
```rust
// FIX: Return owned data instead of reference
fn good_function() -> Vec<RecordBatch> {
    let data = vec![batch];  // Create data
    data                     // Return owned data - no lifetime issue
}

// Usage:
let result = good_function();  // Now owns the data
```

#### **Solution 2: Lifetime Parameters (Advanced)**
```rust
// FIX: Use lifetime parameter tied to input
fn function_with_lifetime<'a>(input: &'a SomeData) -> &'a Vec<RecordBatch> {
    // Return value tied to input lifetime
    &input.batches  // Safe - lives as long as input
}

// Usage:
let input_data = SomeData { batches: vec![batch] };
let result = function_with_lifetime(&input_data);  // result valid as long as input_data lives
```

#### **Solution 3: Static Lifetime (For Constants)**
```rust
// FIX: Static lifetime for constants
static GLOBAL_DATA: Vec<RecordBatch> = vec![];  // Lives for entire program

fn get_global_data() -> &'static Vec<RecordBatch> {
    &GLOBAL_DATA  // Safe - data lives forever
}
```

#### **Solution 4: Smart Pointers (Rc/Arc)**
```rust
use std::rc::Rc;

// FIX: Reference counting for shared ownership
fn shared_function() -> Rc<Vec<RecordBatch>> {
    let data = Rc::new(vec![batch]);
    data  // Rc allows multiple owners
}

// Usage:
let result1 = shared_function();
let result2 = Rc::clone(&result1);  // Both can access same data
```

#### **Solution 5: Struct with Lifetime**
```rust
// FIX: Struct that owns the data
struct DataContainer {
    data: Vec<RecordBatch>,
}

impl DataContainer {
    fn get_data(&self) -> &Vec<RecordBatch> {
        &self.data  // Safe - data owned by struct
    }
}

// Usage:
let container = DataContainer { data: vec![batch] };
let result = container.get_data();  // Valid as long as container lives
```

### **Which Solution to Choose?**

#### **For Your Codebase: Return Owned Data (Solution 1)**
```rust
// This is what your operation engines do:
pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
    // Process data...
    Ok(results)  // Return owned results - no lifetime issues!
}
```

**Why this works:**
- **Simple**: No complex lifetime annotations needed
- **Safe**: No dangling references possible  
- **Performant**: Compiler optimizes ownership transfers
- **Clear**: Ownership semantics are explicit

#### **When to Use Other Solutions:**

- **Lifetime parameters**: When you need to return references to input data
- **Static lifetime**: For global constants or cached data
- **Rc/Arc**: For shared ownership across threads (Arc) or within threads (Rc)
- **Struct ownership**: For complex data structures that manage their own data

### **Real-World Example from Your Code:**

**Your current approach ( Correct):**
```rust
impl<'a> PivotEngine<'a> {
    // Borrows data for processing
    pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
        // Process borrowed data...
        Ok(owned_results)  // Return owned results
    }
}
```

**Alternative (also valid):**
```rust
impl<'a> PivotEngine<'a> {
    // Return reference to borrowed data (less common)
    pub fn get_data(&'a self) -> &'a [RecordBatch] {
        self.data  // Return borrowed reference
    }
}
```

**Your approach is better** because it gives the caller ownership of the results, making the API more flexible.

#### Error 2: Conflicting borrows

```rust
let mut data = vec![batch];
let borrow1 = &data;
let borrow2 = &mut data;  // ERROR: Can't mutably borrow while immutably borrowed
```

**Fix**: Use borrows in separate scopes

### Why Lifetimes Make Your Code Safe

1. **No Dangling Pointers**: Can't access freed memory
2. **No Data Races**: Exclusive mutable access
3. **Memory Efficient**: Zero-cost borrowing
4. **Compile-Time Safety**: Errors caught at compile time

### Lifetime Annotations You'll See

- `PivotEngine<'a>` - Engine borrows data for lifetime 'a
- `&'a [RecordBatch]` - Slice reference valid for 'a
- `impl<'a>` - Implementation for any lifetime 'a
- `&self` - Borrow self immutably
- `&mut self` - Borrow self mutably

**Your lifetime usage is textbook Rust** - borrowing data efficiently while ensuring memory safety! 🎯

### **ULTIMATE SIMPLE LIFETIME EXPLANATION** 🤯

Let's break down `impl<'a> PivotEngine<'a>` with **zero complexity**:

#### **🍎 The Apple Analogy:**

Imagine you have an apple and want to lend it to a friend:

```rust
// You have an apple
let apple = Apple::new();

// Friend borrows your apple for a specific time
let friend = Friend::borrow_apple(&apple);  // ← This is what 'a does!

// Friend can eat the apple while you wait
friend.eat_apple();

// Friend returns apple (automatically)
drop(friend);

// Now you can use apple again
apple.eat();  // ✅ Safe!
```

**`'a` is like a "borrowing period"** - it tracks how long the borrow lasts!

#### **🏠 The House Analogy:**

```rust
// You own a house
let house = House::new();

// Someone rents your house for a "period of time 'a'"
let tenant = Tenant::rent_house<'a>(&house);  // ← 'a tracks rental period

// During rental, you can't sell the house
// house.sell();  // ❌ ERROR: House is rented!

// Rental ends automatically
drop(tenant);

// Now you own house again
house.sell();  // ✅ Safe!
```

#### **📊 Your Code Broken Down STEP BY STEP:**

```rust
impl<'a> PivotEngine<'a> {  // ← STEP 1: Define borrowing rules
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {  // ← STEP 2: Input borrows
        Self { data }  // ← STEP 3: Store borrow
    }
}
```

**Translation:**
1. `impl<'a>` = "We're going to talk about a borrowing period called 'a'"
2. `PivotEngine<'a>` = "PivotEngine participates in borrowing period 'a'"
3. `&'a Vec<RecordBatch>` = "Input data is borrowed for period 'a'"
4. `Self { data }` = "Store the borrowed data"

#### **🎯 What Happens In Reality:**

```rust
// This is what your code does:
fn main() {
    let data = vec![batch1, batch2];  // You own data
    
    // Create engine that borrows data for period 'a'
    let engine = PivotEngine::new(&data);  // ← 'a starts here
    
    // Engine can use data during 'a
    engine.execute()?;  // ✅ Safe - data still exists
    
    // Period 'a ends here (engine dies)
    drop(engine);
    
    // You own data again
    println!("Data still here: {}", data.len());  // ✅ Safe!
}
```

#### **🚨 What Happens WITHOUT 'a (Broken):**

```rust
// HYPOTHETICAL - No lifetime tracking
impl PivotEngine {  // ❌ No 'a - no borrowing rules!
    pub fn new(data: &Vec<RecordBatch>) -> Self {  // ❌ No 'a - unsafe!
        Self { data }
    }
}

// This would compile but be UNSAFE:
fn dangerous() {
    let data = vec![batch1, batch2];
    let engine = PivotEngine::new(&data);
    
    drop(data);  // ❌ OH NO! Data gone but engine still has reference!
    
    engine.execute();  // 💥 CRASH! Accessing freed memory!
}
```

#### **🎪 Why 'a is Like a "Rental Agreement":**

```
WITHOUT 'a:   You lend house, no agreement → House might get demolished!
WITH 'a:      Rental contract 'a → House protected during rental period
```

**`'a` is Rust's way of saying: "I promise this borrow will be safe!"** 🤝

#### **🔍 Your Specific Line:**

```rust
impl<'a> PivotEngine<'a> {  // ← This line means:
                              // "PivotEngine promises to follow borrowing rules 'a'"
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        // "Data is borrowed under rules 'a'"
        Self { data }
    }
}
```

**No magic, no complexity** - just a **borrowing contract** that prevents memory bugs! 🛡️

**Think of `'a` as a "safety label"** that Rust uses to prevent crashes! 🚀

### Official Resources
- [The Rust Programming Language Book](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)
- [Rustlings](https://github.com/rust-lang/rustlings) - Interactive exercises

### WebAssembly Specific
- [Rust and WebAssembly Book](https://rustwasm.github.io/docs/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/docs/wasm-bindgen/)

### Key Concepts to Master
1. **Ownership & Borrowing** - Core to understanding Rust
2. **Pattern Matching** - Powerful control flow
3. **Error Handling** - Result/Option types
4. **Traits & Generics** - Code reuse and polymorphism
5. **wasm-bindgen** - JavaScript interop

### Practice Projects
- Build a simple calculator in Rust
- Create a data structure (stack, queue, hash table)
- Write a command-line tool
- Build a simple WASM module

Remember: Rust's compiler is your friend! It provides excellent error messages that teach you the language as you go.
