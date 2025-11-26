use crate::engine::DataEngine;
use arrow::json::reader::ReaderBuilder;
use arrow::record_batch::RecordBatch;
use std::io::Cursor;
use std::sync::Arc;

pub fn json_to_batches(
    engine: &mut DataEngine,
    json_data: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Rust: Starting JSON processing ({} bytes)", json_data.len());

    // Parse JSON string to determine if it's an array or single object
    let json_value: serde_json::Value = serde_json::from_str(json_data)?;
    
    let json_array = match json_value {
        serde_json::Value::Array(arr) => arr,
        serde_json::Value::Object(_) => vec![json_value],
        _ => return Err("JSON must be an object or array of objects".into()),
    };

    // Convert back to JSON string for Arrow processing
    let json_string = serde_json::to_string(&json_array)?;
    let cursor = Cursor::new(json_string.as_bytes());

    // Use Arrow's JSON reader to infer schema and create batches
    let mut reader = ReaderBuilder::new(Arc::new(arrow::datatypes::Schema::empty()))
        .build(cursor)?;

    println!("Rust: Starting JSON batch processing...");

    let mut batches: Vec<RecordBatch> = Vec::new();
    for batch_result in reader {
        let batch = batch_result?;
        batches.push(batch);
    }

    engine.store_data(Some("data"), batches);
    println!("Rust: JSON upload successful");

    Ok(())
}

pub fn json_array_to_batches(
    engine: &mut DataEngine,
    json_array: Vec<serde_json::Value>,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Rust: Processing JSON array with {} items", json_array.len());

    let json_string = serde_json::to_string(&json_array)?;
    let cursor = Cursor::new(json_string.as_bytes());

    let mut reader = ReaderBuilder::new(Arc::new(arrow::datatypes::Schema::empty()))
        .build(cursor)?;

    let mut batches: Vec<RecordBatch> = Vec::new();
    for batch_result in reader {
        let batch = batch_result?;
        batches.push(batch);
    }

    engine.store_data(Some("data"), batches);
    println!("Rust: JSON array processing successful");

    Ok(())
}
