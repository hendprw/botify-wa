import makeWASocket, { useMultiFileAuthState } from "../../vendor/core/lib/index.js";
import qrcode from "qrcode-terminal";
import pino   from "pino";

/**
 * connection
 * ----------
 * Owns the raw connection lifecycle: creating/loading auth state, opening
 * the underlying socket, and reacting to `connection.update` (QR display,
 * "ready" on open, delegating "close" to `reconnect.js`). Wires the socket's
 * event emitter to `dispatch.js` for incoming messages.
 *
 * Backoff/reconnect *decisions* live in `reconnect.js` — this file only
 * calls into `this._handleDisconnect(...)` when the connection closes.
 */
export const connectionMethods = {
  /** Boot the bot: load/create session, connect, wire up listeners. */
  async start() {
    this._clearReconnectTimer();

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
    this.sock.ev.on("connection.update", (update) => this._handleConnectionUpdate(update));
    this.sock.ev.on("messages.upsert", (payload) => this._handleMessagesUpsert(payload));

    return this.sock;
  },

  /** Gracefully close the socket. */
  async stop() {
    this._clearReconnectTimer();
    await this.sock?.end?.(undefined);
  },

  /**
   * Handle a `connection.update` event: show/emit QR codes, mark the bot
   * "ready" on open, and hand off to `reconnect.js` on close.
   * @param {import('../../vendor/core/lib/index.js').BaileysEventMap['connection.update']} update
   */
  _handleConnectionUpdate(update) {
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
      this._handleDisconnect(lastDisconnect);
    }
  },
};
