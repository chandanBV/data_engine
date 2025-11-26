use crate::config::PivotConfig;
use arrow::array::{Array, ArrayRef, Float64Array, StringArray, RecordBatch};
use arrow::datatypes::{DataType, Field, Schema};
use std::collections::HashMap;
use std::sync::Arc;

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

    fn create_pivot_table(&self, batch: &RecordBatch, config: &PivotConfig) -> Result<RecordBatch, String> {
        // This is a simplified pivot implementation
        // For a full implementation, you'd need to:
        // 1. Group by row fields
        // 2. Create columns for each unique combination of column fields
        // 3. Aggregate values according to the aggregation type
        
        let mut grouped_data: HashMap<String, HashMap<String, f64>> = HashMap::new();
        let num_rows = batch.num_rows();

        // Extract row keys, column keys, and values
        for row_idx in 0..num_rows {
            let mut row_key = String::new();
            let mut col_key = String::new();
            let mut value = 0.0;

            // Build row key from row fields
            for (i, field) in config.row_fields.iter().enumerate() {
                if i > 0 { row_key.push('|'); }
                let column = batch.column_by_name(field).unwrap();
                let val = self.extract_string_value(column, row_idx);
                row_key.push_str(&val);
            }

            // Build column key from column fields
            for (i, field) in config.column_fields.iter().enumerate() {
                if i > 0 { col_key.push('|'); }
                let column = batch.column_by_name(field).unwrap();
                let val = self.extract_string_value(column, row_idx);
                col_key.push_str(&val);
            }

            // Extract value from first value field (simplified)
            if !config.value_fields.is_empty() {
                let value_column = batch.column_by_name(&config.value_fields[0]).unwrap();
                value = self.extract_numeric_value(value_column, row_idx);
            }

            // Store in grouped data structure
            grouped_data.entry(row_key)
                .or_insert_with(HashMap::new)
                .entry(col_key)
                .and_modify(|v| *v += value)
                .or_insert(value);
        }

        // Convert grouped data back to RecordBatch
        self.grouped_data_to_batch(grouped_data, config)
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
        grouped_data: HashMap<String, HashMap<String, f64>>,
        config: &PivotConfig,
    ) -> Result<RecordBatch, String> {
        // Collect all unique column keys
        let mut all_col_keys: std::collections::HashSet<String> = std::collections::HashSet::new();
        for row_data in grouped_data.values() {
            for col_key in row_data.keys() {
                all_col_keys.insert(col_key.clone());
            }
        }
        let mut col_keys: Vec<String> = all_col_keys.into_iter().collect();
        col_keys.sort();

        // Create schema
        let mut fields = vec![Field::new("row_key", DataType::Utf8, false)];
        for col_key in &col_keys {
            fields.push(Field::new(col_key, DataType::Float64, true));
        }
        let schema = Arc::new(Schema::new(fields));

        // Create arrays
        let mut row_keys = Vec::new();
        let mut column_data: Vec<Vec<Option<f64>>> = vec![Vec::new(); col_keys.len()];

        for (row_key, row_data) in grouped_data {
            row_keys.push(Some(row_key));
            
            for (col_idx, col_key) in col_keys.iter().enumerate() {
                let value = row_data.get(col_key).copied();
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
