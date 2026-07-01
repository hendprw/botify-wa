/**
 * media
 * -----
 * Thin, framework-friendly wrapper around the vendored core's media
 * download utility, plus a helper to normalise "give me an image from
 * anywhere" input into the shape `sock.sendMessage` expects.
 */
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { downloadMediaMessage } from "../vendor/core/lib/index.js";

/**
 * Download the media attached to a WA message (image/video/audio/sticker/
 * document — including inside view-once/ephemeral wrappers, which the core
 * unwraps automatically).
 *
 * @param {import('../vendor/core/lib/index.js').WASocket} sock
 * @param {import('../vendor/core/lib/index.js').proto.IWebMessageInfo} rawMessage
 *   A full WA message object (`{ key, message, ... }`) — either the
 *   triggering message (`ctx.raw`) or a reconstructed quoted message
 *   (`ctx.quoted.raw`).
 * @param {{ asStream?: boolean }} [opts]
 *   `asStream: true` returns a readable stream instead of buffering the
 *   whole file in memory — use this for large files.
 * @returns {Promise<Buffer | NodeJS.ReadableStream>}
 */
export async function downloadMedia(sock, rawMessage, opts = {}) {
  return downloadMediaMessage(
    rawMessage,
    opts.asStream ? "stream" : "buffer",
    {},
    {
      logger: sock?.logger,
      // Lets the core automatically re-fetch + retry once if WA's media
      // host returns 404/410 (link expired) — transparent to the caller.
      reuploadRequest: sock?.updateMediaMessage,
    }
  );
}

/**
 * Download media straight to disk. Streams internally, so it's memory-safe
 * for large files.
 * @returns {Promise<string>} the filePath, for convenient chaining
 */
export async function saveMedia(sock, rawMessage, filePath, opts = {}) {
  const stream = await downloadMedia(sock, rawMessage, {
    ...opts,
    asStream: true,
  });
  await pipeline(stream, createWriteStream(filePath));
  return filePath;
}

/**
 * Normalises a "media source" into whatever `sock.sendMessage`'s
 * `AnyMediaMessageContent` expects (`Buffer | { url } | { stream }`).
 *
 * Accepts:
 *   - a Buffer                      → passed through
 *   - a local file path (string)    → `{ url: path }` (core reads it via fs)
 *   - an http(s) URL (string)       → `{ url }` (core streams it)
 *   - a data: URL (string)          → `{ url }` (core decodes it)
 *   - an already-shaped object      → `{ url }` / `{ stream }` passed through
 */
export function resolveMediaSource(source) {
  if (source === null || source === undefined) {
    throw new TypeError("Media source is required");
  }
  if (typeof source === "string") return { url: source };
  return source;
}

/** Builds a minimal WhatsApp-compatible vCard from a simple {name, number}. */
export function toVcard({ name, number, organization }) {
  const waid = String(number).replace(/[^\d]/g, "");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    ...(organization ? [`ORG:${organization}`] : []),
    `TEL;type=CELL;type=VOICE;waid=${waid}:${waid}`,
    "END:VCARD",
  ];
  return lines.join("\n");
}