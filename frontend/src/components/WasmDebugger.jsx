import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const WasmDebugger = ({ dataEngine }) => {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async (name, testFn) => {
    try {
      console.log(`🧪 Running test: ${name}`);
      const result = await testFn();
      const testResult = {
        name,
        status: 'success',
        result: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        timestamp: new Date().toLocaleTimeString()
      };
      setTestResults(prev => [...prev, testResult]);
      return result;
    } catch (error) {
      const testResult = {
        name,
        status: 'error',
        error: error.message,
        timestamp: new Date().toLocaleTimeString()
      };
      setTestResults(prev => [...prev, testResult]);
      throw error;
    }
  };

  const runAllTests = async () => {
    if (!dataEngine) {
      alert('No data engine available');
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Basic engine methods
      await runTest('Engine Available', async () => {
        return `Engine type: ${typeof dataEngine}, methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(dataEngine)).join(', ')}`;
      });

      // Test 2: Get schema (empty)
      await runTest('Get Schema (Empty)', async () => {
        return await dataEngine.get_schema();
      });

      // Test 3: Get data JSON (empty)
      await runTest('Get Data JSON (Empty)', async () => {
        return await dataEngine.get_data_json();
      });

      // Test 4: Load sample CSV data
      await runTest('Load Sample CSV', async () => {
        const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles
Bob,35,Chicago`;
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvData);
        return await dataEngine.load_csv(bytes);
      });

      // Test 5: Get schema after loading
      await runTest('Get Schema (After Load)', async () => {
        return await dataEngine.get_schema();
      });

      // Test 6: Get data JSON after loading
      await runTest('Get Data JSON (After Load)', async () => {
        return await dataEngine.get_data_json();
      });

      // Test 7: Test pivot operation
      await runTest('Test Pivot', async () => {
        const config = {
          row_fields: ["city"],
          column_fields: [],
          value_fields: ["age"],
          aggregation_type: "sum"
        };
        return await dataEngine.pivot(JSON.stringify(config));
      });

    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          WASM Engine Debugger
          <Button 
            onClick={runAllTests} 
            disabled={!dataEngine || isRunning}
            size="sm"
          >
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={dataEngine ? 'default' : 'destructive'}>
              Engine: {dataEngine ? 'Available' : 'Not Available'}
            </Badge>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <h4 className="font-semibold text-sm">Test Results:</h4>
              {testResults.map((test, index) => (
                <div key={index} className="border rounded p-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusIcon status={test.status} />
                    <span className="font-medium">{test.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {test.timestamp}
                    </span>
                  </div>
                  
                  {test.status === 'success' && test.result && (
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                      {test.result}
                    </pre>
                  )}
                  
                  {test.status === 'error' && (
                    <div className="text-red-600 text-xs bg-red-50 p-2 rounded">
                      {test.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WasmDebugger;
