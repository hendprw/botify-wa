import { DisconnectReason } from "../../vendor/core/lib/index.js";

/**
 * reconnect
 * ---------
 * Exponential-backoff auto-reconnect, purely orchestration on top of
 * `connection.js`'s `start()`. Owns:
 *   - deciding whether a "close" event should trigger a reconnect
 *     (anything except `loggedOut`)
 *   - computing the next backoff delay (base * 2^attempt, capped at max)
 *   - scheduling/clearing the reconnect timer
 *
 * State (`this._reconnectAttempts`, `this._reconnectTimer`) is initialized
 * in the Bot constructor; these methods just read/mutate it.
 */
export const reconnectMethods = {
  /**
   * Handle a `connection === "close"` update: emit "disconnect" and, unless
   * the socket was logged out, schedule a reconnect attempt.
   * @param {import('../../vendor/core/lib/index.js').BaileysEventMap['connection.update']['lastDisconnect']} lastDisconnect
   */
  _handleDisconnect(lastDisconnect) {
    const statusCode     = lastDisconnect?.error?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    if (!shouldReconnect) {
      this._emit("disconnect", { statusCode, willReconnect: false });
      return;
    }

    const delay = this._nextReconnectDelay();

    this._emit("disconnect", {
      statusCode,
      willReconnect: true,
      reconnectDelayMs: delay,
      attempt: this._reconnectAttempts,
    });

    this._reconnectTimer = setTimeout(() => this.start(), delay);
  },

  /**
   * Computes the next backoff delay and bumps the attempt counter as a
   * side effect (mirrors the previous inline behavior in Bot.start()).
   * @returns {number} delay in ms
   */
  _nextReconnectDelay() {
    const delay = Math.min(
      this.options.reconnectBaseDelay * 2 ** this._reconnectAttempts,
      this.options.reconnectMaxDelay
    );
    this._reconnectAttempts++;
    return delay;
  },

  /** Clears any pending reconnect timer. Safe to call when none is set. */
  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  },
};
