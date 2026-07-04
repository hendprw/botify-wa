import { Context } from "../Context.js";

/**
 * dispatch
 * --------
 * Turns raw `messages.upsert` events into Botify `Context` objects and
 * routes them through `PluginManager#dispatch`. Owns:
 *   - filtering out non-"notify" upserts and message-less entries
 *     (e.g. protocol-only stubs)
 *   - constructing `Context` with the bot's prefix/owners config
 *   - emitting the "message" event for every incoming message
 *   - emitting "unknownCommand" / routing to `_handleError` based on the
 *     PluginManager result
 *
 * Wired up once from `connection.js`'s `start()`, via
 * `this.sock.ev.on("messages.upsert", (p) => this._handleMessagesUpsert(p))`.
 */
export const dispatchMethods = {
  /**
   * @param {{ messages: object[], type: string }} payload
   */
  async _handleMessagesUpsert({ messages, type }) {
    if (type !== "notify") return;

    for (const raw of messages) {
      if (!raw.message) continue;
      await this._dispatchIncoming(raw);
    }
  },

  /**
   * Build a Context for one raw message and route it to the right command
   * (if any). Never throws — command/middleware errors go through
   * `this._handleError`.
   * @param {object} raw
   */
  async _dispatchIncoming(raw) {
    const ctx = new Context(this.sock, raw, {
      prefix: this.options.prefix,
      owners: this.options.owners,
    });

    this._emit("message", ctx);

    if (!ctx.command) return;

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
  },
};
