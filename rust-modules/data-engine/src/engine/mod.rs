use crate::aggregation::{AggOp, AggregationEngine};
use crate::config::{AggregateConfig, FilterConfig, PivotConfig};
use crate::convertor::ipc::batches_to_ipc;
use crate::data::csv_parser::csv_to_batches;
use crate::data::excel_parser::{excel_to_batches, get_excel_sheet_names};
use crate::data::json_parser::json_to_batches;
use crate::data::parquet_parser::parquet_to_batches;
use crate::filter::FilterEngine;
use crate::logs::rust_logger::log as rust_logger;
#[cfg(target_arch = "wasm32")]
use crate::logs::web_logger::log as logger;
use crate::pivot::PivotEngine;
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

    /// Save current data as original (for reset functionality)
    pub fn save_original(&mut self) {
        if let Some(data) = self.data.get("data") {
            self.data.insert("original".to_string(), data.clone());
        }
    }

    /// Restore original data (for reset functionality)
    pub fn restore_original(&mut self) -> Result<(), String> {
        if let Some(original) = self.data.get("original") {
            self.data.insert("data".to_string(), original.clone());
            Ok(())
        } else {
            Err("No original data to restore".to_string())
        }
    }

    /// Load CSV data from bytes
    pub fn load_csv(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        let result = self.load_data_from_csv(bytes);
        // Save original data after loading
        if result.is_ok() {
            self.save_original();
        }
        result
    }

    /// Load CSV data with custom batch size for better performance
    /// Returns total row count for progress tracking
    pub fn load_csv_with_batch_size(
        &mut self,
        bytes: &[u8],
        batch_size: usize,
    ) -> Result<JsValue, JsValue> {
        #[cfg(target_arch = "wasm32")]
        logger(&format!(
            "CSV loading started with batch size: {}",
            batch_size
        ));
        rust_logger(&format!(
            "CSV loading started with batch size: {}",
            batch_size
        ));

        match crate::data::csv_parser::csv_to_batches_with_batch_size(self, bytes, batch_size) {
            Ok(total_rows) => {
                #[cfg(target_arch = "wasm32")]
                logger(&format!("CSV upload successful ({} rows)", total_rows));
                rust_logger(&format!("CSV upload successful ({} rows)", total_rows));
                // Save original data after loading
                self.save_original();
                Ok(JsValue::from_str(&format!(
                    "{{\"status\":\"success\",\"rows\":{}}}",
                    total_rows
                )))
            }
            Err(e) => {
                let error_msg = format!("CSV loading failed: {}", e);
                #[cfg(target_arch = "wasm32")]
                logger(&error_msg);
                rust_logger(&error_msg);
                Err(JsValue::from_str(&error_msg))
            }
        }
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
                // Save original data after loading
                self.save_original();
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

    /// Load Parquet data from bytes
    pub fn load_parquet(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        #[cfg(target_arch = "wasm32")]
        logger("Parquet loading started");
        rust_logger("Parquet loading started");

        match parquet_to_batches(self, bytes) {
            Ok(_) => {
                #[cfg(target_arch = "wasm32")]
                logger("Parquet upload successful");
                rust_logger("Parquet upload successful");
                // Save original data after loading
                self.save_original();
                Ok(JsValue::from_str("Parquet upload successful"))
            }
            Err(e) => {
                let error_msg = format!("Parquet loading failed: {}", e);
                #[cfg(target_arch = "wasm32")]
                logger(&error_msg);
                rust_logger(&error_msg);
                Err(JsValue::from_str(&error_msg))
            }
        }
    }

    /// Get list of sheet names from Excel file
    pub fn get_excel_sheets(&self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        #[cfg(target_arch = "wasm32")]
        logger("Getting Excel sheet names");
        rust_logger("Getting Excel sheet names");

        match get_excel_sheet_names(bytes) {
            Ok(sheets) => match serde_json::to_string(&sheets) {
                Ok(json) => Ok(JsValue::from_str(&json)),
                Err(e) => Err(JsValue::from_str(&format!(
                    "Failed to serialize sheet names: {}",
                    e
                ))),
            },
            Err(e) => {
                let error_msg = format!("Failed to get Excel sheets: {}", e);
                #[cfg(target_arch = "wasm32")]
                logger(&error_msg);
                rust_logger(&error_msg);
                Err(JsValue::from_str(&error_msg))
            }
        }
    }

    /// Load Excel data from bytes (supports .xlsx and .xls)
    /// Loads the first sheet by default
    pub fn load_excel(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        self.load_excel_sheet(bytes, None)
    }

    /// Load specific sheet from Excel data
    pub fn load_excel_sheet(
        &mut self,
        bytes: &[u8],
        sheet_name: Option<&str>,
    ) -> Result<JsValue, JsValue> {
        #[cfg(target_arch = "wasm32")]
        logger("Excel loading started");
        rust_logger("Excel loading started");

        match excel_to_batches(self, bytes, sheet_name) {
            Ok(_) => {
                let msg = match sheet_name {
                    Some(name) => format!("Excel sheet '{}' uploaded successfully", name),
                    None => "Excel upload successful".to_string(),
                };
                #[cfg(target_arch = "wasm32")]
                logger(&msg);
                rust_logger(&msg);
                // Save original data after loading
                self.save_original();
                Ok(JsValue::from_str(&msg))
            }
            Err(e) => {
                let error_msg = format!("Excel loading failed: {}", e);
                #[cfg(target_arch = "wasm32")]
                logger(&error_msg);
                rust_logger(&error_msg);
                Err(JsValue::from_str(&error_msg))
            }
        }
    }

    /// Perform pivot operation
    pub fn pivot(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        let data = self
            .data
            .get("data")
            .ok_or_else(|| JsValue::from_str("No data available for pivot"))?;

        // Parse JSON config
        let config: PivotConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid pivot config: {}", e)))?;

        let pivot_engine = PivotEngine::new(data);
        match pivot_engine.execute(&config) {
            Ok(result_batches) => {
                // Store in main "data" key so get_data_json can retrieve it
                self.store_data(None, result_batches.clone());
                // Return JSON instead of IPC for better web performance
                self.get_data_json_limit(10000) // Return first 10K rows as JSON
            }
            Err(e) => Err(JsValue::from_str(&format!("Pivot operation failed: {}", e))),
        }
    }

    /// Perform aggregation operation
    pub fn aggregate(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        let data = self
            .data
            .get("data")
            .ok_or_else(|| JsValue::from_str("No data available for aggregation"))?;

        // Parse JSON config
        let config: AggregateConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid aggregate config: {}", e)))?;

        let agg_engine = AggregationEngine::new(data);
        match agg_engine.execute(&config) {
            Ok(result_batches) => {
                // Store in main "data" key so get_data_json can retrieve it
                self.store_data(None, result_batches.clone());
                // Return JSON instead of IPC for better web performance
                self.get_data_json_limit(10000) // Return first 10K rows as JSON
            }
            Err(e) => Err(JsValue::from_str(&format!(
                "Aggregation operation failed: {}",
                e
            ))),
        }
    }

    /// Perform filter operation
    pub fn filter(&mut self, config_json: &str) -> Result<JsValue, JsValue> {
        let data = self
            .data
            .get("data")
            .ok_or_else(|| JsValue::from_str("No data available for filtering"))?;

        // Parse JSON config
        let config: FilterConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid filter config: {}", e)))?;

        let filter_engine = FilterEngine::new(data);
        match filter_engine.execute(&config) {
            Ok(result_batches) => {
                // Store in main "data" key so get_data_json can retrieve it
                self.store_data(None, result_batches.clone());
                // Return JSON instead of IPC for better web performance
                self.get_data_json_limit(10000) // Return first 10K rows as JSON
            }
            Err(e) => Err(JsValue::from_str(&format!(
                "Filter operation failed: {}",
                e
            ))),
        }
    }

    /// Export data as Arrow IPC buffer
    pub fn export_arrow(&self) -> Result<JsValue, JsValue> {
        self.get_data_ipc()
    }

    /// Get data as JSON (supports all batches and data types)
    /// Returns first 100 rows by default for performance
    pub fn get_data_json(&self) -> Result<JsValue, JsValue> {
        self.get_data_json_limit(100)
    }

    /// Get total row count across all batches
    pub fn get_row_count(&self) -> usize {
        self.data
            .get("data")
            .map(|batches| batches.iter().map(|b| b.num_rows()).sum())
            .unwrap_or(0)
    }

    /// Get data as JSON with custom row limit
    pub fn get_data_json_limit(&self, limit: usize) -> Result<JsValue, JsValue> {
        self.get_data_json_paginated(0, limit)
    }

    /// Get data as JSON with pagination (offset and limit)
    pub fn get_data_json_paginated(&self, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        let data = self
            .data
            .get("data")
            .ok_or_else(|| JsValue::from_str("No data available"))?;

        if data.is_empty() {
            return Ok(JsValue::from_str("[]"));
        }

        // Process batches starting from offset up to limit
        let mut json_rows = Vec::new();
        let mut rows_processed = 0;
        let mut global_row_idx = 0;

        'outer: for batch in data.iter() {
            for row_idx in 0..batch.num_rows() {
                // Skip rows until we reach the offset
                if global_row_idx < offset {
                    global_row_idx += 1;
                    continue;
                }

                // Stop if we've reached the limit
                if rows_processed >= limit {
                    break 'outer;
                }

                let mut row_obj = serde_json::Map::new();

                for (col_idx, field) in batch.schema().fields().iter().enumerate() {
                    let column = batch.column(col_idx);
                    let field_name = field.name();

                    // Handle all Arrow data types (same as get_data_json_limit)
                    let value = match column.data_type() {
                        arrow::datatypes::DataType::Utf8 => {
                            let string_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::StringArray>()
                                .unwrap();
                            if string_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::String(string_array.value(row_idx).to_string())
                            }
                        }
                        arrow::datatypes::DataType::LargeUtf8 => {
                            let string_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::LargeStringArray>()
                                .unwrap();
                            if string_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::String(string_array.value(row_idx).to_string())
                            }
                        }
                        arrow::datatypes::DataType::Int8 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::Int8Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::Int16 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::Int16Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::Int32 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::Int32Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::Int64 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::Int64Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::UInt8 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::UInt8Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::UInt16 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::UInt16Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::UInt32 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::UInt32Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::UInt64 => {
                            let int_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::UInt64Array>()
                                .unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(
                                    int_array.value(row_idx),
                                ))
                            }
                        }
                        arrow::datatypes::DataType::Float32 => {
                            let float_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::Float32Array>()
                                .unwrap();
                            if float_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(
                                    serde_json::Number::from_f64(float_array.value(row_idx) as f64)
                                        .unwrap_or(serde_json::Number::from(0)),
                                )
                            }
                        }
                        arrow::datatypes::DataType::Float64 => {
                            let float_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::Float64Array>()
                                .unwrap();
                            if float_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(
                                    serde_json::Number::from_f64(float_array.value(row_idx))
                                        .unwrap_or(serde_json::Number::from(0)),
                                )
                            }
                        }
                        arrow::datatypes::DataType::Boolean => {
                            let bool_array = column
                                .as_any()
                                .downcast_ref::<arrow::array::BooleanArray>()
                                .unwrap();
                            if bool_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Bool(bool_array.value(row_idx))
                            }
                        }
                        arrow::datatypes::DataType::Date32 => {
                            let array = column.as_any().downcast_ref::<arrow::array::Date32Array>().unwrap();
                            if array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                match array.value_as_date(row_idx) {
                                    Some(date) => serde_json::Value::String(date.to_string()),
                                    None => serde_json::Value::Null,
                                }
                            }
                        }
                        arrow::datatypes::DataType::Date64 => {
                            let array = column.as_any().downcast_ref::<arrow::array::Date64Array>().unwrap();
                            if array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                match array.value_as_date(row_idx) {
                                    Some(date) => serde_json::Value::String(date.to_string()),
                                    None => serde_json::Value::Null,
                                }
                            }
                        }
                        arrow::datatypes::DataType::Timestamp(unit, _) => {
                            match unit {
                                arrow::datatypes::TimeUnit::Nanosecond => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampNanosecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                                arrow::datatypes::TimeUnit::Microsecond => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampMicrosecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                                arrow::datatypes::TimeUnit::Millisecond => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampMillisecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                                arrow::datatypes::TimeUnit::Second => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampSecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                            }
                        }
                        arrow::datatypes::DataType::Null => serde_json::Value::Null,
                        _ => {
                            // For unsupported types, convert to string representation
                            serde_json::Value::String(format!("{:?}", column))
                        }
                    };

                    row_obj.insert(field_name.clone(), value);
                }

                json_rows.push(serde_json::Value::Object(row_obj));
                rows_processed += 1;
                global_row_idx += 1;
            }
        }

        let json_result = serde_json::Value::Array(json_rows);
        match serde_json::to_string(&json_result) {
            Ok(json_string) => Ok(JsValue::from_str(&json_string)),
            Err(e) => Err(JsValue::from_str(&format!(
                "JSON serialization failed: {}",
                e
            ))),
        }
    }

    /// Get data as JSON within a specific window (start_row to end_row)
    pub fn get_data_json_window(&self, start_row: usize, end_row: usize) -> Result<JsValue, JsValue> {
        let data = self.data.get("data")
            .ok_or_else(|| JsValue::from_str("No data available"))?;
        
        if data.is_empty() {
            return Ok(JsValue::from_str("[]"));
        }

        let total_rows = self.get_row_count();
        if start_row >= total_rows {
             return Ok(JsValue::from_str("[]"));
        }

        let end_row = std::cmp::min(end_row, total_rows);
        let limit = end_row - start_row;

        let mut json_rows = Vec::new();
        let mut rows_skipped = 0;
        let mut rows_processed = 0;
        
        'outer: for batch in data.iter() {
            let batch_rows = batch.num_rows();
            
            // Skip entire batches if we haven't reached start_row yet
            if rows_skipped + batch_rows <= start_row {
                rows_skipped += batch_rows;
                continue;
            }

            // In this batch, find where to start
            let start_in_batch = if rows_skipped < start_row {
                start_row - rows_skipped
            } else {
                0
            };

            for row_idx in start_in_batch..batch_rows {
                if rows_processed >= limit {
                    break 'outer;
                }
                
                let mut row_obj = serde_json::Map::new();
                
                for (col_idx, field) in batch.schema().fields().iter().enumerate() {
                    let column = batch.column(col_idx);
                    let field_name = field.name();
                    
                    // Handle all Arrow data types
                    let value = match column.data_type() {
                        arrow::datatypes::DataType::Utf8 => {
                            let string_array = column.as_any().downcast_ref::<arrow::array::StringArray>().unwrap();
                            if string_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::String(string_array.value(row_idx).to_string())
                            }
                        }
                        arrow::datatypes::DataType::LargeUtf8 => {
                            let string_array = column.as_any().downcast_ref::<arrow::array::LargeStringArray>().unwrap();
                            if string_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::String(string_array.value(row_idx).to_string())
                            }
                        }
                        arrow::datatypes::DataType::Int8 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::Int8Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::Int16 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::Int16Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::Int32 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::Int32Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::Int64 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::Int64Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::UInt8 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::UInt8Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::UInt16 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::UInt16Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::UInt32 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::UInt32Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::UInt64 => {
                            let int_array = column.as_any().downcast_ref::<arrow::array::UInt64Array>().unwrap();
                            if int_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from(int_array.value(row_idx)))
                            }
                        }
                        arrow::datatypes::DataType::Float32 => {
                            let float_array = column.as_any().downcast_ref::<arrow::array::Float32Array>().unwrap();
                            if float_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Number(serde_json::Number::from_f64(float_array.value(row_idx) as f64).unwrap_or(serde_json::Number::from(0)))
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
                        arrow::datatypes::DataType::Boolean => {
                            let bool_array = column.as_any().downcast_ref::<arrow::array::BooleanArray>().unwrap();
                            if bool_array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                serde_json::Value::Bool(bool_array.value(row_idx))
                            }
                        }
                        arrow::datatypes::DataType::Date32 => {
                            let array = column.as_any().downcast_ref::<arrow::array::Date32Array>().unwrap();
                            if array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                match array.value_as_date(row_idx) {
                                    Some(date) => serde_json::Value::String(date.to_string()),
                                    None => serde_json::Value::Null,
                                }
                            }
                        }
                        arrow::datatypes::DataType::Date64 => {
                            let array = column.as_any().downcast_ref::<arrow::array::Date64Array>().unwrap();
                            if array.is_null(row_idx) {
                                serde_json::Value::Null
                            } else {
                                match array.value_as_date(row_idx) {
                                    Some(date) => serde_json::Value::String(date.to_string()),
                                    None => serde_json::Value::Null,
                                }
                            }
                        }
                        arrow::datatypes::DataType::Timestamp(unit, _) => {
                            match unit {
                                arrow::datatypes::TimeUnit::Nanosecond => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampNanosecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                                arrow::datatypes::TimeUnit::Microsecond => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampMicrosecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                                arrow::datatypes::TimeUnit::Millisecond => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampMillisecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                                arrow::datatypes::TimeUnit::Second => {
                                    let array = column.as_any().downcast_ref::<arrow::array::TimestampSecondArray>().unwrap();
                                    if array.is_null(row_idx) {
                                        serde_json::Value::Null
                                    } else {
                                        match array.value_as_datetime(row_idx) {
                                            Some(dt) => serde_json::Value::String(dt.to_string()),
                                            None => serde_json::Value::Null,
                                        }
                                    }
                                }
                            }
                        }
                        arrow::datatypes::DataType::Null => {
                            serde_json::Value::Null
                        }
                        _ => {
                            serde_json::Value::String(format!("{:?}", column))
                        }
                    };
                    
                    row_obj.insert(field_name.clone(), value);
                }
                
                json_rows.push(serde_json::Value::Object(row_obj));
                rows_processed += 1;
            }
            rows_skipped += batch_rows;
        }
        
        let json_result = serde_json::Value::Array(json_rows);
        match serde_json::to_string(&json_result) {
            Ok(json_string) => Ok(JsValue::from_str(&json_string)),
            Err(e) => Err(JsValue::from_str(&format!("JSON serialization failed: {}", e)))
        }
    }

    /// Get data as JSON within a specific window (start_row to end_row)

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

    /// Load CSV data with custom batch size for better performance
    /// batch_size controls how many rows are processed at once (default: 8192)
    /// Returns JSON with status and row count: {"status":"success","rows":12345}
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn load_csv_with_batch_size(
        &mut self,
        bytes: &[u8],
        batch_size: usize,
    ) -> Result<JsValue, JsValue> {
        self.engine.load_csv_with_batch_size(bytes, batch_size)
    }

    /// Load JSON data from string
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn load_json(&mut self, json_string: &str) -> Result<JsValue, JsValue> {
        self.engine.load_json(json_string)
    }

    /// Load Parquet data from bytes
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn load_parquet(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        self.engine.load_parquet(bytes)
    }

    /// Get list of sheet names from Excel file
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_excel_sheets(&self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        self.engine.get_excel_sheets(bytes)
    }

    /// Load Excel data from bytes (loads first sheet by default)
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn load_excel(&mut self, bytes: &[u8]) -> Result<JsValue, JsValue> {
        self.engine.load_excel(bytes)
    }

    /// Load specific sheet from Excel file
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn load_excel_sheet(&mut self, bytes: &[u8], sheet_name: &str) -> Result<JsValue, JsValue> {
        self.engine.load_excel_sheet(bytes, Some(sheet_name))
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

    /// Get data as Arrow IPC buffer
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_data_ipc(&self) -> Result<JsValue, JsValue> {
        self.engine.get_data_ipc()
    }

    /// Get data as JSON (returns first 100 rows by default)
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_data_json(&self) -> Result<JsValue, JsValue> {
        self.engine.get_data_json()
    }

    /// Get data as JSON with pagination (offset and limit)
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_data_json_paginated(&self, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        self.engine.get_data_json_paginated(offset, limit)
    }

    /// Get data as JSON within a specific window (start_row to end_row)
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_data_json_window(&self, start_row: usize, end_row: usize) -> Result<JsValue, JsValue> {
        self.engine.get_data_json_window(start_row, end_row)
    }



    /// Get total row count
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn get_row_count(&self) -> usize {
        self.engine.get_row_count()
    }

    /// Restore original data (for reset functionality)
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
    pub fn restore_original(&mut self) -> Result<JsValue, JsValue> {
        match self.engine.restore_original() {
            Ok(_) => Ok(JsValue::from_str("Original data restored")),
            Err(e) => Err(JsValue::from_str(&e)),
        }
    }
}
