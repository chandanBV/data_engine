use crate::config::PivotConfig;
use arrow::array::{Array, ArrayRef, Float64Array, RecordBatch, StringArray};
use arrow::datatypes::{DataType, Field, Schema};
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
enum AggregationValue {
    Count(u64),
    Sum(f64),
    Min(f64),
    Max(f64),
    SumCount(f64, u64), // For AVG: (sum, count)
}

impl AggregationValue {
    fn new(agg_type: &str, value: f64) -> Self {
        match agg_type {
            "count" => AggregationValue::Count(1),
            "sum" => AggregationValue::Sum(value),
            "min" => AggregationValue::Min(value),
            "max" => AggregationValue::Max(value),
            "avg" => AggregationValue::SumCount(value, 1),
            _ => AggregationValue::Sum(value), // Default to sum
        }
    }

    fn update(&mut self, value: f64) {
        match self {
            AggregationValue::Count(ref mut count) => *count += 1,
            AggregationValue::Sum(ref mut sum) => *sum += value,
            AggregationValue::Min(ref mut min) => {
                if value < *min {
                    *min = value;
                }
            }
            AggregationValue::Max(ref mut max) => {
                if value > *max {
                    *max = value;
                }
            }
            AggregationValue::SumCount(ref mut sum, ref mut count) => {
                *sum += value;
                *count += 1;
            }
        }
    }

    fn finalize(&self) -> f64 {
        match self {
            AggregationValue::Count(count) => *count as f64,
            AggregationValue::Sum(sum) => *sum,
            AggregationValue::Min(min) => *min,
            AggregationValue::Max(max) => *max,
            AggregationValue::SumCount(sum, count) => {
                if *count > 0 {
                    *sum / *count as f64
                } else {
                    0.0
                }
            }
        }
    }
}

pub struct PivotEngine<'a> {
    pub data: &'a [RecordBatch],
}

impl<'a> PivotEngine<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        Self { data }
    }

    pub fn execute(&self, config: &PivotConfig) -> Result<Vec<RecordBatch>, String> {
        if self.data.is_empty() {
            return Err("No data available for pivot operation".to_string());
        }

        let batch = &self.data[0];
        let schema = batch.schema();

        // Validate that all specified fields exist
        for field in &config.row_fields {
            if schema.column_with_name(field).is_none() {
                return Err(format!("Row field '{}' not found in schema", field));
            }
        }

        for field in &config.column_fields {
            if schema.column_with_name(field).is_none() {
                return Err(format!("Column field '{}' not found in schema", field));
            }
        }

        for field in &config.value_fields {
            if schema.column_with_name(field).is_none() {
                return Err(format!("Value field '{}' not found in schema", field));
            }
        }

        // Simple pivot implementation for demonstration
        // In a production system, this would be much more sophisticated
        let pivoted_batch = self.create_pivot_table(batch, config)?;
        Ok(vec![pivoted_batch])
    }

    fn create_pivot_table(
        &self,
        batch: &RecordBatch,
        config: &PivotConfig,
    ) -> Result<RecordBatch, String> {
        // Changed to support multiple value fields with different aggregation types
        // Structure: HashMap<row_key, HashMap<(col_key, value_field), AggregationValue>>
        let mut grouped_data: HashMap<String, HashMap<(String, String), AggregationValue>> =
            HashMap::new();
        let num_rows = batch.num_rows();

        // Extract row keys, column keys, and values
        for row_idx in 0..num_rows {
            let mut row_key = String::new();
            let mut col_key = String::new();

            // Build row key from row fields
            for (i, field) in config.row_fields.iter().enumerate() {
                if i > 0 {
                    row_key.push('|');
                }
                let column = batch.column_by_name(field).unwrap();
                let val = self.extract_string_value(column, row_idx);
                row_key.push_str(&val);
            }

            // Build column key from column fields
            for (i, field) in config.column_fields.iter().enumerate() {
                if i > 0 {
                    col_key.push('|');
                }
                let column = batch.column_by_name(field).unwrap();
                let val = self.extract_string_value(column, row_idx);
                col_key.push_str(&val);
            }

            // Extract values from all value fields
            for value_field in &config.value_fields {
                let value_column = batch.column_by_name(value_field).unwrap();
                let value = self.extract_numeric_value(value_column, row_idx);

                // Store in grouped data structure with composite key (col_key, value_field)
                let composite_key = (col_key.clone(), value_field.clone());
                grouped_data
                    .entry(row_key.clone())
                    .or_insert_with(HashMap::new)
                    .entry(composite_key)
                    .and_modify(|agg| agg.update(value))
                    .or_insert_with(|| AggregationValue::new(&config.aggregation_type, value));
            }
        }

        // Convert grouped data back to RecordBatch
        let result = self.grouped_data_to_batch(grouped_data, config);

        result
    }

    fn extract_string_value(&self, column: &ArrayRef, row_idx: usize) -> String {
        match column.data_type() {
            DataType::Utf8 => {
                let string_array = column.as_any().downcast_ref::<StringArray>().unwrap();
                string_array.value(row_idx).to_string()
            }
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>().unwrap();
                float_array.value(row_idx).to_string()
            }
            _ => format!("unsupported_{}", row_idx),
        }
    }

    fn extract_numeric_value(&self, column: &ArrayRef, row_idx: usize) -> f64 {
        match column.data_type() {
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>().unwrap();
                float_array.value(row_idx)
            }
            DataType::Utf8 => {
                let string_array = column.as_any().downcast_ref::<StringArray>().unwrap();
                string_array.value(row_idx).parse::<f64>().unwrap_or(0.0)
            }
            _ => 0.0,
        }
    }

    fn grouped_data_to_batch(
        &self,
        grouped_data: HashMap<String, HashMap<(String, String), AggregationValue>>,
        config: &PivotConfig,
    ) -> Result<RecordBatch, String> {
        // Collect all unique composite keys (col_key, value_field)
        let mut all_composite_keys: std::collections::HashSet<(String, String)> =
            std::collections::HashSet::new();
        for row_data in grouped_data.values() {
            for composite_key in row_data.keys() {
                all_composite_keys.insert(composite_key.clone());
            }
        }
        let mut composite_keys: Vec<(String, String)> = all_composite_keys.into_iter().collect();
        composite_keys.sort();

        // Create schema with column names like "col_key_value_field" or just "col_key" if single value field
        let mut fields = vec![Field::new("row_key", DataType::Utf8, false)];
        for (col_key, value_field) in &composite_keys {
            let column_name = if config.value_fields.len() > 1 {
                format!("{}_{}", col_key, value_field)
            } else {
                col_key.clone()
            };
            fields.push(Field::new(&column_name, DataType::Float64, true));
        }
        let schema = Arc::new(Schema::new(fields));

        // Create arrays
        let mut row_keys = Vec::new();
        let mut column_data: Vec<Vec<Option<f64>>> = vec![Vec::new(); composite_keys.len()];

        for (row_key, row_data) in grouped_data {
            row_keys.push(Some(row_key));

            for (col_idx, composite_key) in composite_keys.iter().enumerate() {
                let value = row_data.get(composite_key).map(|agg| agg.finalize());
                column_data[col_idx].push(value);
            }
        }

        // Build arrays
        let row_key_array = StringArray::from(row_keys);
        let mut arrays: Vec<ArrayRef> = vec![Arc::new(row_key_array)];

        for col_data in column_data {
            let float_array = Float64Array::from(col_data);
            arrays.push(Arc::new(float_array));
        }

        RecordBatch::try_new(schema, arrays)
            .map_err(|e| format!("Failed to create pivot result: {}", e))
    }
}
