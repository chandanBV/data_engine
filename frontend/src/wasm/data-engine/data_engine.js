import * as wasm from "./data_engine_bg.wasm";
export * from "./data_engine_bg.js";
import { __wbg_set_wasm } from "./data_engine_bg.js";
__wbg_set_wasm(wasm);