export { Bot } from "./Bot.js";
export { Context } from "./Context.js";
export { PluginManager } from "./PluginManager.js";

// Built-in, ready-to-use middlewares (e.g. `middlewares.logger()`).
export * as middlewares from "./middlewares/index.js";

// Re-export useful low-level pieces in case someone needs to drop
// down to the raw core connection API.
export {
  DisconnectReason,
  useMultiFileAuthState,
  Dugong,
} from "../vendor/core/lib/index.js";