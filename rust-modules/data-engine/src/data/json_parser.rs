use crate::engine::DataEngine;
use arrow::json::reader::{ReaderBuilder, infer_json_schema};
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

    // Convert to newline-delimited JSON (NDJSON) format for Arrow
    // Arrow's JSON reader expects one JSON object per line, not an array
    let ndjson_string = json_array.iter()
        .map(|obj| serde_json::to_string(obj))
        .collect::<Result<Vec<String>, _>>()?
        .join("\n");
    
    println!("Rust: Converted {} records to NDJSON format", json_array.len());
    
    // Infer schema from NDJSON data
    let (schema, _) = infer_json_schema(&mut Cursor::new(ndjson_string.as_bytes()), Some(100))?;
    println!("Rust: Inferred schema: {:?}", schema);
    
    // Create reader with inferred schema
    let cursor = Cursor::new(ndjson_string.as_bytes());
    let reader = ReaderBuilder::new(Arc::new(schema))
        .with_batch_size(8192)
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

    // Convert to newline-delimited JSON (NDJSON) format for Arrow
    let ndjson_string = json_array.iter()
        .map(|obj| serde_json::to_string(obj))
        .collect::<Result<Vec<String>, _>>()?
        .join("\n");
    
    println!("Rust: Converted {} records to NDJSON format", json_array.len());
    
    // Infer schema from NDJSON data
    let (schema, _) = infer_json_schema(&mut Cursor::new(ndjson_string.as_bytes()), Some(100))?;
    println!("Rust: Inferred schema: {:?}", schema);
    
    // Create reader with inferred schema
    let cursor = Cursor::new(ndjson_string.as_bytes());
    let reader = ReaderBuilder::new(Arc::new(schema))
        .with_batch_size(8192)
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
