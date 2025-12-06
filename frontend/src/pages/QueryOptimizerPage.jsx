import React, { useState } from 'react';
import { Navigation } from '../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Search, Play, Code2, Info, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const QueryOptimizerPage = () => {
  const [query, setQuery] = useState('SELECT category, SUM(sales) FROM data WHERE region = "North" GROUP BY category');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [queryPlan, setQueryPlan] = useState(null);

  const sampleData = [
    { id: 1, category: 'Electronics', sales: 1200, region: 'North', date: '2024-01-15' },
    { id: 2, category: 'Clothing', sales: 800, region: 'South', date: '2024-01-16' },
    { id: 3, category: 'Electronics', sales: 1500, region: 'East', date: '2024-01-17' },
    { id: 4, category: 'Food', sales: 600, region: 'West', date: '2024-01-18' },
    { id: 5, category: 'Clothing', sales: 950, region: 'North', date: '2024-01-19' },
    { id: 6, category: 'Electronics', sales: 1100, region: 'North', date: '2024-01-20' },
  ];

  const exampleQueries = [
    'SELECT * FROM data WHERE sales > 1000',
    'SELECT category, SUM(sales) FROM data GROUP BY category',
    'SELECT region, AVG(sales) FROM data GROUP BY region ORDER BY AVG(sales) DESC',
  ];

  const executeQuery = () => {
    setIsExecuting(true);
    
    // Simulate query parsing and execution
    setTimeout(() => {
      // Mock query plan
      const plan = {
        steps: [
          { operation: 'Parse SQL', status: 'success', time: '0.2ms' },
          { operation: 'Validate Schema', status: 'success', time: '0.1ms' },
          { operation: 'Optimize Plan', status: 'success', time: '0.3ms' },
          { operation: 'Execute Filter', status: 'success', time: '0.5ms' },
          { operation: 'Execute Aggregate', status: 'success', time: '0.4ms' },
        ],
        totalTime: '1.5ms',
        rowsProcessed: sampleData.length,
        rowsReturned: 2
      };
      
      // Mock result based on query
      let queryResult;
      if (query.toLowerCase().includes('where region = "north"')) {
        const filtered = sampleData.filter(item => item.region === 'North');
        const aggregated = {};
        filtered.forEach(item => {
          if (!aggregated[item.category]) aggregated[item.category] = 0;
          aggregated[item.category] += item.sales;
        });
        queryResult = Object.entries(aggregated).map(([category, sales]) => ({
          category,
          total_sales: sales
        }));
      } else {
        queryResult = sampleData.slice(0, 3);
      }
      
      setQueryPlan(plan);
      setResult(queryResult);
      setIsExecuting(false);
      toast.success('Query executed successfully!');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-chart-3/10">
              <Search className="h-8 w-8 text-chart-3" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Query Optimizer</h1>
              <p className="text-muted-foreground">Execute SQL-like queries on CSV/JSON data with Rust WASM</p>
            </div>
          </div>
          
          <Alert className="border-chart-3/50 bg-chart-3/5">
            <Info className="h-4 w-4 text-chart-3" />
            <AlertDescription>
              WASM parser handles SQL syntax, optimizes query plans, and executes against in-memory data structures.
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Query Input */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-chart-3" />
                  SQL Query
                </CardTitle>
                <CardDescription>Enter your query below</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="SELECT * FROM data"
                  className="font-mono text-sm min-h-[120px]"
                  disabled={isExecuting}
                />
                
                <Button
                  onClick={executeQuery}
                  disabled={isExecuting}
                  className="w-full gap-2"
                >
                  <Play className="h-4 w-4" />
                  {isExecuting ? 'Executing...' : 'Execute Query'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Example Queries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {exampleQueries.map((example, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs font-mono h-auto py-2 px-3"
                    onClick={() => setQuery(example)}
                    disabled={isExecuting}
                  >
                    {example}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supported Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="secondary" className="w-full justify-start">SELECT, WHERE, GROUP BY</Badge>
                  <Badge variant="secondary" className="w-full justify-start">ORDER BY, LIMIT</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Aggregates (SUM, AVG, COUNT)</Badge>
                  <Badge variant="secondary" className="w-full justify-start">Join Operations</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Query Plan */}
            {queryPlan && (
              <Card className="border-chart-3/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-chart-3" />
                    Query Execution Plan
                  </CardTitle>
                  <CardDescription>
                    Completed in {queryPlan.totalTime} • {queryPlan.rowsProcessed} rows processed • {queryPlan.rowsReturned} rows returned
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {queryPlan.steps.map((step, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          {step.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">{step.operation}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{step.time}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>Query Results</CardTitle>
                  <CardDescription>{result.length} rows returned</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="code-block overflow-x-auto">
                    <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sample Data */}
            <Card>
              <CardHeader>
                <CardTitle>Available Data</CardTitle>
                <CardDescription>Sample dataset (CSV/JSON)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="code-block overflow-x-auto">
                  <pre className="text-xs">{JSON.stringify(sampleData, null, 2)}</pre>
                </div>
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
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;

#[wasm_bindgen]
pub struct QueryEngine {
    data: Vec<serde_json::Value>,
}

#[wasm_bindgen]
impl QueryEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(json_data: &str) -> Result<QueryEngine, JsValue> {
        let data: Vec<serde_json::Value> = 
            serde_json::from_str(json_data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(QueryEngine { data })
    }
    
    pub fn execute(&self, sql: &str) -> Result<JsValue, JsValue> {
        // Parse SQL
        let dialect = GenericDialect {};
        let ast = Parser::parse_sql(&dialect, sql)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        // Optimize query plan
        let plan = optimize_query_plan(&ast[0]);
        
        // Execute against data
        let result = execute_plan(&plan, &self.data)?;
        
        // Return as JS value
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

// Extension: Add index support for faster lookups
// Extension: Implement join algorithms
// Extension: Query result caching`}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="js" className="mt-4">
                    <div className="code-block overflow-x-auto">
                      <pre className="text-xs leading-relaxed">{`import init, { QueryEngine } from './pkg/query_optimizer';

// Initialize WASM
await init();

// Load data (CSV or JSON)
const csvData = await fetch('data.csv').then(r => r.text());
const jsonData = csvToJson(csvData);

// Create query engine
const engine = new QueryEngine(JSON.stringify(jsonData));

// Execute SQL queries
const result = engine.execute(
  'SELECT category, SUM(sales) FROM data GROUP BY category'
);

console.log(result);

// Get query execution plan
const plan = engine.explain(
  'SELECT * FROM data WHERE sales > 1000'
);`}</pre>
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

export default QueryOptimizerPage;
