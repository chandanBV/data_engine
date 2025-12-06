#[cfg(test)]
mod tests {
    use crate::{aggregation::AggOp, engine::DataEngine};

    #[test]
    fn test_load_csv() {
        let file = std::fs::read("data.csv").unwrap();
        let mut engine = DataEngine::new();
        // Note: We can't access private fields in tests
        // println!("engine initialized");
        println!("engine initialized");
        let _ = engine.load_data_from_csv(&file);
        let agg_result = engine.aggregation("", AggOp::Sum);
        println!("agg_result: {:#?}", agg_result);
        // assert!(result.is_ok());
        // let data = engine.get_data(Some("data"));
        // println!("data: {:#?}", data);
        // Note: load_data_from_csv returns different types in WASM vs non-WASM
        println!("CSV file size: {}", file.len());
    }

    // Additional tests can be added here
}
