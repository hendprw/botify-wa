/**
 * media
 * -----
 * Thin, framework-friendly wrapper around the vendored core's media
 * download utility, plus a helper to normalise "give me an image from
 * anywhere" input into the shape `sock.sendMessage` expects.
 */
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { downloadMediaMessage, extractImageThumb } from "../vendor/core/lib/index.js";

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

/**
 * Turns "any image" (Buffer, local file path, or http(s) URL) into a small
 * JPEG thumbnail Buffer — the shape `jpegThumbnail` fields on the proto
 * (interactive-message headers, location cards, etc.) expect.
 *
 * Unlike `resolveMediaSource()` (which just wraps a source for WA's normal
 * media-upload pipeline), this actually resizes + JPEG-encodes the image,
 * since `jpegThumbnail` is embedded inline in the message rather than
 * uploaded, and WA expects it small (default width mirrors what the core
 * generates for its own auto-thumbnails).
 *
 * @param {Buffer | string} source
 * @param {number} [width] Thumbnail width in px (default 192 — matches the
 *   core's own convention for embedded, non-uploaded thumbnails like link
 *   previews; safe and reliably accepted by WhatsApp). This field is
 *   embedded directly in the message rather than uploaded, so WA caps it
 *   hard — confirmed safe up to ~300px, confirmed rejected (falls back to
 *   a generic placeholder icon) at 400px. If you need a genuinely crisp
 *   image, use an `image` header (normal media upload, no such cap) with
 *   a Maps-link button instead of `location` — see the `locationhdbuttons`
 *   example in examples/simple-bot.js.
 * @returns {Promise<Buffer>}
 */
export async function resolveThumbnail(source, width = 730) {
  if (source === null || source === undefined) {
    throw new TypeError("Thumbnail source is required");
  }
  let input = source;
  if (typeof source === "string" && /^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch thumbnail from ${source}: ${res.status}`);
    }
    input = Buffer.from(await res.arrayBuffer());
  }
  const { buffer } = await extractImageThumb(input, width);
  return buffer;
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