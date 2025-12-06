/* tslint:disable */
/* eslint-disable */
export function init_panic_hook(): void;
export enum AggOp {
  Sum = 0,
  Min = 1,
  Max = 2,
  Count = 3,
  Avg = 4,
}
/**
 * WASM wrapper for DataEngine
 */
export class WasmDataEngine {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get schema information
   */
  get_schema(): any;
  /**
   * Load Excel data from bytes (loads first sheet by default)
   */
  load_excel(bytes: Uint8Array): any;
  /**
   * Export data as Arrow IPC buffer
   */
  export_arrow(): any;
  /**
   * Get data as Arrow IPC buffer
   */
  get_data_ipc(): any;
  /**
   * Load Parquet data from bytes
   */
  load_parquet(bytes: Uint8Array): any;
  /**
   * Get data as JSON (returns first 100 rows by default)
   */
  get_data_json(): any;
  /**
   * Get total row count
   */
  get_row_count(): number;
  /**
   * Get list of sheet names from Excel file
   */
  get_excel_sheets(bytes: Uint8Array): any;
  /**
   * Load specific sheet from Excel file
   */
  load_excel_sheet(bytes: Uint8Array, sheet_name: string): any;
  /**
   * Restore original data (for reset functionality)
   */
  restore_original(): any;
  /**
   * Get data as JSON within a specific window (start_row to end_row)
   */
  get_data_json_window(start_row: number, end_row: number): any;
  /**
   * Get data as JSON with pagination (offset and limit)
   */
  get_data_json_paginated(offset: number, limit: number): any;
  /**
   * Load CSV data with custom batch size for better performance
   * batch_size controls how many rows are processed at once (default: 8192)
   * Returns JSON with status and row count: {"status":"success","rows":12345}
   */
  load_csv_with_batch_size(bytes: Uint8Array, batch_size: number): any;
  /**
   * Create a new WasmDataEngine instance
   */
  constructor();
  /**
   * Perform pivot operation
   */
  pivot(config_json: string): any;
  /**
   * Perform filter operation
   */
  filter(config_json: string): any;
  /**
   * Load CSV data from bytes
   */
  load_csv(bytes: Uint8Array): any;
  /**
   * Perform aggregation operation
   */
  aggregate(config_json: string): any;
  /**
   * Load JSON data from string
   */
  load_json(json_string: string): any;
}
