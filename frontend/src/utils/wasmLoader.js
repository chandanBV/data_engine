// Centralized WASM loader to avoid duplicate imports and webpack conflicts

let wasmModule = null;
let initPromise = null;

export const loadWasmModule = async () => {
  // Return cached module if already loaded
  if (wasmModule) {
    return wasmModule;
  }

  // Return existing promise if already loading
  if (initPromise) {
    return initPromise;
  }

  // Create new loading promise
  initPromise = (async () => {
    try {
      console.log("🔄 Loading WASM module...");

      // Dynamic import - use the root wasm directory, not subdirectory
      // wasm-pack outputs to wasm/ not wasm/data-engine/
      const module = await import("../wasm/data_engine.js");
      console.log("📦 WASM module structure:", Object.keys(module));

      // Handle different export structures for different targets
      let initSync, WasmDataEngine;

      if (module.default && typeof module.default === "function") {
        // Web target: default export is init function
        initSync = module.default;
        WasmDataEngine = module.WasmDataEngine;
      } else if (module.default && module.default.WasmDataEngine) {
        // Bundler target: default export is object with exports
        initSync = module.default.default || module.default;
        WasmDataEngine = module.default.WasmDataEngine;
      } else {
        // Node.js target: named exports
        initSync =
          module.default ||
          module.init ||
          module.__wbg_init ||
          module.init_panic_hook;
        WasmDataEngine = module.WasmDataEngine;
      }

      console.log("🔧 Extracted:", {
        initSync: typeof initSync,
        WasmDataEngine: typeof WasmDataEngine,
      });

      if (!WasmDataEngine || typeof WasmDataEngine !== "function") {
        throw new Error(
          `WasmDataEngine not found. Available exports: ${Object.keys(
            module
          ).join(", ")}`
        );
      }

      // Initialize WASM (some targets may not need explicit initialization)
      if (initSync && typeof initSync === "function") {
        console.log("🔧 Calling init function...");
        await initSync();
      } else {
        console.log(
          "🔧 No init function found, assuming auto-initialization..."
        );
        // Node.js target might auto-initialize, just set up panic hook if available
        if (
          module.init_panic_hook &&
          typeof module.init_panic_hook === "function"
        ) {
          module.init_panic_hook();
        }
      }

      // Test the WasmDataEngine to make sure it works
      console.log("🧪 Testing WasmDataEngine...");
      const testEngine = new WasmDataEngine();
      console.log("🧪 Test engine created:", testEngine);
      console.log("🧪 Test engine methods:", Object.keys(testEngine));

      // Check for required methods
      const requiredMethods = [
        "load_csv",
        "load_csv_with_batch_size", // New optimized method
        "load_json",
        "load_parquet",
        "load_excel",
        "get_schema",
        "pivot",
        "filter",
        "aggregate",
      ];
      console.log("🧪 Checking required methods:");
      requiredMethods.forEach((method) => {
        const exists = typeof testEngine[method] === "function";
        console.log(
          `  ${exists ? "✅" : "❌"} ${method}: ${typeof testEngine[method]}`
        );
      });

      // Test basic methods
      try {
        const testSchema = await testEngine.get_schema();
        console.log("🧪 Test schema call result:", testSchema);
      } catch (error) {
        console.warn(
          "🧪 Test schema call failed (expected for empty engine):",
          error.message
        );
      }

      // Cache the module
      wasmModule = {
        initSync,
        WasmDataEngine,
        createEngine: () => new WasmDataEngine(),
      };

      console.log("✅ WASM module loaded and cached");
      return wasmModule;
    } catch (error) {
      console.error("❌ Failed to load WASM module:", error);
      // Reset promise so we can retry
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
};

// Helper function to create a new engine instance
export const createDataEngine = async () => {
  const module = await loadWasmModule();
  return module.createEngine();
};

// Reset function for testing/development
export const resetWasmModule = () => {
  wasmModule = null;
  initPromise = null;
};
