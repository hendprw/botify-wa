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
 *  - connection lifecycle + auto-reconnect
 *  - command routing (through PluginManager)
 *  - a small event API on top of the underlying WhatsApp connection
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
   *   socketConfig?: object
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
    };

    this.plugins = new PluginManager();
    this.sock = null;

    /** @type {Map<string, Function[]>} */
    this._listeners = new Map();
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
   * Listen to a Botify-level event: "ready", "message", "disconnect".
   * (Raw core connection events are still available via bot.sock.ev)
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(handler);
    return this;
  }

  _emit(event, ...args) {
    for (const fn of this._listeners.get(event) ?? []) fn(...args);
  }

  /** Boot the bot: load/creates session, connects, wires up listeners. */
  async start() {
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
        this._emit("ready", this.sock);
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this._emit("disconnect", { statusCode, willReconnect: shouldReconnect });

        if (shouldReconnect) {
          this.start();
        }
      }
    });

    this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const raw of messages) {
        if (!raw.message) continue;

        const ctx = new Context(this.sock, raw, {
          prefix: this.options.prefix,
        });

        this._emit("message", ctx);

        if (ctx.command) {
          const handled = await this.plugins.dispatch(ctx.command, ctx);
          if (handled === false) {
            this._emit("unknownCommand", ctx);
          }
        }
      }
    });

    return this.sock;
  }

  /** Gracefully close the socket. */
  async stop() {
    await this.sock?.end?.(undefined);
  }
}