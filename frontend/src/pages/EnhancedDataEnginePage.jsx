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

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              WebAssembly Data Engine
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            High-performance data processing with Rust, Apache Arrow, and
            WebAssembly
          </p>

          <Alert className="max-w-4xl mx-auto">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription>
              <strong>Fully Functional:</strong> Upload CSV, JSON, Parquet, or
              Excel files (1M-5M rows supported), perform pivot operations,
              aggregations, and filtering with blazing-fast performance powered
              by Rust and Apache Arrow.
            </AlertDescription>
          </Alert>
        </div>

        {!uploadedData ? (
          // Upload state - centered upload area
          <div className="flex items-center justify-center min-h-[400px]">
            <DataUploader
              onDataLoaded={handleDataLoaded}
              dataEngine={dataEngine}
            />
          </div>
        ) : (
          // Data loaded state - sidebar layout
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main content area - Data table */}
            <div className="lg:col-span-3 space-y-4">
              <Tabs defaultValue="data" className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="data" className="flex items-center gap-2">
                      <TableIcon className="h-4 w-4" />
                      Data View
                    </TabsTrigger>
                    <TabsTrigger value="performance" className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Performance
                    </TabsTrigger>
                  </TabsList>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedData(null)}
                  >
                    Upload New File
                  </Button>
                </div>

                <TabsContent value="data" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Data View</h2>
                      <p className="text-sm text-muted-foreground">
                        {uploadedData.fileName} • {uploadedData.fileType} •{" "}
                        {(uploadedData.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <ResultViewer
                    result={processingResult || { data: "loaded" }}
                    dataEngine={dataEngine}
                    showPagination={true}
                    initialView="table"
                    onReset={processingResult ? handleReset : null}
                  />
                </TabsContent>

                <TabsContent value="performance" className="mt-0">
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
                    {uploadedData.schema
                      ? uploadedData.schema.split("Field").length - 1
                      : 0}
                  </div>
                  <div>
                    <strong>Size:</strong>{" "}
                    {(uploadedData.fileSize / 1024).toFixed(1)} KB
                  </div>
                  <div>
                    <strong>Type:</strong> {uploadedData.fileType}
                  </div>
                </CardContent>
              </Card>

              {/* Engine Status */}
              {/* <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-3 w-3 text-primary" />
                    Engine Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>WASM Ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Arrow Support</span>
                  </div>
                </CardContent>
              </Card> */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedDataEnginePage;
