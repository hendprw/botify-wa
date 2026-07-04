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
