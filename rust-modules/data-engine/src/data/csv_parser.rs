use crate::engine::DataEngine;
use arrow::csv::reader::Format;
use arrow::csv::ReaderBuilder;
use arrow::record_batch::RecordBatch;
use std::io::Cursor;
use std::sync::Arc;

/// Parse CSV data and store in the engine
/// Aggressive optimization for maximum speed
pub fn csv_to_batches(
    engine: &mut DataEngine,
    csv_data: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Rust: Fast CSV processing ({} bytes)", csv_data.len());

    // Minimal schema inference (500 rows) - faster startup
    let (schema, _) = Format::default()
        .with_header(true)
        .with_delimiter(b',')
        .infer_schema(Cursor::new(csv_data), Some(500))?;

    // Very large batch size for maximum throughput
    let reader = ReaderBuilder::new(Arc::new(schema))
        .with_header(true)
        .with_delimiter(b',')
        .with_batch_size(131072) // 128K rows - aggressive batching
        .build(Cursor::new(csv_data))?;

    let mut _batches: Vec<RecordBatch> = Vec::new();
    _batches.reserve(16); // Pre-allocate for typical file
    
    for batch_result in reader {
        _batches.push(batch_result?);
    }

    engine.store_data(Some("data"), _batches);
    Ok(())
}

/// Parse CSV data with custom batch size - maximum performance
/// Optimized for large datasets (3M-20M rows)
pub fn csv_to_batches_with_batch_size(
    engine: &mut DataEngine,
    csv_data: &[u8],
    batch_size: usize,
) -> Result<usize, Box<dyn std::error::Error>> {
    println!("Rust: Ultra-fast CSV ({} MB, batch: {}K)", csv_data.len() / 1024 / 1024, batch_size / 1024);

    // Minimal schema inference (500 rows) for speed
    let (schema, _) = Format::default()
        .with_header(true)
        .with_delimiter(b',')
        .infer_schema(Cursor::new(csv_data), Some(500))?;

    let reader = ReaderBuilder::new(Arc::new(schema))
        .with_header(true)
        .with_delimiter(b',')
        .with_batch_size(batch_size)
        .build(Cursor::new(csv_data))?;

    let mut _batches: Vec<RecordBatch> = Vec::new();
    
    // Pre-allocate vector based on estimated batch count
    let estimated_batches = (csv_data.len() / batch_size / 50).max(8);
    _batches.reserve(estimated_batches);
    
    let mut total_rows = 0;
    
    for batch_result in reader {
        let batch = batch_result?;
        total_rows += batch.num_rows();
        _batches.push(batch);
    }

    engine.store_data(Some("data"), _batches);
    println!("Rust: ✓ {} rows", total_rows);

    Ok(total_rows)
}
