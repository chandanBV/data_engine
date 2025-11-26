import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Upload, FileText, Database } from 'lucide-react';
import { toast } from 'sonner';

const DataUploader = ({ onDataLoaded, dataEngine }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

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

  const handleFileUpload = async (file) => {
    if (!dataEngine) {
      toast.error('Data engine not initialized');
      return;
    }

    setIsUploading(true);
    setUploadedFile(file);

    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let result;

      if (fileExtension === 'csv') {
        // Load CSV file
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        result = await dataEngine.load_csv(uint8Array);
        
        toast.success(`CSV file "${file.name}" loaded successfully!`);
      } else if (fileExtension === 'json') {
        // Load JSON file
        const text = await file.text();
        result = await dataEngine.load_json(text);
        
        toast.success(`JSON file "${file.name}" loaded successfully!`);
      } else {
        throw new Error('Unsupported file format. Please upload CSV or JSON files.');
      }

      // Get schema information
      const schema = await dataEngine.get_schema();
      
      onDataLoaded({
        fileName: file.name,
        fileSize: file.size,
        fileType: fileExtension.toUpperCase(),
        schema: schema,
        result: result
      });

    } catch (error) {
      console.error('File upload error:', error);
      toast.error(`Failed to load file: ${error.message}`);
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
          Upload CSV or JSON files to load data into the engine
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <div className="space-y-2">
              <Database className="h-8 w-8 mx-auto text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Processing file...</p>
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
                <p className="font-medium">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground">
                  Supports CSV and JSON files
                </p>
              </div>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  Choose Files
                  <input
                    type="file"
                    accept=".csv,.json"
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
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <label className="cursor-pointer">
                Upload Another
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataUploader;
