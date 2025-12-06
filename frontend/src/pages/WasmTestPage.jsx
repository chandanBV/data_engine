import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Database, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createDataEngine } from '../utils/wasmLoader';

const WasmTestPage = () => {
  const [wasmStatus, setWasmStatus] = useState('loading');
  const [dataEngine, setDataEngine] = useState(null);
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    initializeWasm();
  }, []);

  const initializeWasm = async () => {
    try {
      console.log('🔄 Starting WASM initialization...');
      setWasmStatus('loading');

      // Use centralized WASM loader
      const engine = await createDataEngine();
      console.log('🚀 Engine created:', engine);

      setDataEngine(engine);
      setWasmStatus('success');
      toast.success('WASM module loaded successfully!');

    } catch (error) {
      console.error('❌ WASM initialization failed:', error);
      setWasmStatus('error');
      toast.error(`WASM initialization failed: ${error.message}`);
    }
  };

  const runTest = async (testName, testFn) => {
    try {
      console.log(`🧪 Running test: ${testName}`);
      const result = await testFn();
      const testResult = { name: testName, status: 'success', result };
      setTestResults(prev => [...prev, testResult]);
      console.log(`✅ Test passed: ${testName}`, result);
      return result;
    } catch (error) {
      const testResult = { name: testName, status: 'error', error: error.message };
      setTestResults(prev => [...prev, testResult]);
      console.error(`❌ Test failed: ${testName}`, error);
      throw error;
    }
  };

  const testBasicFunctions = async () => {
    if (!dataEngine) {
      toast.error('Data engine not initialized');
      return;
    }

    setTestResults([]);

    try {
      // Test 1: Schema (should work even without data)
      await runTest('Get Schema', async () => {
        return await dataEngine.get_schema();
      });

      // Test 2: JSON data export (should work even without data)
      await runTest('Get JSON Data', async () => {
        return await dataEngine.get_data_json();
      });

      // Test 3: Load sample CSV data
      await runTest('Load CSV Data', async () => {
        const csvData = `category,region,sales,quantity
Electronics,North,1200,15
Clothing,South,800,25
Electronics,East,1500,20`;
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvData);
        return await dataEngine.load_csv(bytes);
      });

      // Test 4: Get schema after loading data
      await runTest('Get Schema After Load', async () => {
        return await dataEngine.get_schema();
      });

      // Test 5: Get JSON data after loading
      await runTest('Get JSON After Load', async () => {
        return await dataEngine.get_data_json();
      });

      toast.success('All tests completed!');

    } catch (error) {
      toast.error(`Test failed: ${error.message}`);
    }
  };

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'loading':
        return <Database className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">WASM Module Test</h1>
          <p className="text-muted-foreground">
            Testing the WebAssembly data engine initialization and basic functions
          </p>
        </div>

        <div className="grid gap-6">
          {/* WASM Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon status={wasmStatus} />
                WASM Module Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Status: <span className={`font-semibold ${
                  wasmStatus === 'success' ? 'text-green-600' :
                  wasmStatus === 'error' ? 'text-red-600' : 'text-blue-600'
                }`}>{wasmStatus}</span></p>
                <p>Engine: {dataEngine ? '✅ Created' : '❌ Not created'}</p>
                
                {wasmStatus === 'success' && (
                  <Button onClick={testBasicFunctions} className="mt-4">
                    Run Basic Tests
                  </Button>
                )}
                
                {wasmStatus === 'error' && (
                  <Button onClick={initializeWasm} variant="outline" className="mt-4">
                    Retry Initialization
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testResults.map((test, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded">
                      <StatusIcon status={test.status} />
                      <div className="flex-1">
                        <h4 className="font-semibold">{test.name}</h4>
                        {test.status === 'success' && (
                          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                            {typeof test.result === 'string' ? test.result : JSON.stringify(test.result, null, 2)}
                          </pre>
                        )}
                        {test.status === 'error' && (
                          <p className="text-red-600 text-sm mt-1">{test.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default WasmTestPage;
