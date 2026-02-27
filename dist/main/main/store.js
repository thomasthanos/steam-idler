"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStore = getStore;
const electron_store_1 = __importDefault(require("electron-store"));
const types_1 = require("../shared/types");
// Lazy singleton — created on first access, AFTER app.setPath('userData') has been called.
// This guarantees the store file lands in the correct ThomasThanos/Souvlatzidiko-Unlocker
// directory instead of Electron's default AppData path.
//
// IMPORTANT: Do NOT create a `new Store()` at module top-level anywhere in the
// main process. ES module imports are evaluated before any top-level code runs,
// so a module-level Store would be instantiated before app.setPath() executes
// and would resolve to the wrong (default Electron) userData directory.
let _store = null;
function getStore() {
    if (!_store) {
        _store = new electron_store_1.default({
            name: 'config',
            defaults: { settings: types_1.DEFAULT_SETTINGS },
        });
    }
    return _store;
}
