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
   * @param {{ prefix: string }} botConfig
   */
  constructor(sock, rawMessage, botConfig) {
    this.sock = sock;
    this.raw = rawMessage;
    this.botConfig = botConfig;

    this.from = rawMessage.key.remoteJid ?? "";
    this.isGroup = this.from.endsWith("@g.us");
    this.sender = rawMessage.key.participant ?? rawMessage.key.remoteJid ?? "";
    this.fromMe = !!rawMessage.key.fromMe;

    this.text = extractText(rawMessage);
    const parsed = parseCommand(this.text, botConfig.prefix);
    this.command = parsed.command;
    this.args = parsed.args;
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
