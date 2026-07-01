import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "../vendor/core/lib/index.js";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { PluginManager } from "./PluginManager.js";
import { Context } from "./Context.js";

/**
 * Bot
 * ---
 * The main class of the Botify framework. Handles:
 *  - auth/session (via multi-file auth state)
 *  - connection lifecycle + auto-reconnect (with exponential backoff)
 *  - command routing (through PluginManager), including cooldowns and
 *    owner/admin permission gates
 *  - a small event API on top of the underlying WhatsApp connection
 *  - centralized error handling for command/middleware failures
 *
 * Everything low-level (encryption, sockets, WA protocol) lives in
 * vendor/core — Botify only adds structure on top.
 */
export class Bot {
  /**
   * @param {{
   *   sessionPath?: string,
   *   prefix?: string,
   *   logLevel?: "trace"|"debug"|"info"|"warn"|"error"|"fatal"|"silent",
   *   printQR?: boolean,
   *   socketConfig?: object,
   *   owners?: string[],            // JIDs allowed to run { owner: true } commands
   *   reconnectBaseDelay?: number,  // ms, default 1000
   *   reconnectMaxDelay?: number    // ms, default 30000
   * }} [options]
   */
  constructor(options = {}) {
    this.options = {
      sessionPath: options.sessionPath ?? "./session",
      prefix: options.prefix ?? "!",
      printQR: options.printQR ?? true,
      // Default to "warn" so the terminal isn't flooded with the
      // connection's internal info-level logs (pairing, sync, etc).
      // Set to "info" or "debug" if you need to see everything, or
      // "error"/"silent" for even less output.
      logLevel: options.logLevel ?? "error",
      socketConfig: options.socketConfig ?? {},
      owners: options.owners ?? [],
      reconnectBaseDelay: options.reconnectBaseDelay ?? 1000,
      reconnectMaxDelay: options.reconnectMaxDelay ?? 30_000,
    };

    this.plugins = new PluginManager();
    this.sock = null;

    /** @type {Map<string, Function[]>} */
    this._listeners = new Map();
    /** @type {Function[]} */
    this._errorHandlers = [];
    /** consecutive failed-connection count, reset once "open" fires */
    this._reconnectAttempts = 0;
    /** guards against overlapping reconnect timers */
    this._reconnectTimer = null;
  }

  /** Register a command. Shortcut for bot.plugins.command(...) */
  command(name, handler, opts) {
    this.plugins.command(name, handler, opts);
    return this;
  }

  /** Register a middleware. Shortcut for bot.plugins.use(...) */
  use(fn) {
    this.plugins.use(fn);
    return this;
  }

  /**
   * Listen to a Botify-level event: "ready", "message", "disconnect",
   * "unknownCommand", "cooldown", "noPermission", "qr".
   * (Raw core connection events are still available via bot.sock.ev)
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(handler);
    return this;
  }

  /**
   * Register a global error handler. Called whenever a command handler or
   * middleware throws (sync or async). Multiple handlers can be registered;
   * all of them run. If none are registered, errors are logged to console
   * so failures are never silently swallowed.
   * @param {(error: unknown, ctx: import('./Context.js').Context) => any} fn
   */
  onError(fn) {
    this._errorHandlers.push(fn);
    return this;
  }

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
        // An error handler itself throwing should never crash the bot —
        // just surface it so it isn't silently lost.
        console.error("[botify] Error inside onError handler:", handlerError);
      }
    }
  }

  /** Boot the bot: load/creates session, connects, wires up listeners. */
  async start() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(
      this.options.sessionPath
    );

    const logger =
      this.options.socketConfig.logger ??
      pino({ level: this.options.logLevel });

    this.sock = makeWASocket({
      auth: state,
      ...this.options.socketConfig,
      logger,
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
        const statusCode = lastDisconnect?.error?.output?.statusCode;
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
          case "cooldown":
            this._emit("cooldown", ctx, result.remainingMs);
            break;
          case "no_permission":
            this._emit("noPermission", ctx, result.reason);
            break;
          case "error":
            await this._handleError(result.error, ctx);
            break;
          // "ok" and "stopped" need no further action here
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