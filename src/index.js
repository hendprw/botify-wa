export { Bot }           from "./Bot.js";
export { Context }       from "./Context.js";
export { Quoted }        from "./Quoted.js";
export { PluginManager } from "./PluginManager.js";
export { loadPlugins }   from "./loader.js";

// Media + message-type utilities (advanced use — Context wraps these already).
export { downloadMedia, saveMedia, resolveMediaSource, toVcard } from "./media.js";
export { detectMessageType, isMediaType, extractPlainText } from "./utils/messageTypes.js";

// Built-in middlewares (auto-registered by Bot).
// Exported here for advanced users who need manual composition.
export * as middlewares from "./middlewares/index.js";

// Config utilities.
export { loadConfig, parse as parseConfig } from "./config/parser.js";

// Low-level core re-exports for dropping down to raw connection API.
export {
  DisconnectReason,
  useMultiFileAuthState,
  Dugong,
} from "../vendor/core/lib/index.js";