use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Data structure representing a row in the dataset
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataRow {
    pub id: u32,
    pub category: String,
    pub sales: f64,
    pub region: String,
}

/// Aggregation result structure
#[derive(Serialize, Deserialize, Debug)]
pub struct AggregateResult {
    pub category: String,
    pub count: usize,
    pub total_sales: f64,
    pub avg_sales: f64,
}

/// Main data engine for processing tabular data
#[wasm_bindgen]
pub struct DataEngine {
    data: Vec<DataRow>,
}

#[wasm_bindgen]
impl DataEngine {
    /// Create a new DataEngine instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        init_panic_hook();
        Self { data: Vec::new() }
    }

    /// Load data from JSON string
    pub fn load_data(&mut self, json_data: &str) -> Result<(), JsValue> {
        self.data = serde_json::from_str(json_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse JSON: {}", e)))?;
        Ok(())
    }

    /// Get the number of rows loaded
    pub fn row_count(&self) -> usize {
        self.data.len()
    }

    /// Aggregate data by category
    pub fn aggregate_by_category(&self) -> Result<JsValue, JsValue> {
        let mut aggregates: HashMap<String, (usize, f64)> = HashMap::new();

        for row in &self.data {
            let entry = aggregates.entry(row.category.clone()).or_insert((0, 0.0));
            entry.0 += 1;
            entry.1 += row.sales;
        }

        let results: Vec<AggregateResult> = aggregates
            .into_iter()
            .map(|(category, (count, total))| AggregateResult {
                category,
                count,
                total_sales: total,
                avg_sales: total / count as f64,
            })
            .collect();

        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Filter data by minimum sales value
    pub fn filter_by_sales(&self, min_sales: f64) -> Result<JsValue, JsValue> {
        let filtered: Vec<&DataRow> = self.data
            .iter()
            .filter(|row| row.sales >= min_sales)
            .collect();

        serde_wasm_bindgen::to_value(&filtered)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Pivot data: create a region x category matrix
    pub fn pivot_region_category(&self) -> Result<JsValue, JsValue> {
        let mut pivot: HashMap<String, HashMap<String, f64>> = HashMap::new();

        for row in &self.data {
            let region_map = pivot.entry(row.region.clone()).or_insert_with(HashMap::new);
            *region_map.entry(row.category.clone()).or_insert(0.0) += row.sales;
        }

        serde_wasm_bindgen::to_value(&pivot)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

// Extension points for advanced features:
// 1. Implement Arrow format support for zero-copy data transfer
// 2. Add streaming API for processing large datasets in chunks
// 3. Implement custom binary serialization for better performance
// 4. Add support for more complex aggregations (percentiles, variance, etc.)
// 5. Implement indexing for faster filtering operations
