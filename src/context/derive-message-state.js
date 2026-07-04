/**
 * derive-message-state
 * ---------------------
 * Turns a raw connection message into every plain-data field Context
 * exposes (`ctx.from`, `ctx.type`, `ctx.text`, `ctx.command`, type-specific
 * shortcuts like `ctx.location`/`ctx.poll`, …). Pure with respect to the
 * message itself — the only side effect is constructing a `Quoted` helper,
 * which needs `sock` to lazily resolve the quoted message's own media/replies.
 *
 * Kept separate from the `Context` class so the constructor stays a thin
 * "wire this up" step, and so this parsing logic can be unit-tested without
 * spinning up a full Context.
 */
import { proto } from "../../vendor/core/lib/index.js";
import { detectMessageType, isMediaType, extractNativeFlowId } from "../utils/messageTypes.js";
import { Quoted } from "../Quoted.js";
import { isLid, isPn, detectChatType } from "./jid-utils.js";
import { parseCommand, parseNativeFlowCommand } from "./command-parsing.js";

/**
 * @param {import('../../vendor/core/lib/index.js').WASocket} sock
 * @param {import('../../vendor/core/lib/index.js').proto.IWebMessageInfo} rawMessage
 * @param {{ prefix: string, owners?: string[] }} botConfig
 * @returns {object} Plain object of fields to be assigned onto a Context instance.
 */
export function deriveMessageState(sock, rawMessage, botConfig) {
  const state = {};
  const key = rawMessage.key;

  // WhatsApp is rolling out "LID" (Linked ID, @lid) as an alternate,
  // non-phone-number identifier — mainly in DMs and communities, for
  // privacy. When that's active, the "primary" field (participant /
  // remoteJid) may hold the @lid form while the real phone-number JID
  // sits in the matching "Alt" field (participantAlt / remoteJidAlt),
  // or vice versa. We fall back through all four so `sender`/`from`
  // are never silently empty just because WhatsApp picked a different
  // field for this account/chat.
  state.from = key.remoteJid || key.remoteJidAlt || "";
  state.sender =
    key.participant || key.remoteJid || key.participantAlt || key.remoteJidAlt || "";
  state.fromMe = !!key.fromMe;

  /**
   * Kind of chat this message came from:
   * "group" | "channel" (newsletter) | "broadcast" | "private"
   */
  state.chatType = detectChatType(state.from);
  /** Convenience boolean, derived from chatType (kept for backwards compat). */
  state.isGroup = state.chatType === "group";

  /** Display name of the sender as WhatsApp reports it (may be stale/unset). */
  state.pushName = rawMessage.pushName || "Unknown";

  /** The sender's @lid identifier, if WhatsApp provided one — else null. */
  state.senderLid = [key.participant, key.participantAlt, key.remoteJid, key.remoteJidAlt]
    .find((jid) => isLid(jid)) ?? null;
  /** The sender's real phone-number JID (@s.whatsapp.net), if available — else null. */
  state.senderPn = [key.participant, key.participantAlt, key.remoteJid, key.remoteJidAlt]
    .find((jid) => isPn(jid)) ?? null;

  /**
   * Sender's phone number with no @domain suffix, e.g. "6281234567890".
   * Prefers the real phone-number JID over a LID (a LID's numeric part
   * is NOT a phone number, so it's only used here as a last resort).
   */
  state.senderNumber = (state.senderPn ?? state.senderLid ?? state.sender).split("@")[0] ?? "";

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
  state.type = type;
  /** Raw WAProto content key this was detected from (e.g. "imageMessage"). */
  state._contentKey = contentKey;
  /** Raw inner content object for ctx.type (e.g. the imageMessage itself). */
  state._content = content ?? {};

  /** Whether this message carries a downloadable media attachment. */
  state.isMedia = isMediaType(type);
  state.mimetype = state._content.mimetype ?? null;
  state.caption = state._content.caption ?? null;
  state.fileName = state._content.fileName ?? null;
  /** True for voice notes (audio messages sent as PTT). */
  state.isPtt = type === "audio" ? !!state._content.ptt : false;
  state.isAnimatedSticker = type === "sticker" ? !!state._content.isAnimated : false;
  state.isViewOnce = !!state._content.viewOnce;

  const contextInfo = state._content.contextInfo ?? null;

  /** JIDs explicitly @mentioned in this message. */
  state.mentions = contextInfo?.mentionedJid ?? [];

  /** The message this one is replying to, or null. See Quoted.js. */
  state.quoted = contextInfo?.quotedMessage
    ? new Quoted(sock, state.from, contextInfo)
    : null;

  // ── Type-specific convenience fields ──────────────────────────────────
  Object.assign(state, deriveTypeSpecificFields(type, state._content));

  // ── Text + command parsing ────────────────────────────────────────────
  // Button/list-row taps are commands by construction (the developer
  // picked that id specifically to route to a command) — unlike free-typed
  // text, they don't need to start with the configured prefix, and it
  // doesn't matter which of WhatsApp's several reply formats echoed the
  // tap back (`templateButtonReplyMessage`, `buttonsResponseMessage`,
  // `listResponseMessage`, or the modern `interactiveResponseMessage`) —
  // whichever it was, `ctx.buttonReply`/`ctx.listReply` above already
  // normalized it down to a plain `.id`, so we just use that here too.
  const tapId = state.buttonReply?.id ?? state.listReply?.id ?? null;
  state.text = tapId ?? extractText(rawMessage);
  const parsed = tapId
    ? parseNativeFlowCommand(tapId, botConfig.prefix)
    : parseCommand(state.text, botConfig.prefix);
  state.command = parsed.command;
  state.args = parsed.args;

  /** Whether the sender is listed in Bot({ owners: [...] }). */
  state.isOwner = (botConfig.owners ?? []).includes(state.sender);

  return state;
}

