/**
 * messageTypes
 * ------------
 * Maps a raw WA message (`rawMessage.message`) to a friendly Botify type
 * string, plus the inner content object for that type.
 *
 * Uses the vendored core's own `getContentType` / `normalizeMessageContent`
 * so ephemeral messages, view-once wrappers (v1/v2/v3), edited-message
 * wrappers, and "document with caption" wrappers are all unwrapped
 * automatically — the returned type/content always describes the *real*
 * message, not the envelope around it.
 *
 * Covers every message type a bot realistically needs to branch on. Types
 * that exist in the protocol but aren't meaningful for bot logic (delivery
 * receipts, history sync payloads, low-level sender-key distribution, etc.)
 * fall through to "unsupported" rather than getting their own case.
 */
import {
  getContentType,
  normalizeMessageContent,
} from "../../vendor/core/lib/index.js";

/** Raw WAProto content key → friendly Botify `ctx.type`. */
const TYPE_MAP = {
  conversation: "text",
  extendedTextMessage: "text",

  imageMessage: "image",
  videoMessage: "video",
  ptvMessage: "video", // "video note" — still a video under the hood
  audioMessage: "audio", // ctx.isPtt distinguishes voice notes
  stickerMessage: "sticker",
  documentMessage: "document",

  contactMessage: "contact",
  contactsArrayMessage: "contacts",
  locationMessage: "location",
  liveLocationMessage: "liveLocation",

  pollCreationMessage: "poll",
  pollCreationMessageV2: "poll",
  pollCreationMessageV3: "poll",
  pollCreationMessageV4: "poll",
  pollCreationMessageV5: "poll",
  pollCreationMessageV6: "poll",
  pollUpdateMessage: "pollUpdate",

  reactionMessage: "reaction",

  buttonsMessage: "buttons",
  buttonsResponseMessage: "buttonsResponse",
  listMessage: "list",
  listResponseMessage: "listResponse",
  templateMessage: "template",
  templateButtonReplyMessage: "templateButtonReply",
  interactiveMessage: "interactive",
  interactiveResponseMessage: "interactiveResponse",

  groupInviteMessage: "groupInvite",
  productMessage: "product",
  orderMessage: "order",
  eventMessage: "event",

  protocolMessage: "protocol", // edit / delete(revoke) / disappearing-mode change
  call: "call",
};

/** Content keys that represent an actual media attachment. */
const MEDIA_TYPES = new Set(["image", "video", "audio", "sticker", "document"]);

/**
 * @param {object | null | undefined} rawMessageContent  `rawMessage.message`
 * @returns {{ type: string, key: string | null, content: object | null }}
 */
export function detectMessageType(rawMessageContent) {
  const normalized = normalizeMessageContent(rawMessageContent);
  if (!normalized) return { type: "unknown", key: null, content: null };

  const key = getContentType(normalized);
  if (!key) return { type: "unknown", key: null, content: null };

  const content = normalized[key];
  const type = TYPE_MAP[key] ?? "unsupported";

  return { type, key, content: content ?? {} };
}

/** Whether a Botify `type` string represents a downloadable media attachment. */
export function isMediaType(type) {
  return MEDIA_TYPES.has(type);
}

/**
 * Best-effort plain-text extraction — used for `ctx.text` / quoted text.
 * Falls back through captions so `!command` still works if someone sends
 * an image/video/document with the command in the caption.
 */
export function extractPlainText(rawMessageContent) {
  const normalized = normalizeMessageContent(rawMessageContent);
  if (!normalized) return "";
  return (
    normalized.conversation ??
    normalized.extendedTextMessage?.text ??
    normalized.imageMessage?.caption ??
    normalized.videoMessage?.caption ??
    normalized.documentMessage?.caption ??
    normalized.buttonsResponseMessage?.selectedDisplayText ??
    normalized.listResponseMessage?.title ??
    normalized.templateButtonReplyMessage?.selectedDisplayText ??
    extractNativeFlowId(normalized.interactiveResponseMessage) ??
    ""
  );
}

/**
 * Native-flow buttons/list menus (`interactiveMessage`, sent via
 * `ctx.sendButtons()` / `ctx.sendListMenu()`) don't reply with a
 * `selectedDisplayText` — WhatsApp echoes back an `interactiveResponseMessage`
 * whose `nativeFlowResponseMessage.paramsJson` is a JSON string containing
 * the tapped button/row's `id`. This pulls that `id` out (or `null` if the
 * message isn't a native-flow response, or the JSON is malformed).
 */
export function extractNativeFlowId(interactiveResponseMessage) {
  const paramsJson = interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (!paramsJson) return null;
  try {
    return JSON.parse(paramsJson)?.id ?? null;
  } catch {
    return null;
  }
}