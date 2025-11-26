use crate::aggregation::{AggOp, AggregationEngine};
use crate::config::{PivotConfig, AggregateConfig, FilterConfig};
use crate::convertor::ipc::batches_to_ipc;
use crate::data::csv_parser::csv_to_batches;
use crate::data::json_parser::json_to_batches;
use crate::filter::FilterEngine;
use crate::pivot::PivotEngine;
use crate::logs::rust_logger::log as rust_logger;
#[cfg(target_arch = "wasm32")]
use crate::logs::web_logger::log as logger;
use arrow::array::{Array, RecordBatch};
use std::collections::HashMap;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
#[cfg(not(target_arch = "wasm32"))]
use wasm_bindgen::JsValue;

/// Main data engine for processing tabular data
pub struct DataEngine {
    data: HashMap<String, Vec<RecordBatch>>,
}

/// WASM wrapper for DataEngine
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct WasmDataEngine {
    engine: DataEngine,
}

impl DataEngine {
    /// Create a new DataEngine instance
    pub fn new() -> Self {
        // #[cfg(target_arch = "wasm32")]
        // crate::init_panic_hook();
        Self {
            data: HashMap::from([("data".to_string(), vec![])]),
        }
    }

    pub fn get_data(&self, key: Option<&str>) -> Result<JsValue, JsValue> {
        let data: Option<&Vec<RecordBatch>> = self.data.get(key.unwrap_or("data"));
        let data: &Vec<RecordBatch> = data.unwrap();
        if data.is_empty() {
            return Ok(JsValue::from_str("[]"));
        }

        let ipc_data: Vec<u8> = batches_to_ipc(&data);
        Ok(JsValue::from(ipc_data))
    }

    pub fn get_schema(&self) -> Result<JsValue, JsValue> {
        let data: Option<&Vec<RecordBatch>> = self.data.get("data");
        let data: &Vec<RecordBatch> = data.unwrap();
        if data.is_empty() {
            #[cfg(target_arch = "wasm32")]
            logger("No data available");
            return Ok(JsValue::from_str("[]"));
        }
        let schema = data[0].schema().to_string();

        Ok(JsValue::from_str(&schema))
    }

    pub fn get_data_ipc(&self) -> Result<JsValue, JsValue> {
        let data: Option<&Vec<RecordBatch>> = self.data.get("data");
        let data: &Vec<RecordBatch> = data.unwrap();
        if data.is_empty() {
            #[cfg(target_arch = "wasm32")]
            logger("No data available");
            return Ok(JsValue::from_str("[]"));
        }
        let ipc_value = batches_to_ipc(&data);
        Ok(JsValue::from(ipc_value))
    }

    pub fn load_data_from_csv(&mut self, csv_data: &[u8]) -> Result<JsValue, JsValue> {
        // Test environment implementation
        #[cfg(target_arch = "wasm32")]
        logger("CSV loading started");
        rust_logger("CSV loading started");

        let _ = csv_to_batches(self, csv_data).unwrap();
        #[cfg(target_arch = "wasm32")]
        logger("CSV upload successfully");
        rust_logger("CSV upload successfully");
        Ok(JsValue::from_str("CSV upload successfully"))
    }

    pub fn store_data(&mut self, key: Option<&str>, data: Vec<RecordBatch>) {
        match key {
            Some(key) => self.data.insert(key.to_string(), data),
            None => self.data.insert("data".to_string(), data),
        };
    }

    // Internal API functions
    
    /// Initialize the data engine
    pub fn init_engine() -> DataEngine {
        #[cfg(target_arch = "wasm32")]
        {
            console_error_panic_hook::set_once();
            logger("Data engine initialized");
        }
        rust_logger("Data engine initialized");
        DataEngine::new()
    }

    /// Load CSV data from bytes
    pub fn load_csv(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        self.load_data_from_csv(bytes)
    }

    /// Load JSON data from string
    pub fn load_json(&mut self, json_string: &str) -> Result<JsValue, JsValue> {
        #[cfg(target_arch = "wasm32")]
        logger("JSON loading started");
        rust_logger("JSON loading started");

        match json_to_batches(self, json_string) {
            Ok(_) => {
                #[cfg(target_arch = "wasm32")]
                logger("JSON upload successful");
                rust_logger("JSON upload successful");
                Ok(JsValue::from_str("JSON upload successful"))
            }
            Err(e) => {
                let error_msg = format!("JSON loading failed: {}", e);
                #[cfg(target_arch = "wasm32")]
                logger(&error_msg);
                rust_logger(&error_msg);
                Err(JsValue::from_str(&error_msg))
            }
        }
    }

    /// Perform pivot operation
    pub fn pivot(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        let data = self.data.get("data")
            .ok_or_else(|| JsValue::from_str("No data available for pivot"))?;
        
        // Parse JSON config
        let config: PivotConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid pivot config: {}", e)))?;
        
        let pivot_engine = PivotEngine::new(data);
        match pivot_engine.execute(&config) {
            Ok(result_batches) => {
                self.store_data(Some("pivot_result"), result_batches.clone());
                let ipc_data = batches_to_ipc(&result_batches);
                Ok(JsValue::from(ipc_data))
            }
            Err(e) => Err(JsValue::from_str(&format!("Pivot operation failed: {}", e)))
        }
    }

