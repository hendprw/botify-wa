/**
 * jid-utils
 * ---------
 * Small, dependency-free helpers for classifying WhatsApp JIDs. Kept apart
 * from Context itself so they can be reused (e.g. by middlewares) and
 * tested in isolation.
 */

/** True for WhatsApp's privacy-preserving "@lid" identifier form. */
export function isLid(jid) {
  return typeof jid === "string" && jid.endsWith("@lid");
}

/** True for a real phone-number JID ("@s.whatsapp.net"). */
export function isPn(jid) {
  return typeof jid === "string" && jid.endsWith("@s.whatsapp.net");
}

/**
 * Classifies a chat JID into the four kinds Botify distinguishes.
 * @param {string} jid
 * @returns {"group" | "channel" | "broadcast" | "private"}
 */
export function detectChatType(jid) {
  if (jid.endsWith("@g.us")) return "group";
  if (jid.endsWith("@newsletter")) return "channel";
  if (jid.endsWith("@broadcast")) return "broadcast";
  return "private";
}

/**
 * Strips the device suffix (":12") that WhatsApp appends to a bot's own
 * JID (`sock.user.id`), e.g. "628xxx:12@s.whatsapp.net" → "628xxx@s.whatsapp.net".
 * Other JIDs (senders, chats) never carry this suffix, so it's only needed
 * for `sock.user.id` — kept here anyway since it's still "just JID shape".
 * @param {string | null | undefined} jid
 * @returns {string | null}
 */
export function normalizeJid(jid) {
  if (!jid) return null;
  return jid.replace(/:\d+(?=@)/, "");
}