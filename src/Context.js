import { proto } from "../vendor/core/lib/index.js";
import { detectMessageType, isMediaType } from "./utils/messageTypes.js";
import { downloadMedia, saveMedia, resolveMediaSource, toVcard } from "./media.js";
import { Quoted } from "./Quoted.js";

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
 * ctx.type. Also exposes media download, rich media sending, and
 * message-management actions (edit, delete, react, pin, star, forward).
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

    const key = rawMessage.key;

    // WhatsApp is rolling out "LID" (Linked ID, @lid) as an alternate,
    // non-phone-number identifier — mainly in DMs and communities, for
    // privacy. When that's active, the "primary" field (participant /
    // remoteJid) may hold the @lid form while the real phone-number JID
    // sits in the matching "Alt" field (participantAlt / remoteJidAlt),
    // or vice versa. We fall back through all four so `sender`/`from`
    // are never silently empty just because WhatsApp picked a different
    // field for this account/chat.
    this.from = key.remoteJid || key.remoteJidAlt || "";
    this.sender =
      key.participant || key.remoteJid || key.participantAlt || key.remoteJidAlt || "";
    this.fromMe = !!key.fromMe;

    /**
     * Kind of chat this message came from:
     * "group" | "channel" (newsletter) | "broadcast" | "private"
     */
    this.chatType = detectChatType(this.from);
    /** Convenience boolean, derived from chatType (kept for backwards compat). */
    this.isGroup = this.chatType === "group";

    /** Display name of the sender as WhatsApp reports it (may be stale/unset). */
    this.pushName = rawMessage.pushName || "Unknown";

    /** The sender's @lid identifier, if WhatsApp provided one — else null. */
    this.senderLid = [key.participant, key.participantAlt, key.remoteJid, key.remoteJidAlt]
      .find((jid) => isLid(jid)) ?? null;
    /** The sender's real phone-number JID (@s.whatsapp.net), if available — else null. */
    this.senderPn = [key.participant, key.participantAlt, key.remoteJid, key.remoteJidAlt]
      .find((jid) => isPn(jid)) ?? null;

    /**
     * Sender's phone number with no @domain suffix, e.g. "6281234567890".
     * Prefers the real phone-number JID over a LID (a LID's numeric part
     * is NOT a phone number, so it's only used here as a last resort).
     */
    this.senderNumber = (this.senderPn ?? this.senderLid ?? this.sender).split("@")[0] ?? "";

    // ── Message type + content ────────────────────────────────────────────
    // Unwraps ephemeral/view-once/edited envelopes automatically, so
    // ctx.type/ctx.text/media fields always describe the *real* message.
    const { type, key: contentKey, content } = detectMessageType(rawMessage.message);
    /**
     * Friendly message-type string: "text" | "image" | "video" | "audio" |
     * "sticker" | "document" | "contact" | "contacts" | "location" |
     * "liveLocation" | "poll" | "pollUpdate" | "reaction" | "buttonsResponse" |
     * "listResponse" | "templateButtonReply" | "interactiveResponse" |
     * "groupInvite" | "product" | "order" | "event" | "protocol" | "call" |
     * "unsupported" | "unknown"
     */
    this.type = type;
    /** Raw WAProto content key this was detected from (e.g. "imageMessage"). */
    this._contentKey = contentKey;
    /** Raw inner content object for ctx.type (e.g. the imageMessage itself). */
    this._content = content ?? {};

    /** Whether this message carries a downloadable media attachment. */
    this.isMedia = isMediaType(type);
    this.mimetype = this._content.mimetype ?? null;
    this.caption = this._content.caption ?? null;
    this.fileName = this._content.fileName ?? null;
    /** True for voice notes (audio messages sent as PTT). */
    this.isPtt = type === "audio" ? !!this._content.ptt : false;
    this.isAnimatedSticker = type === "sticker" ? !!this._content.isAnimated : false;
    this.isViewOnce = !!this._content.viewOnce;

    const contextInfo = this._content.contextInfo ?? null;

    /** JIDs explicitly @mentioned in this message. */
    this.mentions = contextInfo?.mentionedJid ?? [];

    /** The message this one is replying to, or null. See Quoted.js. */
    this.quoted = contextInfo?.quotedMessage
      ? new Quoted(sock, this.from, contextInfo)
      : null;

    // ── Type-specific convenience fields ──────────────────────────────────
    if (type === "location" || type === "liveLocation") {
      this.location = {
        latitude: this._content.degreesLatitude,
        longitude: this._content.degreesLongitude,
        name: this._content.name || null,
        address: this._content.address || null,
      };
    }

    if (type === "contact") {
      this.contact = {
        displayName: this._content.displayName || null,
        vcard: this._content.vcard,
      };
    }

    if (type === "contacts") {
      this.contacts = (this._content.contacts ?? []).map((c) => ({
        displayName: c.displayName || null,
        vcard: c.vcard,
      }));
    }

    if (type === "poll") {
      this.poll = {
        name: this._content.name,
        options: (this._content.options ?? []).map((o) => o.optionName),
        selectableCount: this._content.selectableOptionsCount || 1,
      };
    }

    if (type === "buttonsResponse") {
      this.buttonReply = {
        id: this._content.selectedButtonId,
        text: this._content.selectedDisplayText,
      };
    }
    if (type === "templateButtonReply") {
      this.buttonReply = {
        id: this._content.selectedId,
        text: this._content.selectedDisplayText,
      };
    }
    if (type === "listResponse") {
      this.listReply = {
        id: this._content.singleSelectReply?.selectedRowId,
        title: this._content.title,
      };
    }

    if (type === "groupInvite") {
      this.groupInvite = {
        jid: this._content.groupJid,
        code: this._content.inviteCode,
        expiration: this._content.inviteExpiration,
        name: this._content.groupName,
      };
    }

    if (type === "protocol") {
      this.protocol = describeProtocolMessage(this._content);
    }

    // ── Text + command parsing ────────────────────────────────────────────
    this.text = extractText(rawMessage);
    const parsed = parseCommand(this.text, botConfig.prefix);
    this.command = parsed.command;
    this.args = parsed.args;

    /** Whether the sender is listed in Bot({ owners: [...] }). */
    this.isOwner = (botConfig.owners ?? []).includes(this.sender);

    /**
     * Cache for the group metadata fetch, shared by isGroupAdmin() and
     * getGroupName() so a single incoming message never fetches it twice.
     * undefined = not fetched yet, null = fetched but unavailable/failed.
     * @type {object | null | undefined}
     */
    this._groupMetadataCache = undefined;
  }

  // ── Sending ────────────────────────────────────────────────────────────

  /** Reply in the same chat, quoting the triggering message. */
  async reply(text, opts = {}) {
    return this.sock.sendMessage(
      this.from,
      { text, ...opts },
      { quoted: this.raw }
    );
  }

  /** Send any core-compatible message content to the same chat. */
  async send(content, opts = {}) {
    return this.sock.sendMessage(this.from, content, opts);
  }

  /** Send an image. `source`: Buffer, local file path, http(s) URL, or `{ url }`/`{ stream }`. */
  async sendImage(source, opts = {}) {
    const { caption, quoted, ...rest } = opts;
    return this.send(
      { image: resolveMediaSource(source), caption, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  }

  /** Send a video. Pass `{ gifPlayback: true }` to loop it like a GIF. */
  async sendVideo(source, opts = {}) {
    const { caption, quoted, ...rest } = opts;
    return this.send(
      { video: resolveMediaSource(source), caption, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  }

  /** Send audio. Pass `{ ptt: true }` to send as a voice note. */
  async sendAudio(source, opts = {}) {
    const { quoted, mimetype = "audio/mp4", ptt = false, ...rest } = opts;
    return this.send(
      { audio: resolveMediaSource(source), mimetype, ptt, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  }

  /** Send a document/file. */
  async sendDocument(source, opts = {}) {
    const {
      quoted,
      mimetype = "application/octet-stream",
      fileName = "file",
      caption,
      ...rest
    } = opts;
    return this.send(
      { document: resolveMediaSource(source), mimetype, fileName, caption, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  }

  /** Send a sticker (must be a valid animated/static WebP for best results). */
  async sendSticker(source, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.send(
      { sticker: resolveMediaSource(source), ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  }

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
  }

  /** Send a location pin. */
  async sendLocation({ latitude, longitude, name, address }, opts = {}) {
    return this.send(
      { location: { degreesLatitude: latitude, degreesLongitude: longitude, name, address } },
      { quoted: this.raw, ...opts }
    );
  }

  /** Send a poll. `options.selectableCount` defaults to 1 (single-choice). */
  async sendPoll({ name, options, selectableCount = 1 }, opts = {}) {
    return this.send(
      { poll: { name, values: options, selectableCount } },
      { quoted: this.raw, ...opts }
    );
  }

  // ── Media download ────────────────────────────────────────────────────

  /**
   * Download this message's media attachment.
   * @param {{ asStream?: boolean }} [opts] `asStream: true` for large files.
   * @returns {Promise<Buffer | NodeJS.ReadableStream>}
   */
  async download(opts) {
    if (!this.isMedia) {
      throw new Error(`Message of type "${this.type}" has no media to download`);
    }
    return downloadMedia(this.sock, this.raw, opts);
  }

  /** Download this message's media straight to disk. Returns the filePath. */
  async saveMedia(filePath, opts) {
    if (!this.isMedia) {
      throw new Error(`Message of type "${this.type}" has no media to download`);
    }
    return saveMedia(this.sock, this.raw, filePath, opts);
  }

  // ── Message management ────────────────────────────────────────────────

  /** React to the triggering message with an emoji. */
  async react(emoji) {
    return this.sock.sendMessage(this.from, {
      react: { text: emoji, key: this.raw.key },
    });
  }

  /** Remove the bot's own reaction from the triggering message. */
  async removeReaction() {
    return this.react("");
  }

  /**
   * Edit any of the bot's own previously-sent messages in this chat.
   * @param {{key:object}|object} target  A sent-message result (from
   *   ctx.reply()/ctx.send()) or a raw message key.
   * @param {object} content  New content, e.g. `{ text: "updated" }`.
   */
  async editMessage(target, content) {
    const key = target?.key ?? target;
    return this.sock.sendMessage(this.from, { ...content, edit: key });
  }

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
  }

  /** Shortcut: edit the triggering message itself (only works if it's the bot's own). */
  async edit(text) {
    return this.editMessage(this.raw.key, { text });
  }

  /** Shortcut: delete the triggering message itself. */
  async delete() {
    return this.deleteMessage(this.raw.key);
  }

  /** Pin the triggering message in the chat. `time` in seconds (default 24h). */
  async pin(time = 86400) {
    return this.sock.sendMessage(this.from, {
      pin: this.raw.key,
      type: proto.PinInChat.Type.PIN_FOR_ALL,
      time,
    });
  }

  /** Unpin the triggering message. */
  async unpin() {
    return this.sock.sendMessage(this.from, {
      pin: this.raw.key,
      type: proto.PinInChat.Type.UNPIN_FOR_ALL,
    });
  }

  /** Star/unstar the triggering message. */
  async star(starred = true) {
    return this.sock.star(
      this.from,
      [{ id: this.raw.key.id, fromMe: this.raw.key.fromMe }],
      starred
    );
  }

  /** Forward the triggering message to another chat. */
  async forward(toJid, opts = {}) {
    return this.sock.sendMessage(toJid, { forward: this.raw, ...opts });
  }

  /** Whether `jid` (any of its JID forms) is @mentioned in this message. */
  isMentioned(jid) {
    const num = String(jid).split("@")[0];
    return this.mentions.some((m) => String(m).split("@")[0] === num);
  }

  // ── Group helpers ─────────────────────────────────────────────────────

  /**
   * Fetches (and caches) this chat's group metadata. Returns `null` outside
   * of groups, or if the fetch fails (e.g. bot was removed from the group).
   */
  async _getGroupMetadata() {
    if (this.chatType !== "group") return null;
    if (this._groupMetadataCache !== undefined) return this._groupMetadataCache;

    try {
      this._groupMetadataCache = await this.sock.groupMetadata(this.from);
    } catch {
      this._groupMetadataCache = null;
    }
    return this._groupMetadataCache;
  }

  /**
   * Whether the sender is an admin (or superadmin) of the current group.
   * Always `false` outside of groups.
   */
  async isGroupAdmin() {
    const metadata = await this._getGroupMetadata();
    if (!metadata) return false;

    const ids = [this.sender, this.senderLid, this.senderPn].filter(Boolean);
    const participant = metadata.participants.find((p) => ids.includes(p.id));
    return (
      !!participant &&
      (participant.admin === "admin" || participant.admin === "superadmin")
    );
  }

  /**
   * The current group's display name (its "subject"). Returns `null`
   * outside of groups or if metadata couldn't be fetched.
   */
  async getGroupName() {
    const metadata = await this._getGroupMetadata();
    return metadata?.subject ?? null;
  }

  /**
   * A human-readable one-liner describing where this message came from,
   * handy for logging: e.g. `group "Koalisi Community"` or `private chat`.
   */
  async describeChat() {
    if (this.chatType === "group") {
      const name = await this.getGroupName();
      return `group "${name ?? this.from}"`;
    }
    if (this.chatType === "channel") return "channel";
    if (this.chatType === "broadcast") return "broadcast list";
    return "private chat";
  }
}

function isLid(jid) {
  return typeof jid === "string" && jid.endsWith("@lid");
}

function isPn(jid) {
  return typeof jid === "string" && jid.endsWith("@s.whatsapp.net");
}

function detectChatType(jid) {
  if (jid.endsWith("@g.us")) return "group";
  if (jid.endsWith("@newsletter")) return "channel";
  if (jid.endsWith("@broadcast")) return "broadcast";
  return "private";
}

function extractText(msg) {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    ""
  );
}

function parseCommand(text, prefix) {
  if (!text || !text.startsWith(prefix)) {
    return { command: null, args: [] };
  }
  const [command, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  return { command: command?.toLowerCase() ?? null, args };
}

/** Turns a protocolMessage's numeric `type` into a friendly description. */
function describeProtocolMessage(content) {
  const Type = proto.Message.ProtocolMessage.Type;
  const reverse = Object.fromEntries(Object.entries(Type).map(([k, v]) => [v, k]));

  const kindMap = {
    [Type.REVOKE]: "delete",
    [Type.MESSAGE_EDIT]: "edit",
    [Type.EPHEMERAL_SETTING]: "ephemeralSetting",
  };

  return {
    kind: kindMap[content.type] ?? reverse[content.type] ?? "unknown",
    key: content.key ?? null,
    editedText: content.editedMessage?.conversation
      ?? content.editedMessage?.extendedTextMessage?.text
      ?? null,
  };
}