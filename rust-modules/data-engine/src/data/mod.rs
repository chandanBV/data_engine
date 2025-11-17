use arrow::array::{Array, BooleanArray, Float64Array, Int32Array, Int64Array, StringArray};
use arrow::array::RecordBatch;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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

/// Convert a RecordBatch to a vector of JSON values
pub fn recordbatch_to_json(batch: &RecordBatch) -> Vec<Value> {
    let schema = batch.schema();
    let mut rows = Vec::with_capacity(batch.num_rows());

    for row_idx in 0..batch.num_rows() {
        let mut obj = serde_json::Map::new();

        for (col_idx, field) in schema.fields().iter().enumerate() {
            let array = batch.column(col_idx);
            let name = field.name();

            let value = match array.data_type() {
                arrow::datatypes::DataType::Utf8 => {
                    let arr = array.as_any().downcast_ref::<StringArray>().unwrap();
                    if arr.is_null(row_idx) {
                        json!(null)
                    } else {
                        json!(arr.value(row_idx))
                    }
                }
                arrow::datatypes::DataType::Int64 => {
                    let arr = array.as_any().downcast_ref::<Int64Array>().unwrap();
                    if arr.is_null(row_idx) {
                        json!(null)
                    } else {
                        json!(arr.value(row_idx))
                    }
                }
                arrow::datatypes::DataType::Int32 => {
                    let arr = array.as_any().downcast_ref::<Int32Array>().unwrap();
                    if arr.is_null(row_idx) {
                        json!(null)
                    } else {
                        json!(arr.value(row_idx))
                    }
                }
                arrow::datatypes::DataType::Float64 => {
                    let arr = array.as_any().downcast_ref::<Float64Array>().unwrap();
                    if arr.is_null(row_idx) {
                        json!(null)
                    } else {
                        json!(arr.value(row_idx))
                    }
                }
                arrow::datatypes::DataType::Boolean => {
                    let arr = array.as_any().downcast_ref::<BooleanArray>().unwrap();
                    if arr.is_null(row_idx) {
                        json!(null)
                    } else {
                        json!(arr.value(row_idx))
                    }
                }

                // fallback for unsupported types
                _ => json!(null),
            };

            obj.insert(name.clone(), value);
        }

        rows.push(Value::Object(obj));
    }

    rows
}
