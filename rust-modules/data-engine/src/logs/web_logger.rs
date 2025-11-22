use wasm_bindgen::JsValue;

#[cfg(target_arch = "wasm32")]
pub fn log(msg: &str) {
    web_sys::console::log_1(&JsValue::from_str(msg));
}
