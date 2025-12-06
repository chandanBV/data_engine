import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Settings, Play, Filter, BarChart3, Table2Icon, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const ProcessingControls = ({ dataEngine, onResult, schema, compact = false }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pivot');

  // Pivot configuration
  const [pivotConfig, setPivotConfig] = useState({
    rowFields: [],
    columnFields: [],
    valueFields: [],
    aggregationType: 'sum'
  });

  // Aggregation configuration
  const [aggregateConfig, setAggregateConfig] = useState({
    groupByFields: [],
    aggregations: []
  });

  // Filter configuration
  const [filterConfig, setFilterConfig] = useState({
    filters: []
  });

  // Get available fields from schema
  const getAvailableFields = () => {
    if (!schema) {
      return [];
    }
    
    try {
      // Handle different schema formats
      let fields = [];
      
      if (typeof schema === 'string') {
        // Try JSON parsing first
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

  const handlePivot = async () => {
    if (!dataEngine) {
      toast.error('Data engine not initialized');
      return;
    }

    if (pivotConfig.rowFields.length === 0 && pivotConfig.columnFields.length === 0) {
      toast.error('Please select at least one row or column field');
      return;
    }

    setIsProcessing(true);
    try {
      // Reset to original data first to ensure correct schema
      try {
        await dataEngine.restore_original();
      } catch (resetError) {
        console.warn('Could not reset to original data:', resetError);
      }

      // Create pivot configuration
      const config = {
        row_fields: pivotConfig.rowFields,
        column_fields: pivotConfig.columnFields,
        value_fields: pivotConfig.valueFields,
        aggregation_type: pivotConfig.aggregationType
      };

      const startTime = performance.now();
      const result = await dataEngine.pivot(JSON.stringify(config));
      const endTime = performance.now();
      
      // Parse result to get row count
      let rowCount = 0;
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        rowCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {}

      const durationMs = endTime - startTime;
      const metrics = {
        type: 'pivot',
        rows: rowCount,
        time: Math.round(durationMs),
        throughput: rowCount > 0 ? (rowCount / (durationMs / 1000)) : 0,
        details: `Pivot: ${pivotConfig.rowFields.join(',')} x ${pivotConfig.columnFields.join(',')}`
      };

      onResult({
        type: 'pivot',
        data: result,
        config: config,
        metrics: metrics
      });
      
      toast.success('Pivot operation completed successfully!');
    } catch (error) {
      console.error('Pivot error:', error);
      toast.error(`Pivot operation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAggregate = async () => {
    if (!dataEngine) {
      toast.error('Data engine not initialized');
      return;
    }

    if (aggregateConfig.aggregations.length === 0) {
      toast.error('Please add at least one aggregation');
      return;
    }

    setIsProcessing(true);
    try {
      // Reset to original data first to ensure correct schema
      try {
        await dataEngine.restore_original();
      } catch (resetError) {
        console.warn('Could not reset to original data:', resetError);
      }

      const config = {
        group_by_fields: aggregateConfig.groupByFields,
        aggregations: aggregateConfig.aggregations
      };

      const startTime = performance.now();
      const result = await dataEngine.aggregate(JSON.stringify(config));
      const endTime = performance.now();
      
      // Parse result to get row count
      let rowCount = 0;
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        rowCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {}

      const durationMs = endTime - startTime;
      const metrics = {
        type: 'aggregate',
        rows: rowCount,
        time: Math.round(durationMs),
        throughput: rowCount > 0 ? (rowCount / (durationMs / 1000)) : 0,
        details: `Aggregate by ${aggregateConfig.groupByFields.join(', ')}`
      };

      onResult({
        type: 'aggregate',
        data: result,
        config: config,
        metrics: metrics
      });
      
      toast.success('Aggregation completed successfully!');
    } catch (error) {
      console.error('Aggregation error:', error);
      toast.error(`Aggregation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilter = async () => {
    if (!dataEngine) {
      toast.error('Data engine not initialized');
      return;
    }

    if (filterConfig.filters.length === 0) {
      toast.error('Please add at least one filter');
      return;
    }

    setIsProcessing(true);
    try {
      // Reset to original data first to ensure correct schema
      try {
        await dataEngine.restore_original();
      } catch (resetError) {
        console.warn('Could not reset to original data:', resetError);
      }

      const startTime = performance.now();
      const result = await dataEngine.filter(JSON.stringify(filterConfig));
      const endTime = performance.now();
      
      // Parse result to get row count
      let rowCount = 0;
      try {
        // For filter, we might need to get row count from engine if result is just a sample
        if (dataEngine.get_row_count) {
          rowCount = dataEngine.get_row_count();
        } else {
           const parsed = typeof result === 'string' ? JSON.parse(result) : result;
           rowCount = Array.isArray(parsed) ? parsed.length : 0;
        }
      } catch (e) {}

      const durationMs = endTime - startTime;
      const metrics = {
        type: 'filter',
        rows: rowCount,
        time: Math.round(durationMs),
        throughput: rowCount > 0 ? (rowCount / (durationMs / 1000)) : 0,
        details: `Filtered by ${filterConfig.filters.length} criteria`
      };

      onResult({
        type: 'filter',
        data: result,
        config: filterConfig,
        metrics: metrics
      });
      
      toast.success('Filter operation completed successfully!');
    } catch (error) {
      console.error('Filter error:', error);
      toast.error(`Filter operation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const addFieldToArray = (array, field, setter) => {
    if (field && !array.includes(field)) {
      setter(prev => ({
        ...prev,
        [array === pivotConfig.rowFields ? 'rowFields' : 
         array === pivotConfig.columnFields ? 'columnFields' : 'valueFields']: [...array, field]
      }));
    }
  };

  const removeFieldFromArray = (array, index, setter) => {
    setter(prev => ({
      ...prev,
      [array === pivotConfig.rowFields ? 'rowFields' : 
       array === pivotConfig.columnFields ? 'columnFields' : 'valueFields']: array.filter((_, i) => i !== index)
    }));
  };

  const addAggregation = () => {
    setAggregateConfig(prev => ({
      ...prev,
      aggregations: [...prev.aggregations, { field: '', operation: 'sum', alias: '' }]
    }));
  };

  const updateAggregation = (index, key, value) => {
    setAggregateConfig(prev => ({
      ...prev,
      aggregations: prev.aggregations.map((agg, i) => 
        i === index ? { ...agg, [key]: value } : agg
      )
    }));
  };

  const removeAggregation = (index) => {
    setAggregateConfig(prev => ({
      ...prev,
      aggregations: prev.aggregations.filter((_, i) => i !== index)
    }));
  };

  const addFilter = () => {
    setFilterConfig(prev => ({
      ...prev,
      filters: [...prev.filters, { field: '', filter_type: 'equals', value: '', min_value: '', max_value: '' }]
    }));
  };

  const updateFilter = (index, key, value) => {
    setFilterConfig(prev => ({
      ...prev,
      filters: prev.filters.map((filter, i) => 
        i === index ? { ...filter, [key]: value } : filter
      )
    }));
  };

  const removeFilter = (index) => {
    setFilterConfig(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index)
    }));
  };

  if (!schema) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Processing Controls
          </CardTitle>
          <CardDescription>Upload data first to enable processing operations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data loaded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? "pb-3" : ""}>
        <CardTitle className={`flex items-center gap-2 ${compact ? "text-sm" : ""}`}>
          <Settings className={`${compact ? "h-3 w-3" : "h-5 w-5"} text-primary`} />
          {compact ? "Controls" : "Processing Controls"}
        </CardTitle>
        {!compact && <CardDescription>Configure and execute data processing operations</CardDescription>}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pivot" className="flex items-center gap-1">
              <Table2Icon className="h-4 w-4" />
              Pivot
            </TabsTrigger>
            <TabsTrigger value="aggregate" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Aggregate
            </TabsTrigger>
            <TabsTrigger value="filter" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Filter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pivot" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label>Row Fields</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {pivotConfig.rowFields.map((field, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {field}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeFieldFromArray(pivotConfig.rowFields, index, setPivotConfig)}
                      />
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addFieldToArray(pivotConfig.rowFields, value, setPivotConfig)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add row field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(field => (
                      <SelectItem key={field} value={field}>{field}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Column Fields</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {pivotConfig.columnFields.map((field, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {field}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeFieldFromArray(pivotConfig.columnFields, index, setPivotConfig)}
                      />
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addFieldToArray(pivotConfig.columnFields, value, setPivotConfig)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add column field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(field => (
                      <SelectItem key={field} value={field}>{field}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Value Fields</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {pivotConfig.valueFields.map((field, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {field}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeFieldFromArray(pivotConfig.valueFields, index, setPivotConfig)}
                      />
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addFieldToArray(pivotConfig.valueFields, value, setPivotConfig)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add value field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(field => (
                      <SelectItem key={field} value={field}>{field}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Aggregation Type</Label>
                <Select value={pivotConfig.aggregationType} onValueChange={(value) => 
                  setPivotConfig(prev => ({ ...prev, aggregationType: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handlePivot} 
              disabled={isProcessing}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Execute Pivot'}
            </Button>
          </TabsContent>

          <TabsContent value="aggregate" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label>Group By Fields</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {aggregateConfig.groupByFields.map((field, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {field}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setAggregateConfig(prev => ({
                          ...prev,
                          groupByFields: prev.groupByFields.filter((_, i) => i !== index)
                        }))}
                      />
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => {
                  if (value && !aggregateConfig.groupByFields.includes(value)) {
                    setAggregateConfig(prev => ({
                      ...prev,
                      groupByFields: [...prev.groupByFields, value]
                    }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add group by field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(field => (
                      <SelectItem key={field} value={field}>{field}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Aggregations</Label>
                  <Button size="sm" variant="outline" onClick={addAggregation}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {aggregateConfig.aggregations.map((agg, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select 
                        value={agg.field} 
                        onValueChange={(value) => updateAggregation(index, 'field', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map(field => (
                            <SelectItem key={field} value={field}>{field}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Select 
                        value={agg.operation} 
                        onValueChange={(value) => updateAggregation(index, 'operation', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Operation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="avg">Average</SelectItem>
                          <SelectItem value="min">Minimum</SelectItem>
                          <SelectItem value="max">Maximum</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Input 
                        placeholder="Alias (optional)"
                        value={agg.alias}
                        onChange={(e) => updateAggregation(index, 'alias', e.target.value)}
                      />
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => removeAggregation(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleAggregate} 
              disabled={isProcessing}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Execute Aggregation'}
            </Button>
          </TabsContent>

          <TabsContent value="filter" className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Filters</Label>
                  <Button size="sm" variant="outline" onClick={addFilter}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {filterConfig.filters.map((filter, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Field</Label>
                        <Select 
                          value={filter.field} 
                          onValueChange={(value) => updateFilter(index, 'field', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFields.map(field => (
                              <SelectItem key={field} value={field}>{field}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Type</Label>
                        <Select 
                          value={filter.filter_type} 
                          onValueChange={(value) => updateFilter(index, 'filter_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="range">Range</SelectItem>
                            <SelectItem value="date_range">Date Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => removeFilter(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {(filter.filter_type === 'equals' || filter.filter_type === 'contains') && (
                      <div>
                        <Label className="text-xs">Value</Label>
                        <Input 
                          value={filter.value}
                          onChange={(e) => updateFilter(index, 'value', e.target.value)}
                          placeholder="Enter value"
                        />
                      </div>
                    )}
                    
                    {(filter.filter_type === 'range' || filter.filter_type === 'date_range') && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Min Value</Label>
                          <Input 
                            value={filter.min_value}
                            onChange={(e) => updateFilter(index, 'min_value', e.target.value)}
                            placeholder="Min"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Max Value</Label>
                          <Input 
                            value={filter.max_value}
                            onChange={(e) => updateFilter(index, 'max_value', e.target.value)}
                            placeholder="Max"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleFilter} 
              disabled={isProcessing}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Execute Filter'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ProcessingControls;
