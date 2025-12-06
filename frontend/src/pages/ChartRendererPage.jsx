import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from '../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Slider } from '../components/ui/slider';
import { LineChart, Play, Code2, Info, Zap, Pause } from 'lucide-react';
import { toast } from 'sonner';

const ChartRendererPage = () => {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);
  const [dataPoints, setDataPoints] = useState(100000);
  const [fps, setFps] = useState(0);
  const animationRef = useRef(null);

  // Generate mock data
  const generateData = (count) => {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        x: i,
        y: Math.sin(i / 100) * 50 + Math.random() * 20 + 100
      });
    }
    return data;
  };

  const renderChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const data = generateData(dataPoints);

    // Clear canvas
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim();
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--border')
      .trim();
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw data
    ctx.strokeStyle = 'hsl(217, 91%, 55%)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const xScale = width / data.length;
    const yScale = height / 200;
    
    data.forEach((point, i) => {
      const x = i * xScale;
      const y = height - (point.y * yScale);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  };

  const startRendering = () => {
    setIsRendering(true);
    let lastTime = performance.now();
    let frameCount = 0;

    const animate = (currentTime) => {
      frameCount++;
      const elapsed = currentTime - lastTime;
      
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = currentTime;
      }

      renderChart();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    toast.success('Rendering started!');
  };

  const stopRendering = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsRendering(false);
    setFps(0);
    toast.info('Rendering stopped');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      renderChart();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dataPoints]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-chart-2/10">
              <LineChart className="h-8 w-8 text-chart-2" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Real-time Chart Renderer</h1>
              <p className="text-muted-foreground">Process 1M+ data points with Rust and stream to Canvas/WebGL</p>
            </div>
          </div>
          
          <Alert className="border-chart-2/50 bg-chart-2/5">
            <Info className="h-4 w-4 text-chart-2" />
            <AlertDescription>
              WASM precomputes aggregations and streams data chunks asynchronously for smooth 60 FPS rendering.
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-chart-2" />
                  Controls
                </CardTitle>
                <CardDescription>Configure rendering parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Data Points</label>
                    <Badge variant="secondary">{dataPoints.toLocaleString()}</Badge>
                  </div>
                  <Slider
                    value={[dataPoints]}
                    onValueChange={(value) => setDataPoints(value[0])}
                    min={1000}
                    max={1000000}
                    step={10000}
                    disabled={isRendering}
                  />
                  <p className="text-xs text-muted-foreground">
                    Simulates WASM processing of large datasets
                  </p>
                </div>

                <div className="space-y-3">
                  {!isRendering ? (
                    <Button
                      onClick={startRendering}
                      className="w-full gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Start Real-time Rendering
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRendering}
                      variant="destructive"
                      className="w-full gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      Stop Rendering
                    </Button>
                  )}
                </div>

                {isRendering && (
                  <div className="p-4 rounded-lg bg-chart-2/10 border border-chart-2/20">
                    <div className="text-2xl font-bold text-chart-2">{fps} FPS</div>
                    <div className="text-xs text-muted-foreground mt-1">Real-time frame rate</div>
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
                  <Badge variant="secondary" className="w-full justify-start">Async Data Streaming</Badge>
                  <Badge variant="secondary" className="w-full justify-start">SharedArrayBuffer</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Canvas 2D / WebGL</Badge>
                  <Badge variant="secondary" className="w-full justify-start">60 FPS Target</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Canvas and Code */}
          <div className="lg:col-span-2 space-y-6">
            {/* Canvas */}
            <Card className="border-chart-2/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-chart-2" />
                  Live Chart Canvas
                </CardTitle>
                <CardDescription>
                  {dataPoints.toLocaleString()} data points rendered in real-time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <canvas
                  ref={canvasRef}
                  className="w-full h-64 rounded-lg border border-border bg-card"
                />
              </CardContent>
            </Card>

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
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="rust">Rust (WASM)</TabsTrigger>
                    <TabsTrigger value="js">JavaScript</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="rust" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`use wasm_bindgen::prelude::*;
use js_sys::{Float32Array, Uint8Array};
use web_sys::console;

#[wasm_bindgen]
pub struct ChartProcessor {
    data: Vec<f32>,
    chunk_size: usize,
}

#[wasm_bindgen]
impl ChartProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(size: usize) -> Self {
        Self {
            data: Vec::with_capacity(size),
            chunk_size: 10000,
        }
    }
    
    // Aggregate data in chunks for streaming
    pub fn process_chunk(&mut self, start: usize) -> Float32Array {
        let end = (start + self.chunk_size).min(self.data.len());
        let chunk = &self.data[start..end];
        
        // Perform aggregations, smoothing, etc.
        let processed: Vec<f32> = chunk.iter()
            .map(|&v| v * 0.9) // Example processing
            .collect();
        
        Float32Array::from(&processed[..])
    }
    
    // Use SharedArrayBuffer for zero-copy transfer
    pub fn get_shared_buffer(&self) -> js_sys::SharedArrayBuffer {
        // Implementation for shared memory access
        // Enables parallel processing with Web Workers
    }
}

// Extension: Implement downsampling algorithms
// Extension: Add WebGL rendering support
// Extension: Real-time data windowing`}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="js" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`import init, { ChartProcessor } from './pkg/chart_renderer';

// Initialize WASM
await init();

const processor = new ChartProcessor(1000000);

// Stream data in chunks
let offset = 0;
const animate = () => {
  // Get processed chunk from WASM
  const chunk = processor.process_chunk(offset);
  
  // Render to Canvas
  renderChunk(ctx, chunk);
  
  offset += 10000;
  if (offset < 1000000) {
    requestAnimationFrame(animate);
  }
};

animate();

// For WebGL:
const gl = canvas.getContext('webgl2');
const buffer = processor.get_shared_buffer();
gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.DYNAMIC_DRAW);`}</pre>
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

export default ChartRendererPage;
