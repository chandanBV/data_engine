use crate::engine::DataEngine;
use arrow::array::{
    ArrayRef, BooleanArray, Float64Array, Int64Array, StringArray,
};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use calamine::{open_workbook_auto_from_rs, Reader, Data};
use std::io::Cursor;
use std::sync::Arc;

/// Get list of sheet names from Excel file
/// Returns a vector of sheet names available in the workbook
pub fn get_excel_sheet_names(excel_data: &[u8]) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let cursor = Cursor::new(excel_data);
    let workbook = open_workbook_auto_from_rs(cursor)
        .map_err(|e| format!("Failed to open Excel file: {}", e))?;
    
    let sheet_names = workbook.sheet_names().to_vec();
    Ok(sheet_names)
}

/// Parse Excel data from bytes and store in DataEngine
/// Supports both .xlsx and .xls formats
/// Optimized for memory efficiency with batch processing for large datasets (1M-5M rows)
/// If sheet_name is None, uses the first sheet
pub fn excel_to_batches(
    engine: &mut DataEngine,
    excel_data: &[u8],
    sheet_name: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Rust: Starting Excel processing ({} bytes)", excel_data.len());

    // Create cursor from byte data
    let cursor = Cursor::new(excel_data);

    // Open workbook - calamine auto-detects .xlsx or .xls format
    let mut workbook = open_workbook_auto_from_rs(cursor)
        .map_err(|e| format!("Failed to open Excel file: {}", e))?;

    // Get the worksheet to process
    let available_sheets = workbook.sheet_names().to_vec();
    if available_sheets.is_empty() {
        return Err("Excel file has no worksheets".into());
    }

    let target_sheet = match sheet_name {
        Some(name) => {
            if !available_sheets.contains(&name.to_string()) {
                return Err(format!("Sheet '{}' not found. Available sheets: {:?}", name, available_sheets).into());
            }
            name.to_string()
        }
        None => available_sheets[0].clone(),
    };
    
    println!("Rust: Processing worksheet: {}", target_sheet);

    let range = workbook
        .worksheet_range(&target_sheet)
        .map_err(|e| format!("Failed to read worksheet: {}", e))?;

    if range.is_empty() {
        return Err("Worksheet is empty".into());
    }

    // Extract headers from first row
    let mut rows = range.rows();
    let header_row = rows.next().ok_or("No header row found")?;
    
    let headers: Vec<String> = header_row
        .iter()
        .enumerate()
        .map(|(i, cell)| {
            let cell_str = cell.to_string().trim().to_string();
            if cell_str.is_empty() {
                format!("Column_{}", i + 1)
            } else {
                cell_str
            }
        })
        .collect();

    println!("Rust: Found {} columns: {:?}", headers.len(), headers);

    // Collect all data rows for type inference
    let data_rows: Vec<Vec<Data>> = rows
        .map(|row| row.to_vec())
        .collect();

    if data_rows.is_empty() {
        return Err("No data rows found".into());
    }

    println!("Rust: Processing {} data rows", data_rows.len());

    // Infer schema from data
    let fields = infer_schema(&headers, &data_rows);
    let schema = Arc::new(Schema::new(fields.clone()));

    // Process data in batches for memory efficiency
    const BATCH_SIZE: usize = 8192; // Optimized for 1M-5M records
    let mut batches: Vec<RecordBatch> = Vec::new();

    for chunk_start in (0..data_rows.len()).step_by(BATCH_SIZE) {
        let chunk_end = (chunk_start + BATCH_SIZE).min(data_rows.len());
        let chunk = &data_rows[chunk_start..chunk_end];

        // Build columns for this batch
        let columns = build_columns(&fields, chunk);

        let batch = RecordBatch::try_new(schema.clone(), columns)
            .map_err(|e| format!("Failed to create record batch: {}", e))?;

        batches.push(batch);
        println!("Rust: Processed batch {}-{}", chunk_start, chunk_end);
    }

    let total_rows: usize = batches.iter().map(|b| b.num_rows()).sum();
    println!("Rust: Excel processing complete. Total rows: {}", total_rows);

    // Store in engine - same interface as CSV for consistent operations
    engine.store_data(Some("data"), batches);

    Ok(())
}

