use crate::aggregation::{AggOp, Aggregation};
use crate::convertor::ipc::batches_to_ipc;
use crate::data::csv_parser::csv_to_batches;
use crate::logs::rust_logger::log as rust_logger;
#[cfg(target_arch = "wasm32")]
use crate::logs::web_logger::log as logger;
use arrow::array::RecordBatch;
use std::collections::HashMap;
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

    pub fn aggregation(&self, col_name: &str, op: AggOp) -> Result<f64, String> {
        if self.data.get("data").is_none() {
            return Err("No data available".to_string());
        }
        rust_logger("Inside Aggregation");
        let aggregation = Aggregation::new(&self.data.get("data").unwrap());
        let res = aggregation.execute(col_name, op);
        Ok(res.unwrap())
    }
}