/** Builds the type-specific convenience fields (`ctx.location`, `ctx.poll`, …). */
function deriveTypeSpecificFields(type, content) {
  const fields = {};

  if (type === "location" || type === "liveLocation") {
    fields.location = {
      latitude: content.degreesLatitude,
      longitude: content.degreesLongitude,
      name: content.name || null,
      address: content.address || null,
    };
  }

  if (type === "contact") {
    fields.contact = {
      displayName: content.displayName || null,
      vcard: content.vcard,
    };
  }

  if (type === "contacts") {
    fields.contacts = (content.contacts ?? []).map((c) => ({
      displayName: c.displayName || null,
      vcard: c.vcard,
    }));
  }

  if (type === "poll") {
    fields.poll = {
      name: content.name,
      options: (content.options ?? []).map((o) => o.optionName),
      selectableCount: content.selectableOptionsCount || 1,
    };
  }

  if (type === "buttonsResponse") {
    fields.buttonReply = {
      id: content.selectedButtonId,
      text: content.selectedDisplayText,
    };
  }
  if (type === "templateButtonReply") {
    fields.buttonReply = {
      id: content.selectedId,
      text: content.selectedDisplayText,
    };
  }
  if (type === "listResponse") {
    fields.listReply = {
      id: content.singleSelectReply?.selectedRowId,
      title: content.title,
    };
  }

  // Native-flow response — what `ctx.sendButtons()` / `ctx.sendListMenu()`
  // actually get back when tapped (WhatsApp's modern interactive-message
  // format, distinct from the legacy buttonsMessage/listMessage above).
  if (type === "interactiveResponse") {
    const id = extractNativeFlowId(content);
    fields.buttonReply = { id, name: content.nativeFlowResponseMessage?.name ?? null };
    // Also mirror onto listReply when it came from a list menu, so code
    // written against either legacy or native-flow list replies works.
    if (content.nativeFlowResponseMessage?.name === "single_select") {
      fields.listReply = { id, title: null };
    }
  }

  if (type === "groupInvite") {
    fields.groupInvite = {
      jid: content.groupJid,
      code: content.inviteCode,
      expiration: content.inviteExpiration,
      name: content.groupName,
    };
  }

  if (type === "protocol") {
    fields.protocol = describeProtocolMessage(content);
  }

  return fields;
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
    extractNativeFlowId(m.interactiveResponseMessage) ??
    ""
  );
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
