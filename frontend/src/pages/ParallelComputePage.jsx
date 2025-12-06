import React, { useState, useRef } from 'react';
import { Navigation } from '../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Cpu, Play, Code2, Info, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const ParallelComputePage = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [workers, setWorkers] = useState([]);
  const [result, setResult] = useState(null);
  const workersRef = useRef([]);

  const dataSize = 1000000;
  const numWorkers = 4;

  const startParallelProcessing = () => {
    setIsProcessing(true);
    setProgress(0);
    setWorkers([]);
    
    // Simulate Web Workers processing
    const workerProgress = Array(numWorkers).fill(0);
    const workerResults = Array(numWorkers).fill(null);
    let completedWorkers = 0;

    // Simulate each worker processing a chunk
    for (let i = 0; i < numWorkers; i++) {
      const workerId = i;
      const chunkSize = dataSize / numWorkers;
      const start = i * chunkSize;
      const end = start + chunkSize;

      setWorkers(prev => [...prev, {
        id: workerId,
        status: 'processing',
        progress: 0,
        range: `${start.toLocaleString()} - ${end.toLocaleString()}`
      }]);

      // Simulate worker progress
      const interval = setInterval(() => {
        workerProgress[workerId] += 5;
        
        if (workerProgress[workerId] >= 100) {
          workerProgress[workerId] = 100;
          clearInterval(interval);
          completedWorkers++;
          
          // Mock result for this worker
          workerResults[workerId] = {
            sum: Math.random() * 10000000,
            count: chunkSize,
            avg: Math.random() * 100
          };

          setWorkers(prev => prev.map(w => 
            w.id === workerId 
              ? { ...w, status: 'completed', progress: 100 }
              : w
          ));

          // All workers completed
          if (completedWorkers === numWorkers) {
            const totalSum = workerResults.reduce((acc, r) => acc + r.sum, 0);
            const totalCount = workerResults.reduce((acc, r) => acc + r.count, 0);
            
            setResult({
              totalSum: Math.round(totalSum),
              totalCount: totalCount,
              avgValue: Math.round(totalSum / totalCount),
              workers: numWorkers,
              dataSize: dataSize,
              timeMs: 1847 // Mock time
            });
            
            setIsProcessing(false);
            toast.success('Parallel processing completed!');
          }
        }

        setWorkers(prev => prev.map(w => 
          w.id === workerId 
            ? { ...w, progress: workerProgress[workerId] }
            : w
        ));

        const totalProgress = workerProgress.reduce((a, b) => a + b, 0) / numWorkers;
        setProgress(Math.round(totalProgress));
      }, 50);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-chart-4/10">
              <Cpu className="h-8 w-8 text-chart-4" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Parallel Computation in Browser</h1>
              <p className="text-muted-foreground">Multi-core processing with Rust threads and Web Workers</p>
            </div>
          </div>
          
          <Alert className="border-chart-4/50 bg-chart-4/5">
            <Info className="h-4 w-4 text-chart-4" />
            <AlertDescription>
              WASM threads use SharedArrayBuffer and atomics for true parallel execution across multiple CPU cores.
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-chart-4" />
                  Parallel Configuration
                </CardTitle>
                <CardDescription>Multi-threaded processing setup</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data Size</span>
                    <span className="font-mono font-medium">{dataSize.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Worker Threads</span>
                    <span className="font-mono font-medium">{numWorkers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Chunk Size</span>
                    <span className="font-mono font-medium">{(dataSize / numWorkers).toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  onClick={startParallelProcessing}
                  disabled={isProcessing}
                  className="w-full gap-2"
                >
                  <Play className="h-4 w-4" />
                  {isProcessing ? 'Processing...' : 'Start Processing'}
                </Button>

                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="secondary" className="w-full justify-start">SharedArrayBuffer</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Atomic Operations</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Web Workers API</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Thread Pool</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Workers and Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Worker Status */}
            {workers.length > 0 && (
              <Card className="border-chart-4/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-chart-4" />
                    Worker Threads
                  </CardTitle>
                  <CardDescription>{workers.length} threads processing in parallel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {workers.map((worker) => (
                      <div key={worker.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {worker.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                            ) : (
                              <div className="h-4 w-4 border-2 border-chart-4 border-t-transparent rounded-full animate-spin" />
                            )}
                            <div>
                              <div className="text-sm font-medium">Worker {worker.id}</div>
                              <div className="text-xs text-muted-foreground">{worker.range}</div>
                            </div>
                          </div>
                          <Badge variant={worker.status === 'completed' ? 'default' : 'secondary'}>
                            {worker.progress}%
                          </Badge>
                        </div>
                        <Progress value={worker.progress} className="h-1" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {result && (
              <Card className="border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                    Processing Complete
                  </CardTitle>
                  <CardDescription>Results from {result.workers} parallel workers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{result.totalSum.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Sum</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{result.totalCount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1">Items Processed</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{result.avgValue}</div>
                      <div className="text-xs text-muted-foreground mt-1">Average Value</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{result.timeMs}ms</div>
                      <div className="text-xs text-muted-foreground mt-1">Execution Time</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Code Examples */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5" />
                  Implementation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="rust">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="rust">Rust (WASM)</TabsTrigger>
                    <TabsTrigger value="js">JavaScript</TabsTrigger>
                    <TabsTrigger value="worker">Web Worker</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="rust" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`use wasm_bindgen::prelude::*;
use rayon::prelude::*;
use std::sync::{Arc, Mutex};

#[wasm_bindgen]
pub struct ParallelProcessor {
    data: Vec<f64>,
}

#[wasm_bindgen]
impl ParallelProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(size: usize) -> Self {
        Self {
            data: (0..size).map(|i| i as f64).collect(),
        }
    }
    
    // Process data in parallel using rayon
    pub fn process_parallel(&self) -> f64 {
        self.data
            .par_iter()
            .map(|&x| x * x)
            .sum()
    }
    
    // Use SharedArrayBuffer for zero-copy
    pub fn process_with_shared_memory(
        &self,
        buffer: &[u8]
    ) -> Result<(), JsValue> {
        // Cast buffer to data type
        let shared_data = unsafe {
            std::slice::from_raw_parts(
                buffer.as_ptr() as *const f64,
                buffer.len() / 8
            )
        };
        
        // Process with atomic operations
        // Use std::sync::atomic for thread-safe updates
        Ok(())
    }
}

// Extension: Implement thread pool
// Extension: Add work stealing scheduler
// Extension: Memory-mapped file support`}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="js" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`import init, { ParallelProcessor } from './pkg/parallel';

// Initialize WASM with threads
await init();

// Create shared buffer
const buffer = new SharedArrayBuffer(1000000 * 8);
const view = new Float64Array(buffer);

// Spawn Web Workers
const numWorkers = navigator.hardwareConcurrency || 4;
const workers = [];

for (let i = 0; i < numWorkers; i++) {
  const worker = new Worker('worker.js');
  workers.push(worker);
  
  // Send chunk to worker
  const chunkSize = view.length / numWorkers;
  worker.postMessage({
    buffer: buffer,
    start: i * chunkSize,
    end: (i + 1) * chunkSize
  });
}

// Collect results
Promise.all(workers.map(w => 
  new Promise(resolve => {
    w.onmessage = (e) => resolve(e.data);
  })
)).then(results => {
  console.log('All workers complete', results);
});`}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="worker" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`// worker.js
import init, { ParallelProcessor } from './pkg/parallel';

await init();

self.onmessage = async (e) => {
  const { buffer, start, end } = e.data;
  
  // Access shared buffer
  const view = new Float64Array(buffer);
  const chunk = view.slice(start, end);
  
  // Process with WASM
  const processor = new ParallelProcessor(chunk.length);
  const result = processor.process_parallel();
  
  // Send result back
  self.postMessage({
    workerId: self.name,
    result: result,
    range: [start, end]
  });
};`}</pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParallelComputePage;
