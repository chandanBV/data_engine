import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Search,
  Database,
  Rows3,
  Columns3,
  Calculator,
  X,
  RotateCcw,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ResultViewer = ({
  result,
  dataEngine,
  showPagination = false,
  initialView = "table",
  onReset = null,
  schema = null, // Add schema for pivot functionality
  onResult = null, // Add onResult callback for pivot operations
}) => {
  const [tableData, setTableData] = useState(null);
  const [loadedRows, setLoadedRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [selectedDataTypes, setSelectedDataTypes] = useState({});
  const [totalRows, setTotalRows] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [hasMoreData, setHasMoreData] = useState(false);
  const DATA_WINDOW_SIZE = 10000;

  // Pivot functionality state
  const [draggedField, setDraggedField] = useState(null);
  const [pivotConfig, setPivotConfig] = useState({
    rowFields: [],
    columnFields: [],
    valueFields: [],
    aggregationType: 'sum'
  });
  const [isProcessingPivot, setIsProcessingPivot] = useState(false);
  const [isPivotMode, setIsPivotMode] = useState(false);

  // Reset window start when result changes
  useEffect(() => {
    setWindowStart(0);
  }, [result]);

  // Auto-fetch JSON data when result or window changes
  useEffect(() => {
    const fetchData = async () => {
      if (!dataEngine) return;
      if (!result) return; // No data to display

      setIsLoading(true);

      // PERFORMANCE: Start timing
      const perfStart = performance.now();
      console.log("🚀 PERFORMANCE: Starting data fetch...");

      try {
        let parsed;
        let count = 0;

        console.log("ResultViewer - Processing result:", result);

        // Get total row count first
        if (dataEngine.get_row_count) {
          count = dataEngine.get_row_count();
          setTotalRows(count);
          console.log("ResultViewer - Row count:", count);
        }

        // Check availability of windowed fetching
        const hasWindowSupport = typeof dataEngine.get_data_json_window === 'function';

        if (result.type && result.data) {
          // Processed result
          if (result.data instanceof Uint8Array) {
             // Arrow IPC - fetch from engine
             if (hasWindowSupport) {
                const jsonResult = await dataEngine.get_data_json_window(windowStart, windowStart + DATA_WINDOW_SIZE);
                parsed = JSON.parse(jsonResult);
             } else {
                // Fallback
                const limit = Math.min(count, DATA_WINDOW_SIZE);
                const jsonResult = await dataEngine.get_data_json_limit(limit);
                parsed = JSON.parse(jsonResult);
             }
          } else if (typeof result.data === "string") {
            parsed = JSON.parse(result.data);
          } else {
            parsed = result.data;
          }

          console.log(`ResultViewer - Updated totalRows to ${parsed.length} for ${result.type} operation`);
        } else if (result.data) {
          // Raw uploaded data
          if (count === 0 && !result.data) {
             toast.error("No data found");
             setIsLoading(false);
             return;
          }
          if (hasWindowSupport) {
            console.log(`ResultViewer - Fetching window ${windowStart} to ${windowStart + DATA_WINDOW_SIZE}`);
            const jsonResult = await dataEngine.get_data_json_window(windowStart, windowStart + DATA_WINDOW_SIZE);
            parsed = JSON.parse(jsonResult);
          } else {
             // Fallback
             const limit = Math.min(count, DATA_WINDOW_SIZE);
             const jsonResult = await dataEngine.get_data_json_limit(limit);
             parsed = JSON.parse(jsonResult);
          }
        }

        setTableData(parsed);
        setCurrentPage(1); // Reset to first page on new data window
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [result, dataEngine, windowStart]);

  // Detect column data types
  const columnTypes = useMemo(() => {
    if (!tableData || !Array.isArray(tableData) || tableData.length === 0)
      return {};

    const types = {};
    const firstRow = tableData[0];

    Object.keys(firstRow).forEach((column) => {
      const sampleValues = tableData
        .slice(0, 100)
        .map((row) => row[column])
        .filter((v) => v !== null && v !== undefined);

      if (sampleValues.length === 0) {
        types[column] = "null";
      } else if (sampleValues.every((v) => typeof v === "number")) {
        types[column] = Number.isInteger(sampleValues[0]) ? "integer" : "float";
      } else if (sampleValues.every((v) => typeof v === "boolean")) {
        types[column] = "boolean";
      } else if (sampleValues.every((v) => !isNaN(Date.parse(v)))) {
        types[column] = "date";
      } else {
        types[column] = "string";
      }
    });

    return types;
  }, [tableData]);

  // Filter data based on search and column filters
  const filteredData = useMemo(() => {
    if (!tableData || !Array.isArray(tableData)) return [];

    let filtered = tableData;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter((row) =>
          String(row[column]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    // Apply data type filters
    Object.entries(selectedDataTypes).forEach(([column, dataType]) => {
      if (dataType && dataType !== "all") {
        filtered = filtered.filter((row) => {
          const value = row[column];
          if (value === null || value === undefined) return dataType === "null";

          switch (dataType) {
            case "integer":
            case "float":
              return typeof value === "number";
            case "string":
              return typeof value === "string";
            case "boolean":
              return typeof value === "boolean";
            case "date":
              return !isNaN(Date.parse(value));
            default:
              return true;
          }
        });
      }
    });

    return filtered;
  }, [tableData, searchTerm, columnFilters, selectedDataTypes]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!showPagination) return filteredData;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize, showPagination]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleLoadMore = async () => {
    if (!dataEngine || !tableData || isLoading) return;

    setIsLoading(true);
    try {
      const currentCount = tableData.length;
      const nextBatchSize = Math.min(10000, totalRows - currentCount); // Load next 10K or remaining

      console.log(`Loading ${nextBatchSize} more rows (offset: ${currentCount})`);

      const jsonData = await dataEngine.get_data_json_paginated(currentCount, nextBatchSize);
      const newData = JSON.parse(jsonData);

      // Append new data to existing data
      const combinedData = [...tableData, ...newData];
      setTableData(combinedData);
      setLoadedRows(combinedData.length);
      setHasMoreData(combinedData.length < totalRows);

      toast.success(`Loaded ${newData.length} more rows (${combinedData.length}/${totalRows} total)`);
    } catch (error) {
      console.error("Error loading more data:", error);
      toast.error("Failed to load more data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const columns = Object.keys(tableData[0]);
      const csv = [
        columns.join(","),
        ...tableData.map((row) =>
          columns
            .map((col) => {
              const value = row[col];
              if (value === null || value === undefined) return "";
              const stringValue = String(value);
              return stringValue.includes(",")
                ? `"${stringValue}"`
                : stringValue;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV");
    }
  };

  const handleExportJSON = () => {
    if (!tableData || tableData.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      const json = JSON.stringify(tableData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("JSON exported successfully");
    } catch (error) {
      console.error("Error exporting JSON:", error);
      toast.error("Failed to export JSON");
    }
  };

  // Get available fields from schema for pivot
  const getAvailableFields = () => {
    if (!schema) return [];

    try {
      let fields = [];

      if (typeof schema === 'string') {
        try {
          const parsed = JSON.parse(schema);
          if (parsed.fields && Array.isArray(parsed.fields)) {
            fields = parsed.fields.map(field => field.name || field);
          } else if (Array.isArray(parsed)) {
            fields = parsed.map(field => field.name || field);
          }
        } catch (jsonError) {

          // Handle Arrow schema format: Field { "FieldName": nullable Type }
          const fieldMatches = schema.match(/Field\s*{\s*"([^"]+)"/g);
          if (fieldMatches) {
            fields = fieldMatches.map(match => {
              const nameMatch = match.match(/Field\s*{\s*"([^"]+)"/);
              return nameMatch ? nameMatch[1] : null;
            }).filter(Boolean);
          } else {
            // Fallback to line-by-line parsing
            const schemaLines = schema.split('\n').filter(line => line.includes(':'));
            fields = schemaLines.map(line => {
              const match = line.match(/(\w+):/);
              return match ? match[1] : null;
            }).filter(Boolean);
          }
        }
      } else if (typeof schema === 'object') {
        if (schema.fields && Array.isArray(schema.fields)) {
          fields = schema.fields.map(field => field.name || field);
        } else if (Array.isArray(schema)) {
          fields = schema.map(field => field.name || field);
        }
      }

      return fields;
    } catch (error) {
      console.error('Error parsing schema:', error);
      return [];
    }
  };

  const availableFields = getAvailableFields();

  // Get unused fields (not in any bucket)
  const getUnusedFields = () => {
    const usedFields = new Set([
      ...pivotConfig.rowFields,
      ...pivotConfig.columnFields,
      ...pivotConfig.valueFields
    ]);
    return availableFields.filter(field => !usedFields.has(field));
  };

  // Early exit if no schema - prevent null reference errors
  if (!schema) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Data Viewer
          </CardTitle>
          <CardDescription>Upload data first to enable pivot functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data loaded</p>
        </CardContent>
      </Card>
    );
  }

  // Drag and drop handlers
  const handleDragStart = (field) => {
    setDraggedField(field);
  };

  const handleDragEnd = () => {
    setDraggedField(null);
  };

  const handleDrop = (targetType, event) => {
    event.preventDefault();
    if (!draggedField) return;

    // Remove from current location
    const newConfig = { ...pivotConfig };
    ['rowFields', 'columnFields', 'valueFields'].forEach(type => {
      newConfig[type] = newConfig[type].filter(field => field !== draggedField);
    });

    // Add to target location
    if (targetType === 'rowFields') {
      newConfig.rowFields = [...newConfig.rowFields, draggedField];
    } else if (targetType === 'columnFields') {
      newConfig.columnFields = [...newConfig.columnFields, draggedField];
    } else if (targetType === 'valueFields') {
      newConfig.valueFields = [...newConfig.valueFields, draggedField];
    }

    setPivotConfig(newConfig);

    // Auto-execute pivot if we have configuration
    if (newConfig.rowFields.length > 0 || newConfig.columnFields.length > 0) {
      executePivot(newConfig);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  // Remove field from bucket
  const removeField = (fieldType, field) => {
    setPivotConfig(prev => ({
      ...prev,
      [fieldType]: prev[fieldType].filter(f => f !== field)
    }));

    // Update table if needed
    const newConfig = {
      ...pivotConfig,
      [fieldType]: pivotConfig[fieldType].filter(f => f !== field)
    };

    if (newConfig.rowFields.length > 0 || newConfig.columnFields.length > 0) {
      executePivot(newConfig);
    } else {
      setIsPivotMode(false);
    }
  };

  // Execute pivot operation
  const executePivot = async (config = pivotConfig) => {
    if (!dataEngine) {
      toast.error('Data engine not initialized');
      return;
    }

    if (config.rowFields.length === 0 && config.columnFields.length === 0) {
      setIsPivotMode(false);
      return;
    }

    // Require at least one value field for meaningful pivot
    if (config.valueFields.length === 0) {
      toast.error('Please add at least one field to the Values bucket to create a pivot table');
      return;
    }

    setIsProcessingPivot(true);
    try {
      // Reset to original data first
      try {
        await dataEngine.restore_original();
      } catch (resetError) {
        console.warn('Could not reset to original data:', resetError);
      }

      // Start performance timing
      const startTime = performance.now();

      // Create pivot configuration
      const pivotConfigJson = {
        row_fields: config.rowFields,
        column_fields: config.columnFields,
        value_fields: config.valueFields,
        aggregation_type: config.aggregationType
      };

      const result = await dataEngine.pivot(JSON.stringify(pivotConfigJson));

      // Parse result and update table
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTableData(parsed);
          setIsPivotMode(true);
          setCurrentPage(1); // Reset to first page

          // Calculate performance metrics
          const endTime = performance.now();
          const durationMs = endTime - startTime;
          
          // Calculate throughput safely
          let throughput = 0;
          if (parsed.length > 0 && durationMs > 0) {
            throughput = Math.round((parsed.length / (durationMs / 1000)) * 100) / 100;
          }

          // Send result up for processing controls
          if (onResult) {
            onResult({
              type: 'pivot',
              data: result,
              config: pivotConfigJson,
              metrics: {
                type: 'pivot',
                time: Math.round(durationMs),
                rows: parsed.length,
                throughput: throughput,
                rowsProcessed: parsed.length,
                details: `Pivot: ${config.rowFields.join(',')} x ${config.columnFields.join(',')}`
              }
            });
          }
        } else {
          setIsPivotMode(false);
        }
      } catch (e) {
        console.error('Error parsing pivot result:', e);
        setIsPivotMode(false);
      }

      // Always reset processing state after pivot operation completes
      setTimeout(() => setIsProcessingPivot(false), 0);
      
    } catch (error) {
      console.error('Pivot error:', error);
      const errorMessage = error.message || 'Pivot operation failed';
      
      // Don't automatically switch to raw mode on errors
      // Let the user decide what to do
      toast.error(errorMessage);
      
      // Only switch to raw mode for specific errors that indicate 
      // the pivot configuration is fundamentally invalid
      if (errorMessage.includes('No data available') || errorMessage.includes('Invalid pivot config')) {
        setIsPivotMode(false);
      }
      
      setTimeout(() => setIsProcessingPivot(false), 0);
    }
  };

  // Reset to raw data view
  const resetToRawData = async () => {
    if (!dataEngine) return;

    setIsPivotMode(false);
    setPivotConfig({
      rowFields: [],
      columnFields: [],
      valueFields: [],
      aggregationType: 'sum'
    });

    setIsLoading(true);
    try {
      // Always try to restore original data first
      try {
        await dataEngine.restore_original();
        console.log('Restored original data');
      } catch (resetError) {
        console.warn('Could not restore original data, trying to load current data:', resetError);
        // If restore fails, we'll try to load whatever is currently in the engine
      }

      // Get total row count
      let count = 0;
      if (dataEngine.get_row_count) {
        count = dataEngine.get_row_count();
        setTotalRows(count);
        console.log(`Total rows available: ${count}`);
      }

      if (count === 0) {
        // No data available at all
        setTableData([]);
        setCurrentPage(1);
        return;
      }

      // Load data with fallback
      const hasWindowSupport = typeof dataEngine.get_data_json_window === 'function';

      let jsonResult;
      if (hasWindowSupport) {
        console.log(`Loading window ${windowStart} to ${windowStart + DATA_WINDOW_SIZE}`);
        jsonResult = await dataEngine.get_data_json_window(windowStart, windowStart + DATA_WINDOW_SIZE);
      } else {
        const limit = Math.min(count, DATA_WINDOW_SIZE);
        console.log(`Loading limit ${limit}`);
        jsonResult = await dataEngine.get_data_json_limit(limit);
      }

      const parsed = JSON.parse(jsonResult);
      console.log(`Loaded ${parsed.length} rows of data`);
      
      setTableData(parsed);
      setCurrentPage(1);

      // Send result up for processing controls
      if (onResult) {
        onResult({
          type: 'raw',
          data: jsonResult,
          config: {},
          metrics: {
            type: 'raw',
            rows: parsed.length,
            details: 'Raw data loaded'
          }
        });
      }
    } catch (error) {
      console.error('Error resetting to raw data:', error);
      toast.error('Failed to reset to raw data');
      // As a last resort, clear the table to show no data state
      setTableData([]);
      setCurrentPage(1);
    } finally {
      setIsLoading(false);
    }
  };

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Data Viewer
          </CardTitle>
          <CardDescription>Upload a file to view data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data loaded</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Data Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="ml-3 text-muted-foreground">Loading data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Data Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  // Reorder columns to put row_key first if it exists
  const allColumns = Object.keys(tableData[0]);
  const columns = allColumns.includes("row_key")
    ? ["row_key", ...allColumns.filter((col) => col !== "row_key")]
    : allColumns;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {isPivotMode ? (
                "Pivot Table Results"
              ) : result && result.type ? (
                <>
                  {result.type === "pivot" && "Pivot Table Results"}
                  {result.type === "aggregate" && "Aggregation Results"}
                  {result.type === "filter" && "Filtered Data"}
                </>
              ) : (
                "Data Viewer"
              )}
            </CardTitle>
            <CardDescription className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  {filteredData.length.toLocaleString()}{" "}
                  {filteredData.length === 1 ? "row" : "rows"}
                  {filteredData.length !== tableData.length &&
                    ` (filtered from ${tableData.length.toLocaleString()})`}
                  {totalRows > tableData.length &&
                    ` • Showing rows ${(windowStart + 1).toLocaleString()}-${Math.min(windowStart + tableData.length, totalRows).toLocaleString()} of ${totalRows.toLocaleString()}`}
                  {" • "}
                  {columns.length} columns
                </span>
              </div>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onReset && (
              <Button variant="default" size="sm" onClick={onReset}>
                Reset to Original Data
              </Button>
            )}
            {hasMoreData && tableData && tableData.length < totalRows && !result.type && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Load More Data
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Performance Metrics - Compact Display */}
          {performanceMetrics && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100 text-sm">Performance</span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {performanceMetrics.timestamp ? new Date(performanceMetrics.timestamp).toLocaleTimeString() : 'Just now'}
                </div>
              </div>
              
              <div className="flex items-center gap-6 mt-2 text-sm">
                <div className="text-blue-900 dark:text-blue-100">
                  <span className="font-medium">{performanceMetrics.time}ms</span>
                  <span className="text-blue-600 dark:text-blue-400 ml-1">processing</span>
                </div>
                
                <div className="text-green-900 dark:text-green-100">
                  <span className="font-medium">{performanceMetrics.throughput}</span>
                  <span className="text-green-600 dark:text-green-400 ml-1">rows/sec</span>
                </div>
                
                <div className="text-purple-900 dark:text-purple-100">
                  <span className="font-medium">{performanceMetrics.rows?.toLocaleString()}</span>
                  <span className="text-purple-600 dark:text-purple-400 ml-1">rows</span>
                </div>
              </div>
              
              {totalRows > tableData.length && !result.type && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Showing {tableData.length.toLocaleString()} of {totalRows.toLocaleString()} total rows
                </div>
              )}
            </div>
          )}

          {/* Pivot Controls - Show when schema is available */}
          {schema && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant={!isPivotMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={async () => {
                      if (isPivotMode) {
                        await resetToRawData();
                      } else {
                        // If already in raw data mode but data might be stale, reload it
                        if (dataEngine && (!tableData || tableData.length === 0)) {
                          setIsLoading(true);
                          try {
                            const count = dataEngine.get_row_count();
                            setTotalRows(count);
                            
                            if (count > 0) {
                              const hasWindowSupport = typeof dataEngine.get_data_json_window === 'function';
                              if (hasWindowSupport) {
                                const jsonResult = await dataEngine.get_data_json_window(windowStart, windowStart + DATA_WINDOW_SIZE);
                                const parsed = JSON.parse(jsonResult);
                                setTableData(parsed);
                                setCurrentPage(1);
                              } else {
                                const limit = Math.min(count, DATA_WINDOW_SIZE);
                                const jsonResult = await dataEngine.get_data_json_limit(limit);
                                const parsed = JSON.parse(jsonResult);
                                setTableData(parsed);
                                setCurrentPage(1);
                              }
                            }
                          } catch (error) {
                            console.error('Error reloading raw data:', error);
                            toast.error('Failed to reload raw data');
                          } finally {
                            setIsLoading(false);
                          }
                        }
                      }
                    }}
                  >
                    <Table2 className="h-4 w-4 mr-2" />
                    Raw Data
                  </Button>
                  <Button
                    variant={isPivotMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={async () => {
                      setIsPivotMode(true);
                      // Ensure we have current data loaded when switching to pivot mode
                      if ((!tableData || tableData.length === 0) && dataEngine) {
                        setIsLoading(true);
                        try {
                          const count = dataEngine.get_row_count();
                          setTotalRows(count);
                          
                          if (count > 0) {
                            const hasWindowSupport = typeof dataEngine.get_data_json_window === 'function';
                            if (hasWindowSupport) {
                              const jsonResult = await dataEngine.get_data_json_window(windowStart, windowStart + DATA_WINDOW_SIZE);
                              const parsed = JSON.parse(jsonResult);
                              setTableData(parsed);
                              setCurrentPage(1);
                            } else {
                              const limit = Math.min(count, DATA_WINDOW_SIZE);
                              const jsonResult = await dataEngine.get_data_json_limit(limit);
                              const parsed = JSON.parse(jsonResult);
                              setTableData(parsed);
                              setCurrentPage(1);
                            }
                          }
                        } catch (error) {
                          console.error('Error loading data for pivot mode:', error);
                          toast.error('Failed to load data for pivot mode');
                        } finally {
                          setIsLoading(false);
                        }
                      }
                    }}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Pivot Mode
                  </Button>
                </div>

                {isPivotMode && isProcessingPivot && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Processing pivot...
                  </div>
                )}
              </div>

              {isPivotMode && (
                <div className="grid grid-cols-12 gap-4 p-4 border rounded-lg bg-muted/20">
                  {/* Left Panel - Field Hierarchy */}
                  <div className="col-span-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Database className="h-4 w-4" />
                        Available Fields ({getUnusedFields().length})
                      </div>
                      <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded p-2 bg-background">
                        {getUnusedFields().map(field => (
                          <div
                            key={field}
                            draggable
                            onDragStart={() => handleDragStart(field)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-move border border-transparent hover:border-border text-sm"
                          >
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                            <span className="truncate">{field}</span>
                          </div>
                        ))}
                        {getUnusedFields().length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            All fields are in use
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center Panel - Drop Buckets */}
                  <div className="col-span-6 space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      {/* Row Fields Bucket */}
                      <div
                        className="min-h-[60px] border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 hover:border-primary/50 transition-colors"
                        onDrop={(e) => handleDrop('rowFields', e)}
                        onDragOver={handleDragOver}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Rows3 className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Row Fields</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {pivotConfig.rowFields.map(field => (
                            <Badge
                              key={field}
                              variant="secondary"
                              className="flex items-center gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => removeField('rowFields', field)}
                            >
                              {field}
                              <X className="h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                        {pivotConfig.rowFields.length === 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Drop fields here to group rows
                          </div>
                        )}
                      </div>

                      {/* Column Fields Bucket */}
                      <div
                        className="min-h-[60px] border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 hover:border-primary/50 transition-colors"
                        onDrop={(e) => handleDrop('columnFields', e)}
                        onDragOver={handleDragOver}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Columns3 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Column Fields</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {pivotConfig.columnFields.map(field => (
                            <Badge
                              key={field}
                              variant="secondary"
                              className="flex items-center gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => removeField('columnFields', field)}
                            >
                              {field}
                              <X className="h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                        {pivotConfig.columnFields.length === 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Drop fields here to create columns (optional)
                          </div>
                        )}
                      </div>

                      {/* Value Fields Bucket */}
                      <div
                        className="min-h-[60px] border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 hover:border-primary/50 transition-colors"
                        onDrop={(e) => handleDrop('valueFields', e)}
                        onDragOver={handleDragOver}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Calculator className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Values</span>
                          <Select
                            value={pivotConfig.aggregationType}
                            onValueChange={(value) =>
                              setPivotConfig(prev => ({ ...prev, aggregationType: value }))
                            }
                          >
                            <SelectTrigger className="h-6 w-20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sum">Sum</SelectItem>
                              <SelectItem value="avg">Avg</SelectItem>
                              <SelectItem value="min">Min</SelectItem>
                              <SelectItem value="max">Max</SelectItem>
                              <SelectItem value="count">Count</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {pivotConfig.valueFields.map(field => (
                            <Badge
                              key={field}
                              variant="secondary"
                              className="flex items-center gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => removeField('valueFields', field)}
                            >
                              {field} ({pivotConfig.aggregationType})
                              <X className="h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                        {pivotConfig.valueFields.length === 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Drop numeric fields here to aggregate
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Panel - Info */}
                  <div className="col-span-3">
                    <div className="space-y-3">
                      <div className="text-sm">
                        <div className="font-medium mb-2">Configuration</div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>Row Fields: {pivotConfig.rowFields.length}</div>
                          <div>Column Fields: {pivotConfig.columnFields.length}</div>
                          <div>Value Fields: {pivotConfig.valueFields.length}</div>
                          <div>Mode: {isPivotMode ? 'Active' : 'Inactive'}</div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPivotConfig({
                            rowFields: [],
                            columnFields: [],
                            valueFields: [],
                            aggregationType: 'sum'
                          });
                          // Don't clear tableData - just clear the pivot config
                          // This keeps the pivot interface active but with empty fields
                          setCurrentPage(1);
                        }}
                        className="w-full"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search and filters */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            {showPagination && (
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Table or Empty State */}
          {!tableData || !Array.isArray(tableData) || tableData.length === 0 ? (
            // Special case: In pivot mode with cleared configuration
            isPivotMode && schema ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Pivot Table Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure your pivot table by dragging fields into the buckets above
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Calculator className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Ready to Create Pivot Table</h3>
                      <p className="text-muted-foreground max-w-md">
                        Drag fields from the left panel into the Row, Column, and Values buckets above to create your pivot table analysis.
                      </p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 px-3 py-1 rounded">
                        Row Fields → Group your data
                      </div>
                      <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/20 px-3 py-1 rounded">
                        Column Fields → Create columns
                      </div>
                      <div className="text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/20 px-3 py-1 rounded">
                        Values → Aggregate data
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-muted-foreground" />
                    Data Viewer
                  </CardTitle>
                  <CardDescription>Upload a file to view data</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No data available</p>
                </CardContent>
              </Card>
            )
          ) : isPivotMode && schema && pivotConfig.rowFields.length === 0 && pivotConfig.columnFields.length === 0 && pivotConfig.valueFields.length === 0 ? (
            // Pivot mode active but no configuration selected - show configuration screen
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Pivot Table Configuration
                </CardTitle>
                <CardDescription>
                  Configure your pivot table by dragging fields into the buckets above
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Calculator className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Ready to Create Pivot Table</h3>
                    <p className="text-muted-foreground max-w-md">
                      Drag fields from the left panel into the Row, Column, and Values buckets above to create your pivot table analysis.
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 px-3 py-1 rounded">
                      Row Fields → Group your data
                    </div>
                    <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/20 px-3 py-1 rounded">
                      Column Fields → Create columns
                    </div>
                    <div className="text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/20 px-3 py-1 rounded">
                      Values → Aggregate data
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Table with horizontal scroll - Excel-like design */}
              <div className="border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100 dark:bg-slate-800">
                        {/* Row number column header */}
                        <TableHead className="w-16 text-center font-bold bg-slate-200 dark:bg-slate-700 sticky left-0 z-20">
                          #
                        </TableHead>
                        {columns.map((column) => (
                          <TableHead
                            key={column}
                            className={cn(
                              "min-w-[150px]",
                              column === "row_key" &&
                                "bg-blue-100 dark:bg-blue-900 font-bold sticky left-16 z-20"
                            )}
                          >
                            <span className="font-semibold">{column}</span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((row, index) => {
                        const actualRowNumber = windowStart + (showPagination
                          ? (currentPage - 1) * pageSize + index + 1
                          : index + 1);
                        return (
                          <TableRow
                            key={index}
                            className="hover:bg-blue-50 dark:hover:bg-slate-800"
                          >
                            {/* Row number column */}
                            <TableCell className="w-16 text-center font-semibold text-slate-500 bg-slate-50 dark:bg-slate-900 sticky left-0 z-10 border-r-2 border-slate-300 dark:border-slate-600">
                              {actualRowNumber}
                            </TableCell>
                            {columns.map((column) => {
                              const value = row[column];
                              const type = columnTypes[column];

                              return (
                                <TableCell
                                  key={column}
                                  className={cn(
                                    "font-mono text-sm",
                                    column === "row_key" &&
                                      "bg-blue-50 dark:bg-blue-950 font-semibold sticky left-16 z-10 border-r-2 border-blue-300 dark:border-blue-700"
                                  )}
                                >
                                  {value !== null && value !== undefined ? (
                                    <span
                                      className={
                                        column === "row_key"
                                          ? "text-blue-700 dark:text-blue-300 font-bold"
                                          : type === "integer" || type === "float"
                                          ? "text-blue-600 dark:text-blue-400"
                                          : type === "boolean"
                                          ? "text-purple-600 dark:text-purple-400"
                                          : type === "date"
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-slate-700 dark:text-slate-300"
                                      }
                                    >
                                      {String(value)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 italic">
                                      null
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              {(showPagination || totalRows > DATA_WINDOW_SIZE) && (
                <div className="flex items-center justify-between py-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>Page {currentPage} of {Math.max(1, totalPages)}</span>
                    {totalRows > DATA_WINDOW_SIZE && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span>
                          Rows {(windowStart + 1).toLocaleString()}-{Math.min(windowStart + (paginatedData.length > 0 ? DATA_WINDOW_SIZE : 0), totalRows).toLocaleString()} of {totalRows.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    {/* Global Previous Controls */}
                    {totalRows > DATA_WINDOW_SIZE && (
                      <div className="flex gap-1 mr-2 border-r pr-2 border-slate-200 dark:border-slate-700">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWindowStart(0)}
                          disabled={windowStart === 0}
                          title="First 10k"
                          className="px-2"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWindowStart(Math.max(0, windowStart - DATA_WINDOW_SIZE))}
                          disabled={windowStart === 0}
                          title="Prev 10k"
                          className="gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          10k
                        </Button>
                      </div>
                    )}

                    {/* Local Page Controls */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    {/* Global Next Controls */}
                    {totalRows > DATA_WINDOW_SIZE && (
                      <div className="flex gap-1 ml-2 border-l pl-2 border-slate-200 dark:border-slate-700">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWindowStart(Math.min(totalRows, windowStart + DATA_WINDOW_SIZE))}
                          disabled={windowStart + DATA_WINDOW_SIZE >= totalRows}
                          title="Next 10k"
                          className="gap-1"
                        >
                          10k
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWindowStart(Math.floor((totalRows - 1) / DATA_WINDOW_SIZE) * DATA_WINDOW_SIZE)}
                          disabled={windowStart + DATA_WINDOW_SIZE >= totalRows}
                          title="Last 10k"
                          className="px-2"
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultViewer;
