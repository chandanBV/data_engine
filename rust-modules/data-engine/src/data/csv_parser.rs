use crate::engine::DataEngine;
use arrow::csv::reader::Format;
use arrow::csv::ReaderBuilder;
use arrow::record_batch::RecordBatch;
use std::io::Cursor;
use std::sync::Arc;

/// Parse CSV data and store in the engine
/// Optimized: uses direct byte slice, limited schema inference
pub fn csv_to_batches(
    engine: &mut DataEngine,
    csv_data: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Rust: Starting CSV processing ({} bytes)", csv_data.len());

    // Infer schema from first 1000 rows only (much faster)
    let (schema, _) = Format::default()
        .with_header(true)
        .infer_schema(Cursor::new(csv_data), Some(1000))?;

    // Parse with large default batch size for better performance
    let reader = ReaderBuilder::new(Arc::new(schema))
        .with_header(true)
        .with_batch_size(32768) // 32K rows default
        .build(Cursor::new(csv_data))?;

    let mut _batches: Vec<RecordBatch> = Vec::new();
    for batch_result in reader {
        _batches.push(batch_result?);
    }

    engine.store_data(Some("data"), _batches);
    Ok(())
}

/// Parse CSV data with custom batch size for better performance
/// Optimized: direct byte processing, limited schema inference
pub fn csv_to_batches_with_batch_size(
    engine: &mut DataEngine,
    csv_data: &[u8],
    batch_size: usize,
) -> Result<usize, Box<dyn std::error::Error>> {
    println!("Rust: Optimized CSV processing ({} bytes, batch: {})", csv_data.len(), batch_size);

    // Infer schema from first 1000 rows only (much faster than full scan)
    let (schema, _) = Format::default()
        .with_header(true)
        .infer_schema(Cursor::new(csv_data), Some(1000))?;

    let reader = ReaderBuilder::new(Arc::new(schema))
        .with_header(true)
        .with_batch_size(batch_size)
        .build(Cursor::new(csv_data))?;

    let mut _batches: Vec<RecordBatch> = Vec::new();
    let mut total_rows = 0;
    
    for batch_result in reader {
        let batch = batch_result?;
        total_rows += batch.num_rows();
        _batches.push(batch);
    }

    engine.store_data(Some("data"), _batches);
    println!("Rust: Complete ({} rows)", total_rows);

    Ok(total_rows)
}
