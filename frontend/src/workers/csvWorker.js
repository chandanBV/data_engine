// csvWorker.js - Web Worker for CSV processing
import initSync, { DataEngine } from '../wasm/data-engine/data_engine.js';

let dataEngine = null;
let workerId = Math.random().toString(36).substr(2, 9); // Unique worker ID

console.log(`👷 Worker ${workerId} started`);

const initWasm = async () => {
  if (!dataEngine) {
    console.log(`🔧 Worker ${workerId}: Initializing WASM...`);
    await initSync();
    dataEngine = new DataEngine();
    console.log(`✅ Worker ${workerId}: DataEngine initialized`);
  }
  return dataEngine;
};

self.onmessage = async (e) => {
  const { type, data, fileName, fileSize } = e.data;

  try {
    switch (type) {
      case 'INIT':
        console.log(`🚀 Worker ${workerId}: Processing INIT request`);
        await initWasm();
        console.log(`✅ Worker ${workerId}: INIT completed`);
        self.postMessage({ type: 'INIT_SUCCESS' });
        break;

      case 'LOAD_CSV':
        console.log(`📊 Worker ${workerId}: Processing LOAD_CSV request`);
        const engine = await initWasm();
        const uint8Array = new Uint8Array(data);
        const startTime = performance.now();

        console.log(`⚡ Worker ${workerId}: Starting CSV processing for ${fileName || 'file'} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        try {
          // Process CSV through WASM
          console.log("Engine", engine)
          const result = await engine.load_data_from_csv(uint8Array);
          const endTime = performance.now();

          console.log(`✅ Worker ${workerId}: CSV processing completed in ${(endTime - startTime).toFixed(2)}ms`);

          // Get processed data
          const loadedData = engine.get_data();

          // Send results back to main thread
          self.postMessage({
            type: 'LOAD_SUCCESS',
            result: loadedData,
            dataSize: uint8Array.length,
            processingTime: endTime - startTime
          });
          console.log(`📤 Worker ${workerId}: Response sent to main thread`);
        } catch (error) {
          const endTime = performance.now();
          console.error(`❌ Worker ${workerId}: CSV processing failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
          throw error;
        }
        break;

      default:
        self.postMessage({ type: 'ERROR', error: 'Unknown message type' });
    }
  } catch (error) {
    console.error(`💥 Worker ${workerId} error:`, error);
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};

// Handle worker termination
self.addEventListener('beforeunload', () => {
  console.log(`🛑 Worker ${workerId} terminating`);
});
