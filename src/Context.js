/**
 * Context
 * -------
 * A friendly, per-message object passed to every command/middleware.
 * Wraps the raw connection message + gives shortcuts like ctx.reply().
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

  /** React to the triggering message with an emoji. */
  async react(emoji) {
    return this.sock.sendMessage(this.from, {
      react: { text: emoji, key: this.raw.key },
    });
  }

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