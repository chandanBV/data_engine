import React, { useState } from 'react';
import { Navigation } from '../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Database, Play, Code2, Info, Zap } from 'lucide-react';
import { toast } from 'sonner';

const DataEnginePage = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  // Mock data for demonstration
  const sampleData = [
    { id: 1, category: 'Electronics', sales: 1200, region: 'North' },
    { id: 2, category: 'Clothing', sales: 800, region: 'South' },
    { id: 3, category: 'Electronics', sales: 1500, region: 'East' },
    { id: 4, category: 'Food', sales: 600, region: 'West' },
    { id: 5, category: 'Clothing', sales: 950, region: 'North' },
  ];

  const handleProcess = (operation) => {
    setIsProcessing(true);
    
    // Simulate WASM processing
    setTimeout(() => {
      let processedResult;
      
      switch(operation) {
        case 'aggregate':
          // Mock aggregation by category
          const aggregated = {};
          sampleData.forEach(item => {
            if (!aggregated[item.category]) {
              aggregated[item.category] = { count: 0, totalSales: 0 };
            }
            aggregated[item.category].count++;
            aggregated[item.category].totalSales += item.sales;
          });
          processedResult = Object.entries(aggregated).map(([category, data]) => ({
            category,
            count: data.count,
            totalSales: data.totalSales,
            avgSales: Math.round(data.totalSales / data.count)
          }));
          break;
          
        case 'filter':
          // Mock filter: sales > 900
          processedResult = sampleData.filter(item => item.sales > 900);
          break;
          
        case 'pivot':
          // Mock pivot: region by category
          const pivot = {};
          sampleData.forEach(item => {
            if (!pivot[item.region]) pivot[item.region] = {};
            if (!pivot[item.region][item.category]) {
              pivot[item.region][item.category] = 0;
            }
            pivot[item.region][item.category] += item.sales;
          });
          processedResult = pivot;
          break;
          
        default:
          processedResult = sampleData;
      }
      
      setResult(processedResult);
      setIsProcessing(false);
      toast.success(`${operation.charAt(0).toUpperCase() + operation.slice(1)} completed!`);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-chart-1/10">
              <Database className="h-8 w-8 text-chart-1" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">WebAssembly Data Engine</h1>
              <p className="text-muted-foreground">Process large tabular data in the browser with Rust + WASM</p>
            </div>
          </div>
          
          <Alert className="border-chart-1/50 bg-chart-1/5">
            <Info className="h-4 w-4 text-chart-1" />
            <AlertDescription>
              This demo uses mock data. In production, WASM modules handle millions of rows with efficient memory usage and blazing-fast performance.
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Operations */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-chart-1" />
                  Operations
                </CardTitle>
                <CardDescription>Select a data processing operation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => handleProcess('aggregate')}
                  disabled={isProcessing}
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <Play className="h-4 w-4" />
                  Aggregate by Category
                </Button>
                <Button
                  onClick={() => handleProcess('filter')}
                  disabled={isProcessing}
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <Play className="h-4 w-4" />
                  Filter (Sales > 900)
                </Button>
                <Button
                  onClick={() => handleProcess('pivot')}
                  disabled={isProcessing}
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <Play className="h-4 w-4" />
                  Pivot (Region × Category)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="secondary" className="w-full justify-start">Arrow Format Support</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Zero-Copy Serialization</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Streaming Processing</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Memory Efficient</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results and Code */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sample Data */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Input Data</CardTitle>
                <CardDescription>5 rows × 4 columns (scaled to millions in production)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="code-block overflow-x-auto">
                  <pre className="text-xs">{JSON.stringify(sampleData, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {result && (
              <Card className="border-chart-1/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-chart-1" />
                    Processed Result
                  </CardTitle>
                  <CardDescription>Computed in {isProcessing ? '...' : '< 1ms'} (WASM mock)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="code-block overflow-x-auto">
                    <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
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
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="rust">Rust (WASM)</TabsTrigger>
                    <TabsTrigger value="js">JavaScript</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="rust" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct DataRow {
    id: u32,
    category: String,
    sales: f64,
    region: String,
}

#[wasm_bindgen]
pub fn aggregate_by_category(data: JsValue) -> Result<JsValue, JsValue> {
    // Deserialize from JS
    let rows: Vec<DataRow> = serde_wasm_bindgen::from_value(data)?;
    
    // Process data efficiently
    let mut aggregates = HashMap::new();
    for row in rows {
        let entry = aggregates.entry(row.category).or_insert((0, 0.0));
        entry.0 += 1;
        entry.1 += row.sales;
    }
    
    // Serialize back to JS
    Ok(serde_wasm_bindgen::to_value(&aggregates)?)
}

// Extension: Use Arrow for zero-copy transfers
// Extension: Add streaming for huge datasets
// Extension: Implement custom binary serialization`}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="js" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`import init, { aggregate_by_category } from './pkg/data_engine';

// Initialize WASM module
await init();

// Call Rust function from JavaScript
const data = [
  { id: 1, category: 'Electronics', sales: 1200, region: 'North' },
  { id: 2, category: 'Clothing', sales: 800, region: 'South' },
  // ... more rows
];

const result = aggregate_by_category(data);
console.log(result);

// For large datasets, use Arrow format:
import * as arrow from 'apache-arrow';
const table = arrow.tableFromJSON(data);
const wasmResult = process_arrow_table(table.serialize());`}</pre>
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

export default DataEnginePage;
