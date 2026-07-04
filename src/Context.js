import {
  deriveMessageState,
  textSendingMethods,
  mediaSendingMethods,
  interactiveSendingMethods,
  richSendingMethods,
  otherSendingMethods,
  mediaTransferMethods,
  messageActionMethods,
  groupInfoMethods,
} from "./context/index.js";

/**
 * Context
 * -------
 * A friendly, per-message object passed to every command/middleware.
 * Wraps the raw connection message + gives shortcuts like ctx.reply().
 *
 * Handles every message type the vendored core supports (text, image,
 * video, audio/voice-note, sticker, document, contact(s), location,
 * live location, polls, reactions, button/list replies, group invites,
 * products, events, and protocol messages like edits/deletes) — see
 * ctx.type. Also exposes media download, rich media sending (buttons,
 * list menus, albums, sticker packs, AI-style rich tables/code blocks/
 * links, payments, events, poll results, product cards, status mentions),
 * and message-management actions (edit, delete, react, pin, star, forward).
 *
 * This class itself only owns construction — the ~40 instance methods are
 * organized by concern into `./context/*.js` and mixed onto the prototype
 * below. See `./context/index.js` for the full map of which file owns
 * which methods.
 */
export class Context {
  /**
   * @param {import('../vendor/core/lib/index.js').WASocket} sock
   * @param {import('../vendor/core/lib/index.js').proto.IWebMessageInfo} rawMessage
   * @param {{ prefix: string, owners?: string[] }} botConfig
   */
  constructor(sock, rawMessage, botConfig) {
    this.sock = sock;
    this.raw = rawMessage;
    this.botConfig = botConfig;

    Object.assign(this, deriveMessageState(sock, rawMessage, botConfig));

    /**
     * Cache for the group metadata fetch, shared by isGroupAdmin() and
     * getGroupName() so a single incoming message never fetches it twice.
     * undefined = not fetched yet, null = fetched but unavailable/failed.
     * @type {object | null | undefined}
     */
    this._groupMetadataCache = undefined;
  }
}

// ── Assemble the prototype from focused, single-purpose mixins ───────────
// Order is presentation-only (this is how the methods will iterate/print);
// grouping mirrors the file layout under ./context/.
Object.assign(
  Context.prototype,
  textSendingMethods,        // reply, send, sendCard
  mediaSendingMethods,       // sendImage, sendVideo, sendAudio, sendDocument, sendSticker, sendStickerPack, sendAlbum
  interactiveSendingMethods, // sendButtons, sendListMenu
  richSendingMethods,        // sendTable(V2), sendRichList, sendCodeBlock(V2), sendLink(V2), sendRichMessage
  otherSendingMethods,       // sendContact, sendLocation, sendPoll, sendPayment, sendEvent, sendPollResult, sendProduct, sendStatusMention
  mediaTransferMethods,      // download, saveMedia
  messageActionMethods,      // react, removeReaction, edit(Message), delete(Message), pin, unpin, star, forward, isMentioned
  groupInfoMethods,          // isGroupAdmin, getGroupName, describeChat
);