/// Infer Arrow schema from Excel data
fn infer_schema(headers: &[String], data_rows: &[Vec<Data>]) -> Vec<Field> {
    headers
        .iter()
        .enumerate()
        .map(|(col_idx, header)| {
            let data_type = infer_column_type(data_rows, col_idx);
            Field::new(header, data_type, true) // nullable=true for flexibility
        })
        .collect()
}

/// Infer the Arrow data type for a column by sampling values
fn infer_column_type(data_rows: &[Vec<Data>], col_idx: usize) -> DataType {
    let mut has_int = false;
    let mut has_float = false;
    let mut has_bool = false;
    let mut has_string = false;

    // Sample up to 100 rows for type inference
    for row in data_rows.iter().take(100) {
        if let Some(cell) = row.get(col_idx) {
            match cell {
                Data::Int(_) => has_int = true,
                Data::Float(_) => has_float = true,
                Data::Bool(_) => has_bool = true,
                Data::String(_) => has_string = true,
                Data::Empty => {}
                _ => has_string = true,
            }
        }
    }

    // Determine most appropriate type
    if has_string {
        DataType::Utf8
    } else if has_float || (has_int && has_float) {
        DataType::Float64
    } else if has_int {
        DataType::Int64
    } else if has_bool {
        DataType::Boolean
    } else {
        DataType::Utf8 // Default to string
    }
}

/// Build Arrow columns from Excel data
fn build_columns(fields: &[Field], data_rows: &[Vec<Data>]) -> Vec<ArrayRef> {
    fields
        .iter()
        .enumerate()
        .map(|(col_idx, field)| {
            build_column(field.data_type(), data_rows, col_idx)
        })
        .collect()
}

/// Build a single Arrow column from Excel data
fn build_column(
    data_type: &DataType,
    data_rows: &[Vec<Data>],
    col_idx: usize,
) -> ArrayRef {
    match data_type {
        DataType::Int64 => {
            let values: Vec<Option<i64>> = data_rows
                .iter()
                .map(|row| {
                    row.get(col_idx).and_then(|cell| match cell {
                        Data::Int(i) => Some(*i),
                        Data::Float(f) => Some(*f as i64),
                        Data::Empty => None,
                        _ => None,
                    })
                })
                .collect();
            Arc::new(Int64Array::from(values))
        }
        DataType::Float64 => {
            let values: Vec<Option<f64>> = data_rows
                .iter()
                .map(|row| {
                    row.get(col_idx).and_then(|cell| match cell {
                        Data::Float(f) => Some(*f),
                        Data::Int(i) => Some(*i as f64),
                        Data::Empty => None,
                        _ => None,
                    })
                })
                .collect();
            Arc::new(Float64Array::from(values))
        }
        DataType::Boolean => {
            let values: Vec<Option<bool>> = data_rows
                .iter()
                .map(|row| {
                    row.get(col_idx).and_then(|cell| match cell {
                        Data::Bool(b) => Some(*b),
                        Data::Empty => None,
                        _ => None,
                    })
                })
                .collect();
            Arc::new(BooleanArray::from(values))
        }
        _ => {
            // Default to string
            let values: Vec<Option<String>> = data_rows
                .iter()
                .map(|row| {
                    row.get(col_idx).and_then(|cell| match cell {
                        Data::Empty => None,
                        _ => Some(cell.to_string()),
                    })
                })
                .collect();
            Arc::new(StringArray::from(values))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_column_type() {
        // Test integer column
        let int_data = vec![
            vec![Data::Int(1), Data::Int(2)],
            vec![Data::Int(3), Data::Int(4)],
        ];
        assert_eq!(infer_column_type(&int_data, 0), arrow::datatypes::DataType::Int64);

        // Test float column
        let float_data = vec![
            vec![Data::Float(1.5), Data::Float(2.5)],
            vec![Data::Float(3.5), Data::Float(4.5)],
        ];
        assert_eq!(infer_column_type(&float_data, 0), arrow::datatypes::DataType::Float64);

        // Test string column
        let string_data = vec![
            vec![Data::String("a".to_string()), Data::String("b".to_string())],
            vec![Data::String("c".to_string()), Data::String("d".to_string())],
        ];
        assert_eq!(infer_column_type(&string_data, 0), arrow::datatypes::DataType::Utf8);
    }
}
