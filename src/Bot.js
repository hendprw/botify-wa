import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "../vendor/core/lib/index.js";
import qrcode from "qrcode-terminal";
import pino   from "pino";
import { PluginManager }         from "./PluginManager.js";
import { Context }               from "./Context.js";
import { loadConfig, mergeConfig } from "./config/index.js";
import { logger }    from "./middlewares/logger.js";
import { cooldown }  from "./middlewares/cooldown.js";
import { permission } from "./middlewares/permission.js";
import { antiSpam }  from "./middlewares/antiSpam.js";

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
    //
    //  Order matters:
    //    1. logger      — log first so every attempt is recorded, even blocked ones
    //    2. antiSpam    — global rate limit before any per-command check
    //    3. permission  — owner / admin gate
    //    4. cooldown    — per-user per-command throttle
    //    (user middlewares added via bot.use() run after all of the above)

    this.plugins.use(
      logger({
        enabled: this.options.logger.enabled,
        showPn:  this.options.logger.showPn,
        logFn:   this.options.logger.logFn,
        format:  this.options.logger.format,
      })
    );

    if (this.options.antiSpam.enabled) {
      this.plugins.use(
        antiSpam({
          windowMs:    this.options.antiSpam.windowMs,
          maxMessages: this.options.antiSpam.maxMessages,
          message:     this.options.antiSpam.message,
        })
      );
    }

    this.plugins.use(
      permission({
        ownerMessage: this.options.permissionMessages.owner,
        adminMessage:  this.options.permissionMessages.admin,
        emitEvent: (ctx, reason) => this._emit("noPermission", ctx, reason),
      })
    );

    this.plugins.use(
      cooldown({
        defaultCooldown: this.options.defaultCooldown,
        message:         this.options.cooldownMessage,
        emitEvent: (ctx, remainingMs) => this._emit("cooldown", ctx, remainingMs),
      })
    );
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

  // ── Internals ──────────────────────────────────────────────────────────────

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

  /** Boot the bot: load/create session, connect, wire up listeners. */
  async start() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(
      this.options.sessionPath
    );

    const logger_ =
      this.options.socketConfig.logger ??
      pino({ level: this.options.logLevel });

    this.sock = makeWASocket({
      auth: state,
      ...this.options.socketConfig,
      logger: logger_,
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (this.options.printQR) {
          qrcode.generate(qr, { small: true });
          console.log("Scan the QR code above with WhatsApp (Linked Devices).");
        }
        this._emit("qr", qr);
      }

      if (connection === "open") {
        this._reconnectAttempts = 0;
        this._emit("ready", this.sock);
      }

      if (connection === "close") {
        const statusCode     = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          const delay = Math.min(
            this.options.reconnectBaseDelay * 2 ** this._reconnectAttempts,
            this.options.reconnectMaxDelay
          );
          this._reconnectAttempts++;

          this._emit("disconnect", {
            statusCode,
            willReconnect: true,
            reconnectDelayMs: delay,
            attempt: this._reconnectAttempts,
          });

          this._reconnectTimer = setTimeout(() => this.start(), delay);
        } else {
          this._emit("disconnect", { statusCode, willReconnect: false });
        }
      }
    });

    this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const raw of messages) {
        if (!raw.message) continue;

        const ctx = new Context(this.sock, raw, {
          prefix: this.options.prefix,
          owners: this.options.owners,
        });

        this._emit("message", ctx);

        if (!ctx.command) continue;

        const result = await this.plugins.dispatch(ctx.command, ctx);

        switch (result.status) {
          case "not_found":
            this._emit("unknownCommand", ctx);
            break;
          case "error":
            await this._handleError(result.error, ctx);
            break;
          // "ok" and "stopped" need no further action
        }
      }
    });

    return this.sock;
  }

  /** Gracefully close the socket. */
  async stop() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    await this.sock?.end?.(undefined);
  }
}
