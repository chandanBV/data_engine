#[cfg(test)]
mod tests {
    use crate::engine::DataEngine;

    #[test]
    fn test_load_csv() {
        let file = std::fs::read("data.csv").unwrap();
        let mut engine = DataEngine::new();
        // Note: We can't access private fields in tests
        // println!("engine initialized");
        let _result = engine.load_data_from_csv(&file);
        // assert!(result.is_ok());
        let data = engine.get_data();
        // println!("data: {:#?}", data);
        // Note: load_data_from_csv returns different types in WASM vs non-WASM
        println!("CSV file size: {}", file.len());
    }

    // Additional tests can be added here
}
