use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Data row structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataRow {
    pub id: u32,
    pub category: String,
    pub sales: f64,
    pub region: String,
}

/// Query execution plan step
#[derive(Serialize, Deserialize, Debug)]
pub struct QueryPlanStep {
    pub operation: String,
    pub cost: f64,
    pub rows_estimated: usize,
}

/// Query execution result
#[derive(Serialize, Deserialize, Debug)]
pub struct QueryResult {
    pub rows: Vec<serde_json::Value>,
    pub execution_time_ms: f64,
    pub rows_scanned: usize,
}

/// Simple SQL-like query engine
#[wasm_bindgen]
pub struct QueryEngine {
    data: Vec<DataRow>,
}

#[wasm_bindgen]
impl QueryEngine {
    /// Create a new QueryEngine
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        init_panic_hook();
        Self { data: Vec::new() }
    }

    /// Load data from JSON
    pub fn load_data(&mut self, json_data: &str) -> Result<(), JsValue> {
        self.data = serde_json::from_str(json_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse JSON: {}", e)))?;
        Ok(())
    }

    /// Execute a simple query (simplified for demo)
    /// In production, use a proper SQL parser like sqlparser-rs
    pub fn execute_query(&self, query: &str) -> Result<JsValue, JsValue> {
        let query_lower = query.to_lowercase();
        let start_time = js_sys::Date::now();

        let result_rows: Vec<serde_json::Value> = if query_lower.contains("where sales >") {
            // Simple filter query
            let threshold = self.extract_number_from_query(&query_lower, "where sales >")
                .unwrap_or(0.0);
            
            self.data
                .iter()
                .filter(|row| row.sales > threshold)
                .map(|row| serde_json::to_value(row).unwrap())
                .collect()
        } else if query_lower.contains("group by category") {
            // Aggregate by category
            self.aggregate_by_category()
        } else if query_lower.contains("group by region") {
            // Aggregate by region
            self.aggregate_by_region()
        } else {
            // Default: return all data
            self.data
                .iter()
                .map(|row| serde_json::to_value(row).unwrap())
                .collect()
        };

        let execution_time = js_sys::Date::now() - start_time;

        let result = QueryResult {
            rows: result_rows,
            execution_time_ms: execution_time,
            rows_scanned: self.data.len(),
        };

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Generate query execution plan
    pub fn explain_query(&self, query: &str) -> Result<JsValue, JsValue> {
        let query_lower = query.to_lowercase();
        let mut steps = Vec::new();

        // Parse query and generate plan
        steps.push(QueryPlanStep {
            operation: "Parse SQL".to_string(),
            cost: 0.1,
            rows_estimated: 0,
        });

        steps.push(QueryPlanStep {
            operation: "Validate Schema".to_string(),
            cost: 0.1,
            rows_estimated: 0,
        });

        if query_lower.contains("where") {
            steps.push(QueryPlanStep {
                operation: "Filter Scan".to_string(),
                cost: (self.data.len() as f64) * 0.001,
                rows_estimated: self.data.len() / 2,
            });
        }

        if query_lower.contains("group by") {
            steps.push(QueryPlanStep {
                operation: "Hash Aggregate".to_string(),
                cost: (self.data.len() as f64) * 0.002,
                rows_estimated: 10,
            });
        }

        if query_lower.contains("order by") {
            steps.push(QueryPlanStep {
                operation: "Sort".to_string(),
                cost: (self.data.len() as f64) * 0.003,
                rows_estimated: 10,
            });
        }

        serde_wasm_bindgen::to_value(&steps)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    // Helper methods
    fn extract_number_from_query(&self, query: &str, after: &str) -> Option<f64> {
        query
            .split(after)
            .nth(1)?
            .split_whitespace()
            .next()?
            .parse()
            .ok()
    }

    fn aggregate_by_category(&self) -> Vec<serde_json::Value> {
        let mut agg: HashMap<String, (f64, usize)> = HashMap::new();
        
        for row in &self.data {
            let entry = agg.entry(row.category.clone()).or_insert((0.0, 0));
            entry.0 += row.sales;
            entry.1 += 1;
        }

        agg.into_iter()
            .map(|(category, (total, count))| {
                serde_json::json!({
                    "category": category,
                    "total_sales": total,
                    "count": count,
                    "avg_sales": total / count as f64
                })
            })
            .collect()
    }

    fn aggregate_by_region(&self) -> Vec<serde_json::Value> {
        let mut agg: HashMap<String, (f64, usize)> = HashMap::new();
        
        for row in &self.data {
            let entry = agg.entry(row.region.clone()).or_insert((0.0, 0));
            entry.0 += row.sales;
            entry.1 += 1;
        }

        agg.into_iter()
            .map(|(region, (total, count))| {
                serde_json::json!({
                    "region": region,
                    "total_sales": total,
                    "count": count,
                    "avg_sales": total / count as f64
                })
            })
            .collect()
    }
}

// Extension points:
// 1. Integrate sqlparser-rs for full SQL support
// 2. Implement query optimization rules
// 3. Add index support for faster lookups
// 4. Implement join algorithms (nested loop, hash join, merge join)
// 5. Add query result caching
// 6. Implement EXPLAIN ANALYZE for actual execution stats
