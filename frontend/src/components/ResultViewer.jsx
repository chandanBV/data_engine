import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea } from './ui/scroll-area';
import { Download, Eye, Code, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

const ResultViewer = ({ result, dataEngine, showPagination = false, initialView = 'table' }) => {
  const [viewMode, setViewMode] = useState(initialView);
  const [jsonData, setJsonData] = useState(null);

  const processedData = useMemo(() => {
    if (!result) return null;
    
    // Handle different result structures
    const data = result.data || result;
    if (!data) return null;

    try {
      // If data is Arrow IPC buffer, we need to convert it
      if (data instanceof Uint8Array) {
        // For now, show raw buffer info
        return {
          type: 'binary',
          size: data.length,
          preview: Array.from(data.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')
        };
      }

      // If it's already JSON
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          return {
            type: 'json',
            data: parsed,
            size: data.length
          };
        } catch {
          return {
            type: 'text',
            data: data,
            size: data.length
          };
        }
      }

      return {
        type: 'object',
        data: data,
        size: JSON.stringify(data).length
      };
    } catch (error) {
      console.error('Error processing result data:', error);
      return null;
    }
  }, [result]);

  const handleGetJsonData = async () => {
    if (!dataEngine) {
      toast.error('Data engine not available');
      return;
    }

    try {
      const jsonResult = await dataEngine.get_data_json();
      const parsed = JSON.parse(jsonResult);
      setJsonData(parsed);
      toast.success('Data converted to JSON successfully');
    } catch (error) {
      console.error('Error getting JSON data:', error);
      toast.error('Failed to convert data to JSON');
    }
  };

  const handleExportArrow = async () => {
    if (!dataEngine) {
      toast.error('Data engine not available');
      return;
    }

    try {
      const arrowBuffer = await dataEngine.export_arrow();
      
      // Create blob and download
      const blob = new Blob([arrowBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data_export_${Date.now()}.arrow`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Arrow data exported successfully');
    } catch (error) {
      console.error('Error exporting Arrow data:', error);
      toast.error('Failed to export Arrow data');
    }
  };

  const renderTableView = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <p className="text-muted-foreground">No tabular data to display</p>;
    }

    const columns = Object.keys(data[0]);
    const maxRows = 100; // Limit for performance
    const displayData = data.slice(0, maxRows);

    return (
      <div className="space-y-4">
        {data.length > maxRows && (
          <Badge variant="outline">
            Showing {maxRows} of {data.length} rows
          </Badge>
        )}
        <ScrollArea className="h-96 w-full border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(column => (
                  <TableHead key={column} className="font-semibold">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, index) => (
                <TableRow key={index}>
                  {columns.map(column => (
                    <TableCell key={column} className="font-mono text-sm">
                      {row[column] !== null && row[column] !== undefined 
                        ? String(row[column]) 
                        : <span className="text-muted-foreground">null</span>
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    );
  };

  const renderJsonView = (data) => {
    return (
      <ScrollArea className="h-96 w-full">
        <pre className="text-xs font-mono p-4 bg-muted/50 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      </ScrollArea>
    );
  };

  const renderBinaryView = (data) => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Badge variant="outline">Binary Data</Badge>
          <Badge variant="secondary">{data.size} bytes</Badge>
        </div>
        <div className="p-4 bg-muted/50 rounded font-mono text-xs">
          <p className="mb-2 text-muted-foreground">First 20 bytes (hex):</p>
          <p>{data.preview}...</p>
        </div>
        <p className="text-sm text-muted-foreground">
          This is Arrow IPC binary data. Use the export function to download or convert to JSON to view the contents.
        </p>
      </div>
    );
  };

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Results
          </CardTitle>
          <CardDescription>Process data to see results here</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No results to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Processing Results
        </CardTitle>
        <CardDescription>
          {result.type ? `${result.type.charAt(0).toUpperCase() + result.type.slice(1)} operation results` : 'Data results'}
          {processedData && ` • ${processedData.size} ${processedData.type === 'binary' ? 'bytes' : 'characters'}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetJsonData}
              disabled={!dataEngine}
            >
              <Code className="h-4 w-4 mr-2" />
              Get JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportArrow}
              disabled={!dataEngine}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Arrow
            </Button>
          </div>

          {/* Configuration display */}
          {result.config && (
            <div className="p-3 bg-muted/50 rounded">
              <p className="text-sm font-medium mb-2">Configuration:</p>
              <pre className="text-xs font-mono">
                {JSON.stringify(result.config, null, 2)}
              </pre>
            </div>
          )}

          {/* Data display */}
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="json">JSON View</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="mt-4">
              {jsonData ? (
                renderTableView(jsonData)
              ) : processedData?.type === 'json' && Array.isArray(processedData.data) ? (
                renderTableView(processedData.data)
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Table view not available for this data type. 
                    {processedData?.type === 'binary' && ' Click "Get JSON" to convert the data first.'}
                  </p>
                  {processedData?.type === 'binary' && renderBinaryView(processedData)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="json" className="mt-4">
              {jsonData ? (
                renderJsonView(jsonData)
              ) : processedData?.type === 'json' ? (
                renderJsonView(processedData.data)
              ) : processedData?.type === 'object' ? (
                renderJsonView(processedData.data)
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    JSON view not available for this data type.
                    {processedData?.type === 'binary' && ' Click "Get JSON" to convert the data first.'}
                  </p>
                  {processedData?.type === 'binary' && renderBinaryView(processedData)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="raw" className="mt-4">
              {processedData?.type === 'binary' ? (
                renderBinaryView(processedData)
              ) : processedData?.type === 'text' ? (
                <ScrollArea className="h-96 w-full">
                  <pre className="text-xs font-mono p-4 bg-muted/50 rounded">
                    {processedData.data}
                  </pre>
                </ScrollArea>
              ) : (
                renderJsonView(processedData?.data || result.data)
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultViewer;