    /// Perform aggregation operation
    pub fn aggregate(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        let data = self.data.get("data")
            .ok_or_else(|| JsValue::from_str("No data available for aggregation"))?;
        
        // Parse JSON config
        let config: AggregateConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid aggregate config: {}", e)))?;
        
        let agg_engine = AggregationEngine::new(data);
        match agg_engine.execute(&config) {
            Ok(result_batches) => {
                self.store_data(Some("aggregate_result"), result_batches.clone());
                let ipc_data = batches_to_ipc(&result_batches);
                Ok(JsValue::from(ipc_data))
            }
            Err(e) => Err(JsValue::from_str(&format!("Aggregation operation failed: {}", e)))
        }
    }

    /// Perform filter operation
    pub fn filter(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        let data = self.data.get("data")
            .ok_or_else(|| JsValue::from_str("No data available for filtering"))?;
        
        // Parse JSON config
        let config: FilterConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid filter config: {}", e)))?;
        
        let filter_engine = FilterEngine::new(data);
        match filter_engine.execute(&config) {
            Ok(result_batches) => {
                self.store_data(Some("filter_result"), result_batches.clone());
                let ipc_data = batches_to_ipc(&result_batches);
                Ok(JsValue::from(ipc_data))
            }
            Err(e) => Err(JsValue::from_str(&format!("Filter operation failed: {}", e)))
        }
    }

    /// Export data as Arrow IPC buffer
    pub fn export_arrow(&self) -> Result<JsValue, JsValue> {
        self.get_data_ipc()
    }

    /// Get data as JSON (for small datasets)
    pub fn get_data_json(&self) -> Result<JsValue, JsValue> {
        let data = self.data.get("data")
            .ok_or_else(|| JsValue::from_str("No data available"))?;
        
        if data.is_empty() {
            return Ok(JsValue::from_str("[]"));
        }

        // Convert first batch to JSON for demonstration
        // In production, you'd want to handle multiple batches and size limits
        let batch = &data[0];
        let mut json_rows = Vec::new();
        
        for row_idx in 0..batch.num_rows() {
            let mut row_obj = serde_json::Map::new();
            
            for (col_idx, field) in batch.schema().fields().iter().enumerate() {
                let column = batch.column(col_idx);
                let field_name = field.name();
                
                // Simple value extraction - extend for more data types
                let value = match column.data_type() {
                    arrow::datatypes::DataType::Utf8 => {
                        let string_array = column.as_any().downcast_ref::<arrow::array::StringArray>().unwrap();
                        if string_array.is_null(row_idx) {
                            serde_json::Value::Null
                        } else {
                            serde_json::Value::String(string_array.value(row_idx).to_string())
                        }
                    }
                    arrow::datatypes::DataType::Float64 => {
                        let float_array = column.as_any().downcast_ref::<arrow::array::Float64Array>().unwrap();
                        if float_array.is_null(row_idx) {
                            serde_json::Value::Null
                        } else {
                            serde_json::Value::Number(serde_json::Number::from_f64(float_array.value(row_idx)).unwrap_or(serde_json::Number::from(0)))
                        }
                    }
                    _ => serde_json::Value::String(format!("unsupported_type_{}", row_idx))
                };
                
                row_obj.insert(field_name.clone(), value);
            }
            
            json_rows.push(serde_json::Value::Object(row_obj));
        }
        
        let json_result = serde_json::Value::Array(json_rows);
        match serde_json::to_string(&json_result) {
            Ok(json_string) => Ok(JsValue::from_str(&json_string)),
            Err(e) => Err(JsValue::from_str(&format!("JSON serialization failed: {}", e)))
        }
    }

    // Legacy aggregation method for backward compatibility
    pub fn aggregation(&self, col_name: &str, op: AggOp) -> Result<f64, String> {
        if self.data.get("data").is_none() {
            return Err("No data available".to_string());
        }
        rust_logger("Inside Aggregation");
        let aggregation = AggregationEngine::new(&self.data.get("data").unwrap());
        aggregation.execute_simple(col_name, op)
    }
}

// WASM wrapper implementation
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl WasmDataEngine {
    /// Create a new WasmDataEngine instance
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new() -> Self {
        Self {
            engine: DataEngine::init_engine(),
        }
    }

    /// Load CSV data from bytes
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn load_csv(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        self.engine.load_csv(bytes)
    }

    /// Load JSON data from string
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn load_json(&mut self, json_string: &str) -> Result<JsValue, JsValue> {
        self.engine.load_json(json_string)
    }

    /// Get schema information
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_schema(&self) -> Result<JsValue, JsValue> {
        self.engine.get_schema()
    }

    /// Perform pivot operation
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn pivot(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        self.engine.pivot(config_json)
    }

    /// Perform aggregation operation
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn aggregate(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        self.engine.aggregate(config_json)
    }

    /// Perform filter operation
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn filter(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        self.engine.filter(config_json)
    }

    /// Export data as Arrow IPC buffer
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn export_arrow(&self) -> Result<JsValue, JsValue> {
        self.engine.export_arrow()
    }

    /// Get data as JSON (for small datasets)
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_data_json(&self) -> Result<JsValue, JsValue> {
        self.engine.get_data_json()
    }
}
