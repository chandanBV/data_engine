use crate::config::{FilterConfig, FilterSpec};
use arrow::array::{Array, ArrayRef, BooleanArray, Float64Array, StringArray, RecordBatch};
// Manual filtering implementation to avoid Arrow compute compatibility issues
use arrow::datatypes::DataType;
use std::sync::Arc;

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

        let mut filtered_batches = Vec::new();

        for batch in self.data {
            let filtered_batch = self.apply_filters(batch, config)?;
            if filtered_batch.num_rows() > 0 {
                filtered_batches.push(filtered_batch);
            }
        }

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
                
                let mask: Vec<Option<bool>> = (0..string_array.len())
                    .map(|i| {
                        if string_array.is_null(i) {
                            Some(false)
                        } else {
                            Some(string_array.value(i) == value)
                        }
                    })
                    .collect();
                
                Ok(BooleanArray::from(mask))
            }
            DataType::Float64 => {
                let float_array = column.as_any().downcast_ref::<Float64Array>()
                    .ok_or_else(|| "Failed to cast to Float64Array".to_string())?;
                
                let target_value: f64 = value.parse()
                    .map_err(|_| format!("Cannot parse '{}' as float", value))?;
                
                let mask: Vec<Option<bool>> = (0..float_array.len())
                    .map(|i| {
                        if float_array.is_null(i) {
                            Some(false)
                        } else {
                            Some((float_array.value(i) - target_value).abs() < f64::EPSILON)
                        }
                    })
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
                
                let mask: Vec<Option<bool>> = (0..float_array.len())
                    .map(|i| {
                        if float_array.is_null(i) {
                            Some(false)
                        } else {
                            let val = float_array.value(i);
                            Some(val >= min_val && val <= max_val)
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
        if mask1.len() != mask2.len() {
            return Err("Mask lengths don't match".to_string());
        }

        let combined: Vec<Option<bool>> = (0..mask1.len())
            .map(|i| {
                match (mask1.is_null(i), mask2.is_null(i)) {
                    (true, _) | (_, true) => Some(false),
                    (false, false) => Some(mask1.value(i) && mask2.value(i)),
                }
            })
            .collect();

        Ok(BooleanArray::from(combined))
    }

    fn filter_batch_manually(&self, batch: &RecordBatch, mask: &BooleanArray) -> Result<RecordBatch, String> {
        // Collect indices where mask is true
        let mut selected_indices = Vec::new();
        for i in 0..mask.len() {
            if !mask.is_null(i) && mask.value(i) {
                selected_indices.push(i);
            }
        }

        if selected_indices.is_empty() {
            // Return empty batch with same schema
            let empty_arrays: Vec<ArrayRef> = batch.columns().iter()
                .map(|col| {
                    match col.data_type() {
                        DataType::Utf8 => Arc::new(StringArray::from(Vec::<Option<String>>::new())) as ArrayRef,
                        DataType::Float64 => Arc::new(Float64Array::from(Vec::<Option<f64>>::new())) as ArrayRef,
                        _ => Arc::new(StringArray::from(Vec::<Option<String>>::new())) as ArrayRef,
                    }
                })
                .collect();
            
            return RecordBatch::try_new(batch.schema(), empty_arrays)
                .map_err(|e| format!("Failed to create empty batch: {}", e));
        }

        // Create new arrays with selected rows
        let filtered_arrays: Result<Vec<ArrayRef>, String> = batch.columns().iter()
            .map(|col| {
                match col.data_type() {
                    DataType::Utf8 => {
                        let string_array = col.as_any().downcast_ref::<StringArray>()
                            .ok_or_else(|| "Failed to cast to StringArray".to_string())?;
                        
                        let values: Vec<Option<String>> = selected_indices.iter()
                            .map(|&i| {
                                if string_array.is_null(i) {
                                    None
                                } else {
                                    Some(string_array.value(i).to_string())
                                }
                            })
                            .collect();
                        
                        Ok(Arc::new(StringArray::from(values)) as ArrayRef)
                    }
                    DataType::Float64 => {
                        let float_array = col.as_any().downcast_ref::<Float64Array>()
                            .ok_or_else(|| "Failed to cast to Float64Array".to_string())?;
                        
                        let values: Vec<Option<f64>> = selected_indices.iter()
                            .map(|&i| {
                                if float_array.is_null(i) {
                                    None
                                } else {
                                    Some(float_array.value(i))
                                }
                            })
                            .collect();
                        
                        Ok(Arc::new(Float64Array::from(values)) as ArrayRef)
                    }
                    _ => {
                        // Default to string representation for unsupported types
                        let values: Vec<Option<String>> = selected_indices.iter()
                            .map(|_| Some("unsupported_type".to_string()))
                            .collect();
                        
                        Ok(Arc::new(StringArray::from(values)) as ArrayRef)
                    }
                }
            })
            .collect();

        let filtered_arrays = filtered_arrays?;
        
        RecordBatch::try_new(batch.schema(), filtered_arrays)
            .map_err(|e| format!("Failed to create filtered batch: {}", e))
    }
}
