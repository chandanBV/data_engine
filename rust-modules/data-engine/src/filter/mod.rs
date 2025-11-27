use crate::config::{FilterConfig, FilterSpec};
use arrow::array::{Array, ArrayRef, BooleanArray, Float64Array, Int64Array, StringArray, RecordBatch};
use arrow::datatypes::DataType;
use arrow::compute;

pub struct FilterEngine<'a> {
    data: &'a Vec<RecordBatch>,
}

impl<'a> FilterEngine<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        Self { data }
    }

    pub fn execute(&self, config: &FilterConfig) -> Result<Vec<RecordBatch>, String> {
        if self.data.is_empty() {
            return Err("No data available for filtering".to_string());
        }

        #[cfg(target_arch = "wasm32")]
        web_sys::console::log_1(&format!("Filter: Processing {} batches", self.data.len()).into());

        let mut filtered_batches = Vec::new();

        for (idx, batch) in self.data.iter().enumerate() {
            #[cfg(target_arch = "wasm32")]
            web_sys::console::log_1(&format!("Filter: Processing batch {} with {} rows", idx, batch.num_rows()).into());
            
            let filtered_batch = self.apply_filters(batch, config)?;
            
            #[cfg(target_arch = "wasm32")]
            web_sys::console::log_1(&format!("Filter: Batch {} filtered to {} rows", idx, filtered_batch.num_rows()).into());
            
            if filtered_batch.num_rows() > 0 {
                filtered_batches.push(filtered_batch);
            }
        }

        #[cfg(target_arch = "wasm32")]
        web_sys::console::log_1(&format!("Filter: Complete. {} batches remaining", filtered_batches.len()).into());

        Ok(filtered_batches)
    }

    fn apply_filters(&self, batch: &RecordBatch, config: &FilterConfig) -> Result<RecordBatch, String> {
        if config.filters.is_empty() {
            return Ok(batch.clone());
        }

        let mut combined_mask: Option<BooleanArray> = None;

        for filter_spec in &config.filters {
            let mask = self.create_filter_mask(batch, filter_spec)?;
            
            combined_mask = match combined_mask {
                None => Some(mask),
                Some(existing_mask) => {
                    // Combine with AND logic manually
                    let combined = self.combine_masks_and(&existing_mask, &mask)?;
                    Some(combined)
                }
            };
        }

        match combined_mask {
            Some(mask) => {
                // Manual filtering implementation
                self.filter_batch_manually(batch, &mask)
            }
            None => Ok(batch.clone()),
        }
    }

    fn create_filter_mask(&self, batch: &RecordBatch, filter_spec: &FilterSpec) -> Result<BooleanArray, String> {
        let column = batch.column_by_name(&filter_spec.field)
            .ok_or_else(|| format!("Field '{}' not found", filter_spec.field))?;

        match filter_spec.filter_type.as_str() {
            "equals" => self.create_equals_mask(column, filter_spec),
            "contains" => self.create_contains_mask(column, filter_spec),
            "range" => self.create_range_mask(column, filter_spec),
            "date_range" => self.create_date_range_mask(column, filter_spec),
            _ => Err(format!("Unsupported filter type: {}", filter_spec.filter_type)),
        }
    }

    fn create_equals_mask(&self, column: &ArrayRef, filter_spec: &FilterSpec) -> Result<BooleanArray, String> {
        let value = filter_spec.value.as_ref()
            .ok_or_else(|| "Value required for equals filter".to_string())?;

        match column.data_type() {
            DataType::Utf8 => {
                let string_array = column.as_any().downcast_ref::<StringArray>()
                    .ok_or_else(|| "Failed to cast to StringArray".to_string())?;
                
                // Use efficient scalar comparison
                let mask: Vec<bool> = (0..string_array.len())
                    .map(|i| !string_array.is_null(i) && string_array.value(i) == value)
                    .collect();
                
                Ok(BooleanArray::from(mask))
            }
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>()
                    .ok_or_else(|| "Failed to cast to Float64Array".to_string())?;
                
                let target_value: f64 = value.parse()
                    .map_err(|_| format!("Cannot parse '{}' as float", value))?;
                
                let mask: Vec<bool> = (0..float_array.len())
                    .map(|i| !float_array.is_null(i) && (float_array.value(i) - target_value).abs() < f64::EPSILON)
                    .collect();
                
                Ok(BooleanArray::from(mask))
            }
            DataType::Int64 => {
                let int_array = column.as_any().downcast_ref::<Int64Array>()
                    .ok_or_else(|| "Failed to cast to Int64Array".to_string())?;
                
                let target_value: i64 = value.parse()
                    .map_err(|_| format!("Cannot parse '{}' as integer", value))?;
                
                let mask: Vec<bool> = (0..int_array.len())
                    .map(|i| !int_array.is_null(i) && int_array.value(i) == target_value)
                    .collect();
                
                Ok(BooleanArray::from(mask))
            }
            _ => Err(format!("Equals filter not supported for data type: {:?}", column.data_type())),
        }
    }

    fn create_contains_mask(&self, column: &ArrayRef, filter_spec: &FilterSpec) -> Result<BooleanArray, String> {
        let value = filter_spec.value.as_ref()
            .ok_or_else(|| "Value required for contains filter".to_string())?;

        match column.data_type() {
            DataType::Utf8 => {
                let string_array = column.as_any().downcast_ref::<StringArray>()
                    .ok_or_else(|| "Failed to cast to StringArray".to_string())?;
                
                let mask: Vec<Option<bool>> = (0..string_array.len())
                    .map(|i| {
                        if string_array.is_null(i) {
                            Some(false)
                        } else {
                            Some(string_array.value(i).contains(value))
                        }
                    })
                    .collect();
                
                Ok(BooleanArray::from(mask))
            }
            _ => Err("Contains filter only supported for string columns".to_string()),
        }
    }

    fn create_range_mask(&self, column: &ArrayRef, filter_spec: &FilterSpec) -> Result<BooleanArray, String> {
        let min_value = filter_spec.min_value.as_ref()
            .ok_or_else(|| "Min value required for range filter".to_string())?;
        let max_value = filter_spec.max_value.as_ref()
            .ok_or_else(|| "Max value required for range filter".to_string())?;

        match column.data_type() {
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>()
                    .ok_or_else(|| "Failed to cast to Float64Array".to_string())?;
                
                let min_val: f64 = min_value.parse()
                    .map_err(|_| format!("Cannot parse min value '{}' as float", min_value))?;
                let max_val: f64 = max_value.parse()
                    .map_err(|_| format!("Cannot parse max value '{}' as float", max_value))?;
                
                // Efficient range check without creating large temporary arrays
                let mask: Vec<bool> = (0..float_array.len())
                    .map(|i| {
                        if float_array.is_null(i) {
                            false
                        } else {
                            let val = float_array.value(i);
                            val >= min_val && val <= max_val
                        }
                    })
                    .collect();
                
                Ok(BooleanArray::from(mask))
            }
            DataType::Int64 => {
                let int_array = column.as_any().downcast_ref::<Int64Array>()
                    .ok_or_else(|| "Failed to cast to Int64Array".to_string())?;
                
                let min_val: i64 = min_value.parse()
                    .map_err(|_| format!("Cannot parse min value '{}' as integer", min_value))?;
                let max_val: i64 = max_value.parse()
                    .map_err(|_| format!("Cannot parse max value '{}' as integer", max_value))?;
                
                // Efficient range check
                let mask: Vec<bool> = (0..int_array.len())
                    .map(|i| {
                        if int_array.is_null(i) {
                            false
                        } else {
                            let val = int_array.value(i);
                            val >= min_val && val <= max_val
                        }
                    })
                    .collect();
                
                Ok(BooleanArray::from(mask))
            }
            _ => Err("Range filter only supported for numeric columns".to_string()),
        }
    }

    fn create_date_range_mask(&self, column: &ArrayRef, filter_spec: &FilterSpec) -> Result<BooleanArray, String> {
        // For now, treat date range as string comparison
        // In a production system, you'd parse dates properly
        self.create_range_mask(column, filter_spec)
    }

    fn combine_masks_and(&self, mask1: &BooleanArray, mask2: &BooleanArray) -> Result<BooleanArray, String> {
        // Use vectorized AND operation - much faster!
        compute::and(mask1, mask2)
            .map_err(|e| format!("Failed to combine masks: {}", e))
    }

    fn filter_batch_manually(&self, batch: &RecordBatch, mask: &BooleanArray) -> Result<RecordBatch, String> {
        // Use Arrow's vectorized filter operation - much faster!
        compute::filter_record_batch(batch, mask)
            .map_err(|e| format!("Failed to filter batch: {}", e))
    }
}
