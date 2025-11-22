use crate::engine::DataEngine;
use arrow::csv::reader::Format;
use arrow::csv::ReaderBuilder;
use arrow::record_batch::RecordBatch;
use std::io::Cursor;
use std::sync::Arc;

pub fn csv_to_batches(
    engine: &mut DataEngine,
    csv_data: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let data: Vec<u8> = csv_data.to_vec();
    println!("Rust: Starting CSV processing ({} bytes)", data.len());

    let cursor: Cursor<Vec<u8>> = Cursor::new(data);

    let (schema, _) = Format::default()
        .with_header(true)
        .infer_schema(cursor.clone(), None)?;

    let reader = ReaderBuilder::new(Arc::new(schema))
        .with_header(true)
        .build(cursor)?;

    println!("Rust: Starting batch processing...");

    let mut _batches: Vec<RecordBatch> = Vec::new();
    for batch_result in reader {
        let batch: RecordBatch = batch_result.unwrap();
        _batches.push(batch);
    }

    engine.store_data(Some("data"), _batches);

    Ok(())

    // Ok(_batches)
}
