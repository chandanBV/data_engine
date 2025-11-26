use crate::config::AggregateConfig;
use arrow::array::{Array, ArrayRef, Float64Array, StringArray, RecordBatch};
// Manual aggregation implementations to avoid Arrow compute compatibility issues
use arrow::datatypes::{DataType, Field, Schema};
use std::collections::HashMap;
use std::sync::Arc;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone)]
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub enum AggOp {
    Sum,
    Min,
    Max,
    Count,
    Avg,
}

impl AggOp {
    pub fn from_string(s: &str) -> Result<Self, String> {
        match s.to_lowercase().as_str() {
            "sum" => Ok(AggOp::Sum),
            "min" => Ok(AggOp::Min),
            "max" => Ok(AggOp::Max),
            "count" => Ok(AggOp::Count),
            "avg" | "average" => Ok(AggOp::Avg),
            _ => Err(format!("Unsupported aggregation operation: {}", s)),
        }
    }
}

pub struct AggregationEngine<'a> {
    pub data: &'a [RecordBatch],
}

impl<'a> AggregationEngine<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        Self { data }
    }

    pub fn execute(&self, config: &AggregateConfig) -> Result<Vec<RecordBatch>, String> {
        if self.data.is_empty() {
            return Err("No data available for aggregation".to_string());
        }

        let batch = &self.data[0];
        
        if config.group_by_fields.is_empty() {
            // Simple aggregation without grouping
            self.simple_aggregation(batch, config)
        } else {
            // Group by aggregation
            self.group_by_aggregation(batch, config)
        }
    }

    fn simple_aggregation(&self, batch: &RecordBatch, config: &AggregateConfig) -> Result<Vec<RecordBatch>, String> {
        let mut field_names = Vec::new();
        let mut arrays: Vec<ArrayRef> = Vec::new();

        for agg_spec in &config.aggregations {
            let column = batch.column_by_name(&agg_spec.field)
                .ok_or_else(|| format!("Field '{}' not found", agg_spec.field))?;

            let op = AggOp::from_string(&agg_spec.operation)?;
            let result = self.compute_aggregation(column, &op)?;

            let field_name = match &agg_spec.alias {
                Some(alias) => alias.clone(),
                None => format!("{}_{}", agg_spec.operation, agg_spec.field),
            };
            
            field_names.push(field_name);
            arrays.push(Arc::new(Float64Array::from(vec![result])));
        }

        let fields: Vec<Field> = field_names.iter()
            .map(|name| Field::new(name, DataType::Float64, false))
            .collect();
        
        let schema = Arc::new(Schema::new(fields));
        let result_batch = RecordBatch::try_new(schema, arrays)
            .map_err(|e| format!("Failed to create result batch: {}", e))?;

        Ok(vec![result_batch])
    }

    fn group_by_aggregation(&self, batch: &RecordBatch, config: &AggregateConfig) -> Result<Vec<RecordBatch>, String> {
        let mut grouped_data: HashMap<String, Vec<(usize, String)>> = HashMap::new();
        let num_rows = batch.num_rows();

        // Group rows by the group_by_fields
        for row_idx in 0..num_rows {
            let mut group_key = String::new();
            
            for (i, field) in config.group_by_fields.iter().enumerate() {
                if i > 0 { group_key.push('|'); }
                let column = batch.column_by_name(field)
                    .ok_or_else(|| format!("Group by field '{}' not found", field))?;
                let val = self.extract_string_value(column, row_idx);
                group_key.push_str(&val);
            }

            grouped_data.entry(group_key.clone())
                .or_insert_with(Vec::new)
                .push((row_idx, group_key));
        }

        // Compute aggregations for each group
        let mut result_rows: Vec<HashMap<String, String>> = Vec::new();

        for (group_key, row_indices) in grouped_data {
            let mut result_row = HashMap::new();
            
            // Add group by fields to result
            let group_parts: Vec<&str> = group_key.split('|').collect();
            for (i, field) in config.group_by_fields.iter().enumerate() {
                if i < group_parts.len() {
                    result_row.insert(field.clone(), group_parts[i].to_string());
                }
            }

            // Compute aggregations for this group
            for agg_spec in &config.aggregations {
                let column = batch.column_by_name(&agg_spec.field)
                    .ok_or_else(|| format!("Aggregation field '{}' not found", agg_spec.field))?;

                let op = AggOp::from_string(&agg_spec.operation)?;
                let result = self.compute_group_aggregation(column, &op, &row_indices)?;

                let field_name = match &agg_spec.alias {
                    Some(alias) => alias.clone(),
                    None => format!("{}_{}", agg_spec.operation, agg_spec.field),
                };
                
                result_row.insert(field_name, result.to_string());
            }

            result_rows.push(result_row);
        }

        // Convert result to RecordBatch
        self.result_rows_to_batch(result_rows, config)
    }

    fn compute_aggregation(&self, column: &ArrayRef, op: &AggOp) -> Result<f64, String> {
        match column.data_type() {
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>()
                    .ok_or_else(|| "Failed to cast to Float64Array".to_string())?;

                match op {
                    AggOp::Sum => {
                        // Manual sum calculation for now
                        let mut total = 0.0;
                        for i in 0..float_array.len() {
                            if !float_array.is_null(i) {
                                total += float_array.value(i);
                            }
                        }
                        Ok(total)
                    },
                    AggOp::Min => {
                        let mut min_val = f64::INFINITY;
                        for i in 0..float_array.len() {
                            if !float_array.is_null(i) {
                                let val = float_array.value(i);
                                if val < min_val {
                                    min_val = val;
                                }
                            }
                        }
                        Ok(if min_val == f64::INFINITY { 0.0 } else { min_val })
                    },
                    AggOp::Max => {
                        let mut max_val = f64::NEG_INFINITY;
                        for i in 0..float_array.len() {
                            if !float_array.is_null(i) {
                                let val = float_array.value(i);
                                if val > max_val {
                                    max_val = val;
                                }
                            }
                        }
                        Ok(if max_val == f64::NEG_INFINITY { 0.0 } else { max_val })
                    },
                    AggOp::Count => Ok(float_array.len() as f64),
                    AggOp::Avg => {
                        let mut total = 0.0;
                        let mut count = 0;
                        for i in 0..float_array.len() {
                            if !float_array.is_null(i) {
                                total += float_array.value(i);
                                count += 1;
                            }
                        }
                        Ok(if count > 0 { total / count as f64 } else { 0.0 })
                    }
                }
            }
            _ => Err(format!("Aggregation not supported for data type: {:?}", column.data_type())),
        }
    }

    fn compute_group_aggregation(&self, column: &ArrayRef, op: &AggOp, row_indices: &[(usize, String)]) -> Result<f64, String> {
        match column.data_type() {
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>()
                    .ok_or_else(|| "Failed to cast to Float64Array".to_string())?;

                let values: Vec<f64> = row_indices.iter()
                    .filter_map(|(idx, _)| {
                        if float_array.is_null(*idx) {
                            None
                        } else {
                            Some(float_array.value(*idx))
                        }
                    })
                    .collect();

                match op {
                    AggOp::Sum => Ok(values.iter().sum()),
                    AggOp::Min => Ok(values.iter().fold(f64::INFINITY, |a, &b| a.min(b))),
                    AggOp::Max => Ok(values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b))),
                    AggOp::Count => Ok(values.len() as f64),
                    AggOp::Avg => {
                        let sum: f64 = values.iter().sum();
                        let count = values.len() as f64;
                        Ok(if count > 0.0 { sum / count } else { 0.0 })
                    }
                }
            }
            _ => Err(format!("Group aggregation not supported for data type: {:?}", column.data_type())),
        }
    }

    fn extract_string_value(&self, column: &ArrayRef, row_idx: usize) -> String {
        match column.data_type() {
            DataType::Utf8 => {
                let string_array = column.as_any().downcast_ref::<StringArray>().unwrap();
                if string_array.is_null(row_idx) {
                    "null".to_string()
                } else {
                    string_array.value(row_idx).to_string()
                }
            }
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>().unwrap();
                if float_array.is_null(row_idx) {
                    "null".to_string()
                } else {
                    float_array.value(row_idx).to_string()
                }
            }
            _ => format!("unsupported_{}", row_idx),
        }
    }

    fn result_rows_to_batch(&self, result_rows: Vec<HashMap<String, String>>, config: &AggregateConfig) -> Result<Vec<RecordBatch>, String> {
        if result_rows.is_empty() {
            return Ok(vec![]);
        }

        // Determine all field names
        let mut all_fields: std::collections::HashSet<String> = std::collections::HashSet::new();
        for row in &result_rows {
            for key in row.keys() {
                all_fields.insert(key.clone());
            }
        }
        let mut field_names: Vec<String> = all_fields.into_iter().collect();
        field_names.sort();

        // Create schema
        let fields: Vec<Field> = field_names.iter()
            .map(|name| {
                // Group by fields are strings, aggregation results are floats
                let is_group_field = config.group_by_fields.contains(name);
                let data_type = if is_group_field { DataType::Utf8 } else { DataType::Float64 };
                Field::new(name, data_type, true)
            })
            .collect();
        
        let schema = Arc::new(Schema::new(fields));

        // Create arrays
        let mut arrays: Vec<ArrayRef> = Vec::new();
        
        for field_name in &field_names {
            let is_group_field = config.group_by_fields.contains(field_name);
            
            if is_group_field {
                let string_values: Vec<Option<String>> = result_rows.iter()
                    .map(|row| row.get(field_name).cloned())
                    .collect();
                arrays.push(Arc::new(StringArray::from(string_values)));
            } else {
                let float_values: Vec<Option<f64>> = result_rows.iter()
                    .map(|row| {
                        row.get(field_name)
                            .and_then(|s| s.parse::<f64>().ok())
                    })
                    .collect();
                arrays.push(Arc::new(Float64Array::from(float_values)));
            }
        }

        let result_batch = RecordBatch::try_new(schema, arrays)
            .map_err(|e| format!("Failed to create aggregation result: {}", e))?;

        Ok(vec![result_batch])
    }

    // Legacy method for backward compatibility
    pub fn execute_simple(&self, col_name: &str, op: AggOp) -> Result<f64, String> {
        if self.data.is_empty() {
            return Err("No data available".to_string());
        }

        let col_idx = self.data[0].column_by_name(col_name)
            .ok_or_else(|| format!("Column '{}' not found", col_name))?;
        
        self.compute_aggregation(col_idx, &op)
    }
}
