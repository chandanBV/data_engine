import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Upload, FileText, Database, Sheet } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const DataUploader = ({ onDataLoaded, dataEngine }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [showSheetDialog, setShowSheetDialog] = useState(false);
  const [pendingExcelFile, setPendingExcelFile] = useState(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleLoadSelectedSheet = async () => {
    console.log("=== handleLoadSelectedSheet called ===");
    console.log("pendingExcelFile:", pendingExcelFile);
    console.log("selectedSheet:", selectedSheet);
    console.log("dataEngine:", dataEngine);
    console.log(
      "dataEngine.load_excel_sheet:",
      typeof dataEngine?.load_excel_sheet
    );

    if (!pendingExcelFile || !selectedSheet) {
      console.error("Missing required data");
      return;
    }

    setShowSheetDialog(false);
    setIsUploading(true);
    setUploadedFile(pendingExcelFile.file);

    try {
      console.log("Loading selected sheet:", selectedSheet);
      console.log("Bytes length:", pendingExcelFile.uint8Array.length);
      console.log("Bytes type:", pendingExcelFile.uint8Array.constructor.name);

      const result = await dataEngine.load_excel_sheet(
        pendingExcelFile.uint8Array,
        selectedSheet
      );
      console.log("Excel load result:", result);

      toast.success(
        `Excel sheet "${selectedSheet}" from "${pendingExcelFile.file.name}" loaded successfully!`
      );

      // Get schema information
      const schema = await dataEngine.get_schema();
      console.log("Schema information:", schema);

      onDataLoaded({
        fileName: pendingExcelFile.file.name,
        fileSize: pendingExcelFile.file.size,
        fileType: "XLSX",
        sheetName: selectedSheet,
        schema: schema,
        result: result,
      });
    } catch (error) {
      console.error("=== Sheet Load Error ===");
      console.error("Error:", error);

      let errorMessage = "Unknown error";
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error) {
        errorMessage = String(error);
      }

      toast.error(`Failed to load sheet: ${errorMessage}`);
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
      setPendingExcelFile(null);
      setExcelSheets([]);
    }
  };

  const handleFileUpload = async (file) => {
    console.log("=== File Upload Started ===");
    console.log("File name:", file.name);
    console.log("File size:", file.size, "bytes");
    console.log("File type:", file.type);

    if (!dataEngine) {
      console.error("Data engine not initialized");
      toast.error("Data engine not initialized");
      return;
    }

    console.log("Data engine instance:", dataEngine);
    console.log("Available methods:", Object.keys(dataEngine));
    console.log("Has load_csv:", typeof dataEngine.load_csv);
    console.log("Has load_csv_with_batch_size:", typeof dataEngine.load_csv_with_batch_size);

    setIsUploading(true);
    setUploadedFile(file);

    try {
      const fileExtension = file.name.split(".").pop().toLowerCase();
      console.log("File extension:", fileExtension);
      let result;

      if (fileExtension === "csv") {
        const t0 = performance.now();
        console.log("⏱️ Starting CSV upload...");
        
        console.log("Processing CSV file...");
        const t1 = performance.now();
        const arrayBuffer = await file.arrayBuffer();
        const t2 = performance.now();
        console.log(`⏱️ File read took: ${((t2-t1)/1000).toFixed(2)}s`);
        
        const uint8Array = new Uint8Array(arrayBuffer);
        const fileSizeMB = uint8Array.length / (1024 * 1024);
        console.log("CSV data prepared, size:", fileSizeMB.toFixed(2), "MB");
        
        // Use maximum batch size for fastest processing (5M rows in ~15-20 seconds)
        if (fileSizeMB > 5 && dataEngine.load_csv_with_batch_size) {
          const batchSize = 262144; // 256K rows - maximum speed
          console.log(`⚡ Ultra-fast mode (${(batchSize/1024).toFixed(0)}K batch)`);
          
          const t3 = performance.now();
          result = await dataEngine.load_csv_with_batch_size(uint8Array, batchSize);
          const t4 = performance.now();
          console.log(`⏱️ WASM parsing took: ${((t4-t3)/1000).toFixed(2)}s`);
          
          // Parse result for row count
          try {
            const resultData = JSON.parse(result);
            if (resultData.rows) {
              const rowCount = resultData.rows.toLocaleString();
              const totalTime = ((t4-t0)/1000).toFixed(2);
              console.log(`⏱️ TOTAL TIME: ${totalTime}s`);
              toast.success(`⚡ Loaded ${rowCount} rows in ${totalTime}s`);
            } else {
              toast.success(`CSV file "${file.name}" loaded successfully!`);
            }
          } catch (e) {
            toast.success(`CSV file "${file.name}" loaded successfully!`);
          }
        } else {
          // Standard method for smaller files
          console.log("Standard processing (file <= 5MB or batch method unavailable)");
          const t3 = performance.now();
          result = await dataEngine.load_csv(uint8Array);
          const t4 = performance.now();
          console.log(`⏱️ Standard parsing took: ${((t4-t3)/1000).toFixed(2)}s`);
          toast.success(`CSV file "${file.name}" loaded successfully!`);
        }
      } else if (fileExtension === "json") {
        console.log("Processing JSON file...");
        const text = await file.text();
        console.log("JSON text length:", text.length);
        console.log("JSON preview:", text.substring(0, 200));
        console.log(
          "Checking if load_json exists:",
          typeof dataEngine.load_json
        );
        console.log("Calling dataEngine.load_json...");
        result = await dataEngine.load_json(text);
        console.log("JSON load result:", result);

        toast.success(`JSON file "${file.name}" loaded successfully!`);
      } else if (fileExtension === "parquet") {
        console.log("Processing Parquet file...");
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log("Parquet data prepared, size:", uint8Array.length);
        console.log(
          "Checking if load_parquet exists:",
          typeof dataEngine.load_parquet
        );
        console.log("Calling dataEngine.load_parquet...");
        result = await dataEngine.load_parquet(uint8Array);
        console.log("Parquet load result:", result);

        toast.success(`Parquet file "${file.name}" loaded successfully!`);
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        console.log("Processing Excel file...");
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log("Excel data prepared, size:", uint8Array.length);

        // Get list of sheets
        console.log("Getting Excel sheet names...");
        const sheetsJson = await dataEngine.get_excel_sheets(uint8Array);
        const sheets = JSON.parse(sheetsJson);
        console.log("Available sheets:", sheets);

        if (sheets.length === 0) {
          throw new Error("Excel file has no sheets");
        }

        // If multiple sheets, show selection dialog
        if (sheets.length > 1) {
          setPendingExcelFile({ file, uint8Array, sheets });
          setExcelSheets(sheets);
          setSelectedSheet(sheets[0]);
          setShowSheetDialog(true);
          setIsUploading(false);
          return; // Wait for user to select sheet
        }

        // If only one sheet, load it directly
        console.log("Loading single sheet:", sheets[0]);
        result = await dataEngine.load_excel_sheet(uint8Array, sheets[0]);
        console.log("Excel load result:", result);

        toast.success(
          `Excel file "${file.name}" (${sheets[0]}) loaded successfully!`
        );
      } else {
        throw new Error(
          "Unsupported file format. Please upload CSV, JSON, Parquet, or Excel files."
        );
      }

      // Get schema information
      const schema = await dataEngine.get_schema();
      console.log("Schema information:", schema);

      onDataLoaded({
        fileName: file.name,
        fileSize: file.size,
        fileType: fileExtension.toUpperCase(),
        schema: schema,
        result: result,
      });
    } catch (error) {
      console.error("=== File Upload Error ===");
      console.error("Error object:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error?.message);
      console.error("Error string:", String(error));
      console.error("Error stack:", error?.stack);

      // Handle different error types
      let errorMessage = "Unknown error";
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error) {
        errorMessage = String(error);
      }

      console.error("Final error message:", errorMessage);
      toast.error(`Failed to load file: ${errorMessage}`);
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Data Upload
        </CardTitle>
        <CardDescription>
          Upload CSV, JSON, Parquet, or Excel files to load data into the engine
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <div className="space-y-2">
              <Database className="h-8 w-8 mx-auto text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">
                Processing file...
              </p>
            </div>
          ) : uploadedFile ? (
            <div className="space-y-2">
              <FileText className="h-8 w-8 mx-auto text-green-600" />
              <p className="font-medium">{uploadedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">
                  Drop files here or click to upload
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports CSV, JSON, Parquet, and Excel (.xlsx, .xls) files
                </p>
              </div>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  Choose Files
                  <input
                    type="file"
                    accept=".csv,.json,.parquet,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </Button>
            </div>
          )}
        </div>

        {uploadedFile && !isUploading && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUploadedFile(null);
                onDataLoaded(null);
              }}
            >
              Clear
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                Upload Another
                <input
                  type="file"
                  accept=".csv,.json,.parquet,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        )}
      </CardContent>

      {/* Excel Sheet Selection Dialog */}
      <Dialog open={showSheetDialog} onOpenChange={setShowSheetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sheet className="h-5 w-5 text-primary" />
              Select Excel Sheet
            </DialogTitle>
            <DialogDescription>
              This Excel file contains multiple sheets. Please select which
              sheet to load.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Available Sheets</label>
              <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a sheet" />
                </SelectTrigger>
                <SelectContent>
                  {excelSheets.map((sheet) => (
                    <SelectItem key={sheet} value={sheet}>
                      {sheet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pendingExcelFile && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>File:</strong> {pendingExcelFile.file.name}
                </p>
                <p>
                  <strong>Size:</strong>{" "}
                  {(pendingExcelFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <p>
                  <strong>Sheets:</strong> {excelSheets.length}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSheetDialog(false);
                setPendingExcelFile(null);
                setExcelSheets([]);
                setSelectedSheet("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleLoadSelectedSheet} disabled={!selectedSheet}>
              Load Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DataUploader;
