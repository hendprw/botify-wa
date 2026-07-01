import {
  detectMessageType,
  isMediaType,
  extractPlainText,
} from "./utils/messageTypes.js";
import { downloadMedia, saveMedia } from "./media.js";

/**
 * Quoted
 * ------
 * Represents the message a user replied to (`ctx.quoted`). Reconstructed
 * from `contextInfo` (WhatsApp doesn't hand you the quoted message as a
 * normal upsert — only its content + stanzaId/participant), wrapped up in
 * the same shape a `WAMessage` has so it can be fed straight back into
 * `sock.sendMessage` (`quoted:`), `downloadMediaMessage`, `{ delete }`, etc.
 */
export class Quoted {
  /**
   * @param {import('../vendor/core/lib/index.js').WASocket} sock
   * @param {string} chatJid  The chat the quote appears in (`ctx.from`).
   * @param {import('../vendor/core/lib/index.js').proto.IContextInfo} contextInfo
   */
  constructor(sock, chatJid, contextInfo) {
    this.sock = sock;
    this.chatJid = chatJid;

    const participant = contextInfo.participant || contextInfo.remoteJid || "";
    const meId = sock?.user?.id?.split(":")[0]?.split("@")[0];
    const participantId = participant.split("@")[0];

    /** Reconstructed WAMessage — usable anywhere a WAMessage is expected. */
    this.raw = {
      key: {
        remoteJid: chatJid,
        id: contextInfo.stanzaId,
        participant: participant || undefined,
        fromMe: !!meId && meId === participantId,
      },
      message: contextInfo.quotedMessage,
    };

    this.sender = participant;
    this.senderNumber = participantId || "";

    const { type, key, content } = detectMessageType(contextInfo.quotedMessage);
    this.type = type;
    this._contentKey = key;
    this._content = content ?? {};

    this.text = extractPlainText(contextInfo.quotedMessage);
    this.isMedia = isMediaType(type);
    this.mimetype = this._content.mimetype ?? null;
    this.caption = this._content.caption ?? null;
    this.fileName = this._content.fileName ?? null;
    this.isViewOnce = !!this._content.viewOnce;
    this.mentions = this._content.contextInfo?.mentionedJid ?? [];
  }

  /** Download this quoted message's media (throws if it isn't a media message). */
  async download(opts) {
    if (!this.isMedia) {
      throw new Error(`Quoted message of type "${this.type}" has no media to download`);
    }
    return downloadMedia(this.sock, this.raw, opts);
  }

  /** Download straight to disk. Returns the filePath. */
  async saveMedia(filePath, opts) {
    if (!this.isMedia) {
      throw new Error(`Quoted message of type "${this.type}" has no media to download`);
    }
    return saveMedia(this.sock, this.raw, filePath, opts);
  }

  /** React to the quoted message. */
  async react(emoji) {
    return this.sock.sendMessage(this.chatJid, {
      react: { text: emoji, key: this.raw.key },
    });
  }

  /** Delete the quoted message (bot must be the sender, or a group admin). */
  async delete() {
    return this.sock.sendMessage(this.chatJid, { delete: this.raw.key });
  }
}