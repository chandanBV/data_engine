use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Data point structure for charting
#[derive(Clone, Copy, Debug)]
pub struct DataPoint {
    pub x: f32,
    pub y: f32,
}

/// Chart data processor optimized for large datasets
#[wasm_bindgen]
pub struct ChartProcessor {
    data: Vec<DataPoint>,
    chunk_size: usize,
}

#[wasm_bindgen]
impl ChartProcessor {
    /// Create a new ChartProcessor
    #[wasm_bindgen(constructor)]
    pub fn new(data_size: usize, chunk_size: usize) -> Self {
        init_panic_hook();
        
        // Generate sample data (in production, this would be loaded)
        let data: Vec<DataPoint> = (0..data_size)
            .map(|i| DataPoint {
                x: i as f32,
                y: (i as f32 / 100.0).sin() * 50.0 + 50.0,
            })
            .collect();

        Self { data, chunk_size }
    }

    /// Get the total number of data points
    pub fn data_size(&self) -> usize {
        self.data.len()
    }

    /// Get the number of chunks
    pub fn chunk_count(&self) -> usize {
        (self.data.len() + self.chunk_size - 1) / self.chunk_size
    }

    /// Process and return a chunk of data
    /// Returns a Float32Array with interleaved x,y coordinates
    pub fn get_chunk(&self, chunk_index: usize) -> Float32Array {
        let start = chunk_index * self.chunk_size;
        let end = (start + self.chunk_size).min(self.data.len());
        
        if start >= self.data.len() {
            return Float32Array::new_with_length(0);
        }

        let chunk = &self.data[start..end];
        let mut buffer = Vec::with_capacity(chunk.len() * 2);
        
        for point in chunk {
            buffer.push(point.x);
            buffer.push(point.y);
        }

        Float32Array::from(&buffer[..])
    }

    /// Downsample data using LTTB (Largest Triangle Three Buckets) algorithm
    /// This is useful for rendering large datasets efficiently
    pub fn downsample(&self, target_points: usize) -> Float32Array {
        if target_points >= self.data.len() {
            // No need to downsample
            return self.get_chunk(0);
        }

        let mut result = Vec::with_capacity(target_points * 2);
        let bucket_size = (self.data.len() as f32) / (target_points as f32);

        // Always include first point
        result.push(self.data[0].x);
        result.push(self.data[0].y);

        // Simple downsampling (average within buckets)
        // For production, implement LTTB algorithm for better visual representation
        for i in 1..target_points - 1 {
            let start = (i as f32 * bucket_size) as usize;
            let end = ((i + 1) as f32 * bucket_size) as usize;
            
            let avg_x: f32 = self.data[start..end].iter().map(|p| p.x).sum::<f32>() 
                / (end - start) as f32;
            let avg_y: f32 = self.data[start..end].iter().map(|p| p.y).sum::<f32>() 
                / (end - start) as f32;
            
            result.push(avg_x);
            result.push(avg_y);
        }

        // Always include last point
        let last = self.data.last().unwrap();
        result.push(last.x);
        result.push(last.y);

        Float32Array::from(&result[..])
    }

    /// Calculate aggregates for a chunk (min, max, avg)
    pub fn aggregate_chunk(&self, chunk_index: usize) -> JsValue {
        let start = chunk_index * self.chunk_size;
        let end = (start + self.chunk_size).min(self.data.len());
        
        if start >= self.data.len() {
            return JsValue::NULL;
        }

        let chunk = &self.data[start..end];
        let min_y = chunk.iter().map(|p| p.y).fold(f32::INFINITY, f32::min);
        let max_y = chunk.iter().map(|p| p.y).fold(f32::NEG_INFINITY, f32::max);
        let avg_y = chunk.iter().map(|p| p.y).sum::<f32>() / chunk.len() as f32;

        let result = js_sys::Object::new();
        js_sys::Reflect::set(&result, &"min".into(), &min_y.into()).unwrap();
        js_sys::Reflect::set(&result, &"max".into(), &max_y.into()).unwrap();
        js_sys::Reflect::set(&result, &"avg".into(), &avg_y.into()).unwrap();
        
        result.into()
    }
}

// Extension points:
// 1. Implement proper LTTB (Largest Triangle Three Buckets) algorithm
// 2. Add support for SharedArrayBuffer for zero-copy transfers
// 3. Implement streaming updates for real-time data
// 4. Add WebGL rendering helpers
// 5. Implement windowing for zooming/panning operations
