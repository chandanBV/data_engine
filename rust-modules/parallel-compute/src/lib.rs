use wasm_bindgen::prelude::*;
use js_sys::Float64Array;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Parallel processor for multi-threaded computations
#[wasm_bindgen]
pub struct ParallelProcessor {
    data: Vec<f64>,
}

#[wasm_bindgen]
impl ParallelProcessor {
    /// Create a new ParallelProcessor with random data
    #[wasm_bindgen(constructor)]
    pub fn new(size: usize) -> Self {
        init_panic_hook();
        
        // Generate sample data
        let data: Vec<f64> = (0..size).map(|i| (i as f64) * 0.5).collect();
        
        Self { data }
    }

    /// Get data size
    pub fn size(&self) -> usize {
        self.data.len()
    }

    /// Process a chunk of data (for Web Worker processing)
    /// Returns the sum of squares for the specified range
    pub fn process_chunk(&self, start: usize, end: usize) -> f64 {
        let end = end.min(self.data.len());
        if start >= end {
            return 0.0;
        }

        self.data[start..end]
            .iter()
            .map(|&x| x * x)
            .sum()
    }

    /// Process entire dataset (single-threaded)
    pub fn process_sequential(&self) -> f64 {
        self.data.iter().map(|&x| x * x).sum()
    }

    /// Get a chunk of data as Float64Array for transfer to Web Worker
    pub fn get_chunk_array(&self, start: usize, end: usize) -> Float64Array {
        let end = end.min(self.data.len());
        if start >= end {
            return Float64Array::new_with_length(0);
        }

        Float64Array::from(&self.data[start..end])
    }

    /// Process data from SharedArrayBuffer (when available)
    /// This demonstrates zero-copy data sharing between workers
    pub fn process_shared_buffer(
        buffer: &Float64Array,
        start: usize,
        end: usize,
    ) -> f64 {
        let length = buffer.length() as usize;
        let end = end.min(length);
        
        if start >= end {
            return 0.0;
        }

        let mut sum = 0.0;
        for i in start..end {
            let value = buffer.get_index(i as u32);
            sum += value * value;
        }
        sum
    }

    /// Calculate statistics for a chunk
    pub fn calculate_stats(&self, start: usize, end: usize) -> JsValue {
        let end = end.min(self.data.len());
        if start >= end {
            return JsValue::NULL;
        }

        let chunk = &self.data[start..end];
        let sum: f64 = chunk.iter().sum();
        let count = chunk.len() as f64;
        let mean = sum / count;
        let min = chunk.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = chunk.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

        let result = js_sys::Object::new();
        js_sys::Reflect::set(&result, &"sum".into(), &sum.into()).unwrap();
        js_sys::Reflect::set(&result, &"mean".into(), &mean.into()).unwrap();
        js_sys::Reflect::set(&result, &"min".into(), &min.into()).unwrap();
        js_sys::Reflect::set(&result, &"max".into(), &max.into()).unwrap();
        js_sys::Reflect::set(&result, &"count".into(), &count.into()).unwrap();
        
        result.into()
    }
}

/// Standalone function for Web Worker to call
#[wasm_bindgen]
pub fn process_worker_chunk(data: Float64Array) -> f64 {
    let length = data.length() as usize;
    let mut sum = 0.0;
    
    for i in 0..length {
        let value = data.get_index(i as u32);
        sum += value * value;
    }
    
    sum
}

// Extension points:
// 1. Enable rayon for true parallel processing with WASM threads
// 2. Implement work-stealing scheduler for better load balancing
// 3. Add support for SharedArrayBuffer with Atomics
// 4. Implement thread pool management
// 5. Add memory-mapped file support for very large datasets
// 6. Implement async/await patterns for better composability

/*
To enable WASM threads (requires additional setup):

1. Add to Cargo.toml:
   rayon = "1.8"
   wasm-bindgen-rayon = "1.0"

2. Build with threads:
   RUSTFLAGS='-C target-feature=+atomics,+bulk-memory,+mutable-globals' \
   cargo build --target wasm32-unknown-unknown -Z build-std=std,panic_abort

3. Use rayon for parallel processing:
   use rayon::prelude::*;
   
   pub fn process_parallel(&self) -> f64 {
       self.data.par_iter().map(|&x| x * x).sum()
   }
*/
