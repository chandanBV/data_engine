use crate::engine::DataEngine;
use arrow::record_batch::RecordBatch;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

/// Parse Parquet data from bytes and store in DataEngine
/// Optimized for memory efficiency with streaming support for large datasets (1M-5M rows)
pub fn parquet_to_batches(
    engine: &mut DataEngine,
    parquet_data: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Rust: Starting Parquet processing ({} bytes)", parquet_data.len());

    // Convert to bytes::Bytes which implements ChunkReader
    let bytes = bytes::Bytes::from(parquet_data.to_vec());
    
    // Build Arrow reader with batch size optimization
    let arrow_reader = match ParquetRecordBatchReaderBuilder::try_new(bytes) {
        Ok(builder) => builder.with_batch_size(8192).build()?,
        Err(e) => {
            let error_msg = format!("Failed to read Parquet file: {}. Note: Only uncompressed and Snappy-compressed Parquet files are supported in WASM. If your file uses other compression (GZIP, ZSTD, LZ4, Brotli), please convert it to uncompressed or Snappy format.", e);
            println!("Rust: {}", error_msg);
            return Err(error_msg.into());
        }
    };

    println!("Rust: Starting Parquet batch processing...");

    // Collect batches - Arrow handles memory efficiently with RecordBatch
    let mut batches: Vec<RecordBatch> = Vec::new();
    for batch_result in arrow_reader {
        let batch = batch_result?;
        println!("Rust: Processed batch with {} rows", batch.num_rows());
        batches.push(batch);
    }

    let total_rows: usize = batches.iter().map(|b| b.num_rows()).sum();
    println!("Rust: Parquet processing complete. Total rows: {}", total_rows);

    // Store in engine - same interface as CSV for consistent operations
    engine.store_data(Some("data"), batches);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use arrow::array::{Int32Array, StringArray};
    use arrow::datatypes::{DataType, Field, Schema};
    use parquet::arrow::ArrowWriter;
    use parquet::file::properties::WriterProperties;
    use std::sync::Arc;

    #[test]
    fn test_parquet_to_batches() {
        // Create test data
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, false),
        ]));

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                Arc::new(Int32Array::from(vec![1, 2, 3])),
                Arc::new(StringArray::from(vec!["Alice", "Bob", "Charlie"])),
            ],
        )
        .unwrap();

        // Write to Parquet format
        let mut buffer = Vec::new();
        {
            let props = WriterProperties::builder().build();
            let mut writer = ArrowWriter::try_new(&mut buffer, schema, Some(props)).unwrap();
            writer.write(&batch).unwrap();
            writer.close().unwrap();
        }

        // Test parsing
        let mut engine = DataEngine::new();
        let result = parquet_to_batches(&mut engine, &buffer);
        assert!(result.is_ok());
    }
}
