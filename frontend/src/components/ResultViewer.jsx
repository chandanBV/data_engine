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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ResultViewer = ({
  result,
  dataEngine,
  showPagination = false,
  initialView = "table",
  onReset = null,
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
              {result && result.type ? (
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
                  <span className="font-medium">{performanceMetrics.totalTime}ms</span>
                  <span className="text-blue-600 dark:text-blue-400 ml-1">processing</span>
                </div>
                
                <div className="text-green-900 dark:text-green-100">
                  <span className="font-medium">{performanceMetrics.throughput}</span>
                  <span className="text-green-600 dark:text-green-400 ml-1">rows/sec</span>
                </div>
                
                <div className="text-purple-900 dark:text-purple-100">
                  <span className="font-medium">{performanceMetrics.rowsProcessed.toLocaleString()}</span>
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
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultViewer;
