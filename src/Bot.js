import { PluginManager }         from "./PluginManager.js";
import { loadConfig, mergeConfig } from "./config/index.js";
import {
  registerBuiltinsMethods,
  connectionMethods,
  dispatchMethods,
  reconnectMethods,
} from "./bot/index.js";

/**
 * Bot
 * ---
 * The main class of the Botify framework. Handles:
 *  - config.bt loading + merging with programmatic options (code wins)
 *  - auth/session (via multi-file auth state)
 *  - connection lifecycle + auto-reconnect (with exponential backoff)
 *  - built-in middlewares: logger, permission, cooldown, antiSpam
 *    (auto-registered in the correct order; user middlewares run after)
 *  - command routing through PluginManager
 *  - a small event API on top of the underlying WhatsApp connection
 *  - centralized error handling for command/middleware failures
 *
 * Everything low-level (encryption, sockets, WA protocol) lives in
 * vendor/core — Botify only adds structure on top.
 *
 * This class itself only owns construction + the public API + the small
 * `_emit`/`_handleError` glue shared by every mixin below — the actual
 * connection lifecycle, message dispatch, built-in middleware setup, and
 * reconnect backoff are organized by concern into `./bot/*.js` and mixed
 * onto the prototype below. See `./bot/index.js` for the full map of
 * which file owns which methods.
 */
export class Bot {
  /**
   * @param {{
   *   sessionPath?:    string,
   *   prefix?:         string,
   *   logLevel?:       "trace"|"debug"|"info"|"warn"|"error"|"fatal"|"silent",
   *   printQR?:        boolean,
   *   socketConfig?:   object,
   *   owners?:         string[],
   *
   *   defaultCooldown?: number,    // ms; applied when command omits cooldown
   *   cooldownMessage?: string | ((ctx, remainingMs) => string),
   *
   *   antiSpam?: {
   *     enabled?:     boolean,
   *     windowMs?:    number,
   *     maxMessages?: number,
   *     message?:     string | ((ctx) => string),
   *   },
   *
   *   permissionMessages?: {
   *     owner?: string | ((ctx) => string),
   *     admin?: string | ((ctx) => string),
   *   },
   *
   *   logger?: {
   *     enabled?: boolean,
   *     showPn?:  boolean,
   *     logFn?:   (line: string) => void,
   *     format?:  (ctx) => string | Promise<string>,
   *   },
   *
   *   reconnectBaseDelay?: number,  // ms, default 1000
   *   reconnectMaxDelay?:  number,  // ms, default 30000
   *
   *   configDir?: string,  // directory to look for config.bt (default: cwd)
   * }} [options]
   */
  constructor(options = {}) {
    // ── 1. Load config.bt then merge (code options override file) ────────────
    const fileConfig = loadConfig(options.configDir);
    const cfg = mergeConfig(fileConfig, options);

    this.options = {
      sessionPath:    cfg.sessionPath    ?? "./session",
      prefix:         cfg.prefix         ?? "!",
      printQR:        cfg.printQR        ?? true,
      logLevel:       cfg.logLevel       ?? "error",
      socketConfig:   cfg.socketConfig   ?? {},
      owners:         cfg.owners         ?? [],

      defaultCooldown:  cfg.defaultCooldown  ?? 0,
      cooldownMessage:  cfg.cooldownMessage,

      antiSpam: {
        enabled:     cfg.antiSpam?.enabled     ?? false,
        windowMs:    cfg.antiSpam?.windowMs    ?? 5_000,
        maxMessages: cfg.antiSpam?.maxMessages ?? 5,
        message:     cfg.antiSpam?.message,
      },

      permissionMessages: {
        owner: cfg.permissionMessages?.owner,
        admin: cfg.permissionMessages?.admin,
      },

      logger: {
        enabled: cfg.logger?.enabled ?? true,
        showPn:  cfg.logger?.showPn  ?? true,
        logFn:   cfg.logger?.logFn,
        format:  cfg.logger?.format,
      },

      reconnectBaseDelay: cfg.reconnectBaseDelay ?? 1_000,
      reconnectMaxDelay:  cfg.reconnectMaxDelay  ?? 30_000,
    };

    this.plugins = new PluginManager();
    this.sock    = null;

    /** @type {Map<string, Function[]>} */
    this._listeners    = new Map();
    /** @type {Function[]} */
    this._errorHandlers = [];
    this._reconnectAttempts = 0;
    this._reconnectTimer    = null;

    // ── 2. Register built-in middlewares in the correct order ────────────────
    // (logger → antiSpam → permission → cooldown; see ./bot/register-builtins.js)
    this._registerBuiltinMiddlewares();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Register a command. Shortcut for bot.plugins.command(...) */
  command(name, handler, opts) {
    this.plugins.command(name, handler, opts);
    return this;
  }

  /**
   * Register a user middleware.
   * Runs AFTER all built-in middlewares (logger → antiSpam → permission → cooldown).
   */
  use(fn) {
    this.plugins.use(fn);
    return this;
  }

  /**
   * Listen to a Botify-level event:
   *   "ready", "message", "disconnect", "unknownCommand",
   *   "cooldown", "noPermission", "qr"
   * Raw core connection events are still available via bot.sock.ev.
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(handler);
    return this;
  }

  /**
   * Register a global error handler. Called whenever a command handler or
   * middleware throws. Multiple handlers can be registered; all run.
   * If none are registered, errors are logged to console.
   * @param {(error: unknown, ctx: import('./Context.js').Context) => any} fn
   */
  onError(fn) {
    this._errorHandlers.push(fn);
    return this;
  }

  // ── Internals shared by every ./bot/*.js mixin ────────────────────────────

  _emit(event, ...args) {
    for (const fn of this._listeners.get(event) ?? []) fn(...args);
  }

  async _handleError(error, ctx) {
    if (this._errorHandlers.length === 0) {
      console.error("[botify] Unhandled error in command/middleware:", error);
      return;
    }
    for (const fn of this._errorHandlers) {
      try {
        await fn(error, ctx);
      } catch (handlerError) {
        console.error("[botify] Error inside onError handler:", handlerError);
      }
    }
  }
}

// ── Assemble the prototype from focused, single-purpose mixins ───────────
// Order is presentation-only; grouping mirrors the file layout under ./bot/.
Object.assign(
  Bot.prototype,
  registerBuiltinsMethods, // _registerBuiltinMiddlewares
  connectionMethods,       // start, stop, _handleConnectionUpdate
  dispatchMethods,         // _handleMessagesUpsert, _dispatchIncoming
  reconnectMethods,        // _handleDisconnect, _nextReconnectDelay, _clearReconnectTimer
);
