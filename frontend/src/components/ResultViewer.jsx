import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Download, Eye, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';

const ResultViewer = ({ result, dataEngine, showPagination = false, initialView = 'table', onReset = null }) => {
  const [tableData, setTableData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [selectedDataTypes, setSelectedDataTypes] = useState({});
  const [totalRows, setTotalRows] = useState(0);

  // Auto-fetch JSON data when result changes
  useEffect(() => {
    const fetchData = async () => {
      if (!dataEngine) return;
      if (!result) return; // No data to display
      
      setIsLoading(true);
      try {
        let parsed;
        
        console.log('ResultViewer - Processing result:', result);
        
        // Check if this is a processing result (pivot/aggregate/filter)
        if (result.type && result.data) {
          console.log('ResultViewer - Processing result type:', result.type);
          
          // Check if data is Arrow IPC buffer (Uint8Array)
          if (result.data instanceof Uint8Array) {
            console.log('ResultViewer - Data is Arrow IPC buffer, need to convert to JSON');
            // For now, we need to get JSON from the engine after the operation
            // The operations should have updated the engine's data
            const count = await dataEngine.get_row_count();
            setTotalRows(count);
            const limit = Math.min(count, 10000);
            const jsonResult = await dataEngine.get_data_json_limit(limit);
            parsed = JSON.parse(jsonResult);
            console.log('ResultViewer - Converted Arrow to JSON:', parsed);
          } else if (typeof result.data === 'string') {
            // Data is already JSON string
            parsed = JSON.parse(result.data);
            console.log('ResultViewer - Parsed JSON string:', parsed);
          } else {
            // Data is already a JavaScript object
            parsed = result.data;
            console.log('ResultViewer - Using data object directly:', parsed);
          }
        } else if (result.data) {
          // This is raw uploaded data with { data: ... } structure
          console.log('ResultViewer - Raw uploaded data');
          const count = await dataEngine.get_row_count();
          setTotalRows(count);
          
          // Load max 10,000 rows to prevent browser crash
          const limit = Math.min(count, 10000);
          const jsonResult = await dataEngine.get_data_json_limit(limit);
          parsed = JSON.parse(jsonResult);
          
          if (count > 10000) {
            toast.info(`Loaded first ${limit.toLocaleString()} of ${count.toLocaleString()} rows for performance`);
          }
        } else {
          console.error('ResultViewer - Invalid result structure:', result);
          return;
        }
        
        setTableData(parsed);
        setCurrentPage(1); // Reset to first page on new data
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [result, dataEngine]);

  // Detect column data types
  const columnTypes = useMemo(() => {
    if (!tableData || !Array.isArray(tableData) || tableData.length === 0) return {};
    
    const types = {};
    const firstRow = tableData[0];
    
    Object.keys(firstRow).forEach(column => {
      const sampleValues = tableData.slice(0, 100).map(row => row[column]).filter(v => v !== null && v !== undefined);
      
      if (sampleValues.length === 0) {
        types[column] = 'null';
      } else if (sampleValues.every(v => typeof v === 'number')) {
        types[column] = Number.isInteger(sampleValues[0]) ? 'integer' : 'float';
      } else if (sampleValues.every(v => typeof v === 'boolean')) {
        types[column] = 'boolean';
      } else if (sampleValues.every(v => !isNaN(Date.parse(v)))) {
        types[column] = 'date';
      } else {
        types[column] = 'string';
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
      filtered = filtered.filter(row => 
        Object.values(row).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    // Apply column filters
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(row => 
          String(row[column]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });
    
    // Apply data type filters
    Object.entries(selectedDataTypes).forEach(([column, dataType]) => {
      if (dataType && dataType !== 'all') {
        filtered = filtered.filter(row => {
          const value = row[column];
          if (value === null || value === undefined) return dataType === 'null';
          
          switch (dataType) {
            case 'integer':
            case 'float':
              return typeof value === 'number';
            case 'string':
              return typeof value === 'string';
            case 'boolean':
              return typeof value === 'boolean';
            case 'date':
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

  const handleExportCSV = () => {
    if (!tableData || tableData.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const columns = Object.keys(tableData[0]);
      const csv = [
        columns.join(','),
        ...tableData.map(row => 
          columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  const handleExportJSON = () => {
    if (!tableData || tableData.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const json = JSON.stringify(tableData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('JSON exported successfully');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      toast.error('Failed to export JSON');
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

  const columns = Object.keys(tableData[0]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {result && result.type ? (
                <>
                  {result.type === 'pivot' && 'Pivot Table Results'}
                  {result.type === 'aggregate' && 'Aggregation Results'}
                  {result.type === 'filter' && 'Filtered Data'}
                </>
              ) : (
                'Data Viewer'
              )}
            </CardTitle>
            <CardDescription>
              {filteredData.length.toLocaleString()} {filteredData.length === 1 ? 'row' : 'rows'}
              {filteredData.length !== tableData.length && ` (filtered from ${tableData.length.toLocaleString()})`}
              {totalRows > tableData.length && ` • Showing first ${tableData.length.toLocaleString()} of ${totalRows.toLocaleString()} total`}
              {' • '}{columns.length} columns
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onReset && (
              <Button
                variant="default"
                size="sm"
                onClick={onReset}
              >
                Reset to Original Data
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
            >
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
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

          {/* Table with horizontal scroll */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map(column => (
                      <TableHead key={column} className="min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{column}</span>
                          <Badge variant="secondary" className="text-xs">
                            {columnTypes[column]}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((row, index) => (
                    <TableRow key={index}>
                      {columns.map(column => {
                        const value = row[column];
                        const type = columnTypes[column];
                        
                        return (
                          <TableCell key={column} className="font-mono text-sm">
                            {value !== null && value !== undefined ? (
                              <span className={
                                type === 'integer' || type === 'float' ? 'text-blue-600' :
                                type === 'boolean' ? 'text-purple-600' :
                                type === 'date' ? 'text-green-600' :
                                ''
                              }>
                                {String(value)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">null</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          {showPagination && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultViewer;
