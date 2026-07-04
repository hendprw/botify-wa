/**
 * sending/other
 * -------------
 * Everything that doesn't fit "plain text", "media", "interactive", or
 * "rich response": contacts, locations, polls, payments, calendar events,
 * catalog products, and Status (story) mentions.
 */
import { resolveMediaSource, toVcard } from "../../media.js";

export const otherSendingMethods = {
  /**
   * Send one or more contacts.
   * @param {{name:string, number:string, organization?:string} | Array<{...}>} contacts
   */
  async sendContact(contacts, opts = {}) {
    const list = Array.isArray(contacts) ? contacts : [contacts];
    return this.send(
      {
        contacts: {
          displayName: opts.displayName ?? list[0]?.name,
          contacts: list.map((c) => ({ vcard: toVcard(c) })),
        },
      },
      { quoted: this.raw }
    );
  },

  /** Send a location pin. */
  async sendLocation({ latitude, longitude, name, address }, opts = {}) {
    return this.send(
      { location: { degreesLatitude: latitude, degreesLongitude: longitude, name, address } },
      { quoted: this.raw, ...opts }
    );
  },

  /** Send a poll. `options.selectableCount` defaults to 1 (single-choice). */
  async sendPoll({ name, options, selectableCount = 1 }, opts = {}) {
    return this.send(
      { poll: { name, values: options, selectableCount } },
      { quoted: this.raw, ...opts }
    );
  },

  /** Send a payment request. */
  async sendPayment({ amount, currency, note, from }, opts = {}) {
    return this.send(
      { requestPaymentMessage: { amount, currency, note, from } },
      { quoted: this.raw, ...opts }
    );
  },

  /** Send a calendar event invite. */
  async sendEvent({ name, description, startTime, endTime, location }, opts = {}) {
    return this.send(
      { eventMessage: { name, description, startTime, endTime, location } },
      { quoted: this.raw, ...opts }
    );
  },

  /** Send poll results (final tally, shown like WhatsApp's own poll-result summary). */
  async sendPollResult({ name, votes }, opts = {}) {
    return this.send(
      { pollResultMessage: { name, pollVotes: votes } },
      { quoted: this.raw, ...opts }
    );
  },

  /** Send a catalog product card. */
  async sendProduct(product, opts = {}) {
    const { thumbnail, ...rest } = product;
    return this.send(
      {
        productMessage: {
          ...rest,
          ...(thumbnail ? { thumbnail: resolveMediaSource(thumbnail) } : {}),
        },
      },
      { quoted: this.raw, ...opts }
    );
  },

  /**
   * Post a WhatsApp Status (story) update that @mentions specific contacts,
   * so it shows up highlighted for them. Unlike the other `send*()` methods
   * this doesn't go to `ctx.from` — a Status isn't posted "in" a chat, it's
   * broadcast, visible only to the given `jids` (must be your contacts).
   * @param {object} content  Same shape as `sock.sendMessage`'s content, e.g. `{ text }` or `{ image }`.
   * @param {string[]} jids  Contacts (and/or groups) who should see it highlighted.
   */
  async sendStatusMention(content, jids) {
    return this.sock.sendStatusMention(content, jids);
  },
};
