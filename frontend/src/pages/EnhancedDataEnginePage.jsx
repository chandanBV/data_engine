import React, { useState, useEffect } from "react";
import { Navigation } from "../components/Navigation";
import DataUploader from "../components/DataUploader";
import ProcessingControls from "../components/ProcessingControls";
import ResultViewer from "../components/ResultViewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Database, Info, Zap, Activity, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { createDataEngine } from "../utils/wasmLoader";
import PerformanceMonitor from "../components/PerformanceMonitor";

const EnhancedDataEnginePage = () => {
  const [dataEngine, setDataEngine] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [uploadedData, setUploadedData] = useState(null);
  const [processingResult, setProcessingResult] = useState(null);
  const [performanceLogs, setPerformanceLogs] = useState([]);

  const logPerformance = (metrics) => {
    if (!metrics) return;
    setPerformanceLogs((prev) => [
      {
        ...metrics,
        timestamp: Date.now(),
      },
      ...prev,
    ]);
  };

  useEffect(() => {
    const initializeWasm = async () => {
      try {
        console.log("Initializing WASM module...");

        // Use centralized WASM loader to avoid webpack conflicts
        const engine = await createDataEngine();

        setDataEngine(engine);
        setIsInitialized(true);

        console.log("WASM Data Engine initialized successfully");
        toast.success("Data engine initialized successfully!");
      } catch (error) {
        console.error("Failed to initialize WASM:", error);
        toast.error(`Failed to initialize data engine: ${error.message}`);
      }
    };

    initializeWasm();
  }, []);

  const handleDataLoaded = (data) => {
    setUploadedData(data);
    setProcessingResult(null); // Clear previous results
    if (data.metrics) {
      logPerformance(data.metrics);
    }
  };

  const handleProcessingResult = (result) => {
    setProcessingResult(result);
    if (result.metrics) {
      logPerformance(result.metrics);
    }
  };

  const handleReset = async () => {
    if (!dataEngine) {
      setProcessingResult(null);
      return;
    }

    try {
      // Use efficient restore_original method instead of reloading file
      await dataEngine.restore_original();
      setProcessingResult(null);
      toast.success("Reset to original data");
    } catch (error) {
      console.error("Error resetting data:", error);
      toast.error("Failed to reset data");
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">
                Initializing WebAssembly Data Engine...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {!uploadedData ? (
          // PowerBI-style full-screen upload interface
          <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <Database className="h-12 w-12 text-primary" />
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Data Engine
                  </h1>
                  <p className="text-xl text-muted-foreground mt-2">
                    High-performance data processing with Rust & WebAssembly
                  </p>
                </div>
              </div>
            </div>

            {/* Main upload area - PowerBI style */}
            <div className="w-full max-w-4xl">
              <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-12">
                  <div className="text-center space-y-6">
                    <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                      <Database className="h-12 w-12 text-primary" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold">Get Data</h2>
                      <p className="text-muted-foreground text-lg">
                        Upload CSV, JSON, Parquet, or Excel files to start analyzing your data
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <div className="text-2xl mb-2">📊</div>
                        <div className="font-medium">CSV</div>
                        <div className="text-xs text-muted-foreground">Excel, Google Sheets</div>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                        <div className="text-2xl mb-2">📄</div>
                        <div className="font-medium">JSON</div>
                        <div className="text-xs text-muted-foreground">API responses</div>
                      </div>
                      <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                        <div className="text-2xl mb-2">🗂️</div>
                        <div className="font-medium">Parquet</div>
                        <div className="text-xs text-muted-foreground">Big data format</div>
                      </div>
                      <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                        <div className="text-2xl mb-2">📈</div>
                        <div className="font-medium">Excel</div>
                        <div className="text-xs text-muted-foreground">XLSX, XLS</div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <DataUploader
                        onDataLoaded={handleDataLoaded}
                        dataEngine={dataEngine}
                      />
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                      <p>Supports files up to 5M rows • Real-time pivot tables • Advanced filtering</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Data loaded state - sidebar layout
          <div className="space-y-8">
            {/* Header with back button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Data Engine</h1>
                  <p className="text-sm text-muted-foreground">
                    {uploadedData?.fileName} • {uploadedData?.fileType} •{" "}
                    {((uploadedData?.fileSize || 0) / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadedData(null)}
              >
                Upload New File
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main content area - Data viewer with drag-drop */}
              <div className="lg:col-span-3 space-y-4">
                <ResultViewer
                  result={processingResult || { data: "loaded" }}
                  dataEngine={dataEngine}
                  showPagination={true}
                  initialView="table"
                  onReset={processingResult ? handleReset : null}
                  schema={uploadedData?.schema}
                  onResult={handleProcessingResult}
                />

                {/* Performance Tab */}
                <Tabs defaultValue="data" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="data">Data View</TabsTrigger>
                    <TabsTrigger value="performance" className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Performance
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="data" className="mt-4">
                    {/* Data info is now in MainDataViewer */}
                  </TabsContent>

                  <TabsContent value="performance" className="mt-4">
                    <PerformanceMonitor logs={performanceLogs} />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Sidebar - Processing controls */}
              <div className="lg:col-span-1 space-y-4">
                <ProcessingControls
                  dataEngine={dataEngine}
                  onResult={handleProcessingResult}
                  schema={uploadedData?.schema}
                  compact={true}
                />

                {/* Quick info card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Dataset Info</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    <div>
                      <strong>Fields:</strong>{" "}
                      {uploadedData?.schema
                        ? uploadedData.schema.split("Field").length - 1
                        : 0}
                    </div>
                    <div>
                      <strong>Size:</strong>{" "}
                      {((uploadedData?.fileSize || 0) / 1024).toFixed(1)} KB
                    </div>
                    <div>
                      <strong>Type:</strong> {uploadedData?.fileType || 'Unknown'}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedDataEnginePage;
