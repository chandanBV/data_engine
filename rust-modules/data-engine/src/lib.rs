//! # Data Engine
//!
//! A WebAssembly-powered data processing engine for tabular data using Apache Arrow.
//!
//! This library provides efficient CSV processing and data manipulation capabilities
//! that can run in web browsers through WebAssembly.

use wasm_bindgen::prelude::*;

// Declare modules
pub mod aggregation;
pub mod convertor;
pub mod data;
pub mod engine;
pub mod filter;
pub mod logs;

#[cfg(test)]
pub mod tests;

// Re-export public API
// pub use data;
pub use engine::DataEngine;
pub use logs::rust_logger;
pub use logs::web_logger;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Extension points for advanced features:
// 1. Implement Arrow format support for zero-copy data transfer
// 2. Add streaming API for processing large datasets in chunks
// 3. Implement custom binary serialization for better performance
// 4. Add support for more complex aggregations (percentiles, variance, etc.)
// 5. Implement indexing for faster filtering operations
