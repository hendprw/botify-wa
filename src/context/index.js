/**
 * context (barrel)
 * ----------------
 * Everything needed to assemble the `Context` class lives under this
 * folder, split by concern so no single file mixes unrelated logic:
 *
 *   derive-message-state.js  → raw message → plain-data fields (ctx.from, ctx.type, ...)
 *   command-parsing.js       → text/id → { command, args }
 *   jid-utils.js             → JID classification helpers
 *   sending/text.js          → reply, send, sendCard
 *   sending/media.js         → sendImage, sendVideo, sendAudio, sendDocument, sendSticker, sendStickerPack, sendAlbum
 *   sending/interactive.js   → sendButtons, sendListMenu
 *   sending/rich.js          → sendTable(V2), sendRichList, sendCodeBlock(V2), sendLink(V2), sendRichMessage
 *   sending/other.js         → sendContact, sendLocation, sendPoll, sendPayment, sendEvent, sendPollResult, sendProduct, sendStatusMention
 *   media-transfer.js        → download, saveMedia (of the *incoming* message)
 *   message-actions.js       → react, edit(Message), delete(Message), pin, unpin, star, forward, isMentioned
 *   group-info.js            → isGroupAdmin, getGroupName, describeChat
 *
 * `Context.js` (one level up) owns the class itself — constructor +
 * `Object.assign(Context.prototype, ...)` — so this file only re-exports
 * the pieces it needs to wire together.
 */
export { deriveMessageState } from "./derive-message-state.js";

export { textSendingMethods } from "./sending/text.js";
export { mediaSendingMethods } from "./sending/media.js";
export { interactiveSendingMethods } from "./sending/interactive.js";
export { richSendingMethods } from "./sending/rich.js";
export { otherSendingMethods } from "./sending/other.js";
export { mediaTransferMethods } from "./media-transfer.js";
export { messageActionMethods } from "./message-actions.js";
export { groupInfoMethods } from "./group-info.js";
