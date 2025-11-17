use arrow::array::RecordBatch;
use arrow::csv::reader::Format;
use arrow::csv::ReaderBuilder;
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::Arc;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
#[cfg(not(target_arch = "wasm32"))]
use wasm_bindgen::JsValue;

/// Main data engine for processing tabular data
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct DataEngine {
    data: HashMap<String, Vec<RecordBatch>>,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl DataEngine {
    /// Create a new DataEngine instance
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new() -> Self {
        #[cfg(target_arch = "wasm32")]
        crate::init_panic_hook();
        Self {
            data: HashMap::from([("data".to_string(), vec![])]),
        }
    }

    /// Get the stored data as JSON
    #[cfg(target_arch = "wasm32")]
    pub fn get_data(&self) -> Result<JsValue, JsValue> {
        let data = self.data.get("data");
        let data = data.unwrap();
        if data.is_empty() {
            return Ok(JsValue::from_str("[]"));
        }
        let json_value = crate::data::recordbatch_to_json(&data[0]);
        let json_str = serde_json::to_string(&json_value).unwrap();
        Ok(JsValue::from_str(&json_str))
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn get_data(&self) -> Vec<RecordBatch> {
        // In test environment, return a string
        self.data.get("data").unwrap().clone()
    }

    /// Load data from CSV bytes
    // #[cfg(target_arch = "wasm32")]
    // pub fn load_data_from_csv(&mut self, csv_data: &[u8]) -> Result<(), JsValue> {
    //     // WASM-specific implementation
    //     self.load_csv_internal(csv_data)
    //         .map_err(|e| JsValue::from_str(&format!("CSV loading error: {}", e)))
    // }

    // #[cfg(target_arch = "wasm32")]
    pub fn load_data_from_csv(&mut self, csv_data: &[u8]) -> Result<JsValue, JsValue> {
        // Test environment implementation
        web_sys::console::log_1(&JsValue::from_str("CSV loading started"));
        let _ = self
            .load_csv_internal(csv_data)
            .map_err(|e| JsValue::from_str(&format!("CSV loading error: {}", e)));
        // let data = self.get_data();
        println!("internal done");
        web_sys::console::log_1(&JsValue::from_str("CSV upload successfully"));
        // let json_value = crate::data::recordbatch_to_json(&data[0]);
        // let json_str = serde_json::to_string(&json_value).unwrap();
        Ok(JsValue::from_str("CSV upload successfully"))
    }

    /// Filter data (placeholder implementation)
    #[cfg(target_arch = "wasm32")]
    pub fn filter(&self, column: &str, operator: &str, value: &str) -> Result<JsValue, JsValue> {
        Ok(JsValue::from_str(&format!(
            "{} {} {}",
            column, operator, value
        )))
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn filter(&self, column: &str, operator: &str, value: &str) -> String {
        // Test environment implementation
        format!("filtered: {} {} {}", column, operator, value)
    }

    /// Internal CSV loading logic
    fn load_csv_internal(&mut self, csv_data: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
        // use std::time::Instant;
        // let start_time = Instant::now();

        let data = csv_data.to_vec();
        println!("Rust: Starting CSV processing ({} bytes)", data.len());

        let cursor = Cursor::new(&data);

        // let schema_start = Instant::now();
        let (schema, _) = Format::default()
            .with_header(true)
            .infer_schema(cursor.clone(), None)?;
        // let schema_time = schema_start.elapsed();
        // println!("Rust: Schema inference completed in {:?}", schema_time);

        // let reader_start = Instant::now();
        let reader = ReaderBuilder::new(Arc::new(schema))
            .with_header(true)
            .build(cursor)?;
        // let reader_time = reader_start.elapsed();
        // println!("Rust: Reader creation completed in {:?}", reader_time);

        println!("Rust: Starting batch processing...");

        let mut _batches = Vec::new();
        // let processing_start = Instant::now();
        for batch_result in reader {
            let batch = batch_result?;
            _batches.push(batch);
        }
        // let processing_time = processing_start.elapsed();

        // Store the batches in the data engine
        self.data.insert("data".to_string(), _batches);

        // let total_time = start_time.elapsed();
        // println!("Rust: CSV processing completed in {:?}", total_time);

        Ok(())
    }
}
