/**
 * message-actions
 * ---------------
 * Actions that operate on already-sent messages: reactions, edits,
 * deletes, pin/unpin, star, and forwarding.
 */
import { proto } from "../../vendor/core/lib/index.js";

export const messageActionMethods = {
  /** React to the triggering message with an emoji. */
  async react(emoji) {
    return this.sock.sendMessage(this.from, {
      react: { text: emoji, key: this.raw.key },
    });
  },

  /** Remove the bot's own reaction from the triggering message. */
  async removeReaction() {
    return this.react("");
  },

  /**
   * Edit any of the bot's own previously-sent messages in this chat.
   * @param {{key:object}|object} target  A sent-message result (from
   *   ctx.reply()/ctx.send()) or a raw message key.
   * @param {object} content  New content, e.g. `{ text: "updated" }`.
   */
  async editMessage(target, content) {
    const key = target?.key ?? target;
    return this.sock.sendMessage(this.from, { ...content, edit: key });
  },

  /**
   * Delete a message for everyone. Only works for the bot's own messages,
   * or any message in a group where the bot is admin.
   * @param {{key:object}|object} [target]  Defaults to the triggering message
   *   — handy for self-bot setups where the owner's own command message
   *   should be cleaned up after being processed.
   */
  async deleteMessage(target = this.raw.key) {
    const key = target?.key ?? target;
    return this.sock.sendMessage(this.from, { delete: key });
  },

  /** Shortcut: edit the triggering message itself (only works if it's the bot's own). */
  async edit(text) {
    return this.editMessage(this.raw.key, { text });
  },

  /** Shortcut: delete the triggering message itself. */
  async delete() {
    return this.deleteMessage(this.raw.key);
  },

  /** Pin the triggering message in the chat. `time` in seconds (default 24h). */
  async pin(time = 86400) {
    return this.sock.sendMessage(this.from, {
      pin: this.raw.key,
      type: proto.PinInChat.Type.PIN_FOR_ALL,
      time,
    });
  },

  /** Unpin the triggering message. */
  async unpin() {
    return this.sock.sendMessage(this.from, {
      pin: this.raw.key,
      type: proto.PinInChat.Type.UNPIN_FOR_ALL,
    });
  },

  /** Star/unstar the triggering message. */
  async star(starred = true) {
    return this.sock.star(
      this.from,
      [{ id: this.raw.key.id, fromMe: this.raw.key.fromMe }],
      starred
    );
  },

  /** Forward the triggering message to another chat. */
  async forward(toJid, opts = {}) {
    return this.sock.sendMessage(toJid, { forward: this.raw, ...opts });
  },

  /** Whether `jid` (any of its JID forms) is @mentioned in this message. */
  isMentioned(jid) {
    const num = String(jid).split("@")[0];
    return this.mentions.some((m) => String(m).split("@")[0] === num);
  },
};
