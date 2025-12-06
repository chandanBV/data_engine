import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Zap, Clock, Activity, Database } from "lucide-react";

const PerformanceMonitor = ({ logs = [] }) => {
  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Performance Monitor
          </CardTitle>
          <CardDescription>
            Real-time performance metrics for data operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
            <Zap className="h-12 w-12 mb-3 opacity-20" />
            <p>No operations recorded yet</p>
            <p className="text-xs mt-1">
              Upload data or run operations to see metrics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate average throughput
  const avgThroughput =
    logs.length > 0
      ? logs.reduce((acc, log) => acc + (log.throughput || 0), 0) / logs.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Total Operations
              </p>
              <h3 className="text-2xl font-bold">{logs.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
              <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Avg Throughput
              </p>
              <h3 className="text-2xl font-bold">
                {avgThroughput > 1000000
                  ? `${(avgThroughput / 1000000).toFixed(1)}M`
                  : avgThroughput > 1000
                  ? `${(avgThroughput / 1000).toFixed(1)}K`
                  : Math.round(avgThroughput)}{" "}
                row/s
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-full">
              <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Latest Rows
              </p>
              <h3 className="text-2xl font-bold">
                {logs[0].rows?.toLocaleString() || 0}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Operation History
          </CardTitle>
          <CardDescription>
            Detailed performance log of recent operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Rows Processed</TableHead>
                <TableHead>Execution Time</TableHead>
                <TableHead>Throughput</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        log.type === "upload"
                          ? "border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-950"
                          : log.type === "pivot"
                          ? "border-purple-500 text-purple-500 bg-purple-50 dark:bg-purple-950"
                          : log.type === "aggregate"
                          ? "border-amber-500 text-amber-500 bg-amber-50 dark:bg-amber-950"
                          : log.type === "filter"
                          ? "border-green-500 text-green-500 bg-green-50 dark:bg-green-950"
                          : "border-slate-500"
                      }
                    >
                      {log.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium font-mono">
                    {log.rows?.toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-blue-600 dark:text-blue-400">
                    {log.time}ms
                  </TableCell>
                  <TableCell className="font-mono text-green-600 dark:text-green-400">
                    {log.throughput > 1000000
                      ? `${(log.throughput / 1000000).toFixed(2)}M`
                      : log.throughput > 1000
                      ? `${(log.throughput / 1000).toFixed(1)}k`
                      : Math.round(log.throughput)}{" "}
                    rows/s
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground w-[300px] truncate">
                    {log.details || "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceMonitor;
