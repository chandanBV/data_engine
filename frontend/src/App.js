import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './components/theme-provider';

// Pages
import HomePage from './pages/HomePage';
import DataEnginePage from './pages/DataEnginePage';
import EnhancedDataEnginePage from './pages/EnhancedDataEnginePage';
import WasmTestPage from './pages/WasmTestPage';
import ChartRendererPage from './pages/ChartRendererPage';
import QueryOptimizerPage from './pages/QueryOptimizerPage';
import ParallelComputePage from './pages/ParallelComputePage';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="wasm-boilerplate-theme">
      <Router>
        <div className="App min-h-screen">
          <Routes>
            <Route path="/" element={<EnhancedDataEnginePage />} />
            {/* <Route path="/data-engine" element={<EnhancedDataEnginePage />} /> */}
            {/* <Route path="/data-engine-legacy" element={<DataEnginePage />} />
            <Route path="/wasm-test" element={<WasmTestPage />} />
            <Route path="/chart-renderer" element={<ChartRendererPage />} />
            <Route path="/query-optimizer" element={<QueryOptimizerPage />} />
            <Route path="/parallel-compute" element={<ParallelComputePage />} />
            <Route path="*" element={<Navigate to="/" replace />} /> */}
          </Routes>
          <Toaster />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
