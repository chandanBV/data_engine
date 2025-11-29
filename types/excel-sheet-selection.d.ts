/**
 * TypeScript type definitions for Excel Sheet Selection feature
 * WASM Data Engine - Excel Sheet Selection API
 */

/**
 * Main WASM Data Engine class
 */
export class WasmDataEngine {
  /**
   * Create a new WasmDataEngine instance
   */
  constructor();

  /**
   * Get list of sheet names from an Excel file
   * @param bytes - Excel file as Uint8Array
   * @returns JSON string array of sheet names, e.g., '["Sheet1", "Sales"]'
   * @throws Error if file cannot be parsed
   * @example
   * ```typescript
   * const sheetsJson = engine.get_excel_sheets(excelBytes);
   * const sheets: string[] = JSON.parse(sheetsJson);
   * console.log(sheets); // ["Sheet1", "Sales", "Inventory"]
   * ```
   */
  get_excel_sheets(bytes: Uint8Array): string;

  /**
   * Load Excel file (loads first sheet by default)
   * @param bytes - Excel file as Uint8Array
   * @returns Success message
   * @throws Error if file cannot be parsed or is empty
   * @example
   * ```typescript
   * const result = engine.load_excel(excelBytes);
   * console.log(result); // "Excel upload successful"
   * ```
   */
  load_excel(bytes: Uint8Array): string;

  /**
   * Load a specific sheet from an Excel file
   * @param bytes - Excel file as Uint8Array
   * @param sheetName - Name of the sheet to load (case-sensitive)
   * @returns Success message with sheet name
   * @throws Error if sheet not found or file cannot be parsed
   * @example
   * ```typescript
   * const result = engine.load_excel_sheet(excelBytes, "Sales");
   * console.log(result); // "Excel sheet 'Sales' uploaded successfully"
   * ```
   */
  load_excel_sheet(bytes: Uint8Array, sheetName: string): string;

  /**
   * Load CSV data from bytes
   * @param bytes - CSV file as Uint8Array
   * @returns Success message
   */
  load_csv(bytes: Uint8Array): string;

  /**
   * Load JSON data from string
   * @param jsonString - JSON string
   * @returns Success message
   */
  load_json(jsonString: string): string;

  /**
   * Load Parquet data from bytes
   * @param bytes - Parquet file as Uint8Array
   * @returns Success message
   */
  load_parquet(bytes: Uint8Array): string;

  /**
   * Get schema information
   * @returns Schema as string
   */
  get_schema(): string;

  /**
   * Get data as JSON (first 100 rows by default)
   * @returns JSON string of data
   */
  get_data_json(): string;

  /**
   * Get data as JSON with custom row limit
   * @param limit - Number of rows to return
   * @returns JSON string of data
   */
  get_data_json_limit(limit: number): string;

  /**
   * Get total row count
   * @returns Number of rows in the dataset
   */
  get_row_count(): number;

  /**
   * Perform pivot operation
   * @param configJson - Pivot configuration as JSON string
   * @returns Arrow IPC buffer
   */
  pivot(configJson: string): Uint8Array;

  /**
   * Perform aggregation operation
   * @param configJson - Aggregation configuration as JSON string
   * @returns Arrow IPC buffer
   */
  aggregate(configJson: string): Uint8Array;

  /**
   * Perform filter operation
   * @param configJson - Filter configuration as JSON string
   * @returns Arrow IPC buffer
   */
  filter(configJson: string): Uint8Array;

  /**
   * Export data as Arrow IPC buffer
   * @returns Arrow IPC buffer
   */
  export_arrow(): Uint8Array;

  /**
   * Restore original data (for reset functionality)
   * @returns Success message
   */
  restore_original(): string;
}

/**
 * Helper type for parsed data rows
 */
export type DataRow = Record<string, string | number | boolean | null>;

/**
 * Helper type for Excel sheet list
 */
export type SheetList = string[];

/**
 * Excel upload result
 */
export interface ExcelUploadResult {
  success: boolean;
  message: string;
  sheets?: SheetList;
  error?: string;
}

/**
 * Helper function to safely parse sheet names
 * @param sheetsJson - JSON string from get_excel_sheets
 * @returns Array of sheet names
 */
export function parseSheetNames(sheetsJson: string): SheetList;

/**
 * Helper function to safely parse data
 * @param dataJson - JSON string from get_data_json
 * @returns Array of data rows
 */
export function parseData(dataJson: string): DataRow[];

/**
 * Example usage with error handling
 * @example
 * ```typescript
 * async function loadExcelSheet(
 *   engine: WasmDataEngine,
 *   file: File,
 *   sheetName?: string
 * ): Promise<ExcelUploadResult> {
 *   try {
 *     const arrayBuffer = await file.arrayBuffer();
 *     const bytes = new Uint8Array(arrayBuffer);
 *
 *     // Get available sheets
 *     const sheetsJson = engine.get_excel_sheets(bytes);
 *     const sheets = JSON.parse(sheetsJson) as SheetList;
 *
 *     // Load sheet (use provided name or first sheet)
 *     const targetSheet = sheetName || sheets[0];
 *     const message = engine.load_excel_sheet(bytes, targetSheet);
 *
 *     return {
 *       success: true,
 *       message,
 *       sheets
 *     };
 *   } catch (error) {
 *     return {
 *       success: false,
 *       message: 'Failed to load Excel file',
 *       error: String(error)
 *     };
 *   }
 * }
 * ```
 */
export function loadExcelSheet(
  engine: WasmDataEngine,
  file: File,
  sheetName?: string
): Promise<ExcelUploadResult>;

/**
 * React hook for Excel sheet management
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { sheets, selectedSheet, data, loadFile, selectSheet } = useExcelSheet(engine);
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={e => loadFile(e.target.files[0])} />
 *       <select value={selectedSheet} onChange={e => selectSheet(e.target.value)}>
 *         {sheets.map(s => <option key={s}>{s}</option>)}
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export interface UseExcelSheetReturn {
  sheets: SheetList;
  selectedSheet: string;
  data: DataRow[];
  loading: boolean;
  error: string | null;
  loadFile: (file: File) => Promise<void>;
  selectSheet: (sheetName: string) => void;
  reload: () => void;
}

export function useExcelSheet(engine: WasmDataEngine): UseExcelSheetReturn;
