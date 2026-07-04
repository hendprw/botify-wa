/**
 * sending/interactive
 * -------------------
 * Native-flow interactive messages: quick-reply/url/copy buttons and
 * WhatsApp's native list-menu (`single_select`).
 */
import { resolveMediaSource, resolveThumbnail } from "../../media.js";

export const interactiveSendingMethods = {
  /**
   * Send native-flow buttons (quick reply / open URL / copy code).
   * Accepts either the raw `{ name, buttonParamsJson }` shape from the core,
   * or a friendlier shorthand per button:
   *   { type: "reply", text, id }
   *   { type: "url",   text, url }
   *   { type: "copy",  text, code }
   *
   * Routed through `content.interactiveButtons` (not `interactiveMessage`)
   * — that's the path the core wraps with the `messageSecret` that WhatsApp
   * needs to recognize a tap as a real interactive response. Without it,
   * `quick_reply`/`cta_url`/`cta_copy` taps silently fall back to a plain
   * text reply on the recipient's end and never reach your bot.
   * @param {{ title?: string, subtitle?: string, footer?: string, header?: string, image?, video?, document?, location?, thumbnail?, thumbnailWidth?, jpegThumbnail? }} content
   *   `title` is the main body text; `header` is the small line above it
   *   (matches what `interactiveMessage.title`/`.header` rendered as before).
   *   `image`/`video`/`document`/`location` are mutually exclusive — pick one
   *   to use as the card header. `thumbnail` (Buffer, local path, or http(s)
   *   URL) overrides the header's preview image — most useful with
   *   `location`, which otherwise shows WA's auto-generated map snapshot.
   *   `thumbnailWidth` controls how sharp it comes out (default 192px,
   *   matching the core's own convention for embedded thumbnails — going
   *   much higher, e.g. 400+, risks WA rejecting it and falling back to a
   *   generic placeholder icon). Use the raw `jpegThumbnail` (pre-encoded
   *   JPEG Buffer/base64) instead of `thumbnail` if you want to skip the
   *   resize step entirely.
   * @param {Array<object>} buttons  Each is either the raw `{ name, buttonParamsJson }`
   *   shape, or shorthand: `{ type: "reply"|"url"|"copy", ... }` (see
   *   `normalizeButton`), or `{ type: "list", text, sections }` for a native
   *   list-menu button (same `sections` shape as `sendListMenu()`).
   */
  async sendButtons(content, buttons, opts = {}) {
    const {
      title, subtitle, footer, header, image, video, document, location,
      mimetype, jpegThumbnail, thumbnail, thumbnailWidth = 192,
    } = content;
    const resolvedThumbnail = thumbnail
      ? await resolveThumbnail(thumbnail, thumbnailWidth)
      : jpegThumbnail;
    return this.send(
      {
        text: title,
        subtitle,
        footer,
        title: header,
        ...(image ? { image: resolveMediaSource(image) } : {}),
        ...(video ? { video: resolveMediaSource(video) } : {}),
        ...(document ? { document: resolveMediaSource(document) } : {}),
        ...(location ? { location } : {}),
        mimetype,
        jpegThumbnail: resolvedThumbnail,
        interactiveButtons: buttons.map(normalizeButton),
      },
      { quoted: this.raw, ...opts }
    );
  },

  /**
   * Send a WhatsApp list menu (native `single_select` interactive message).
   *
   * Unlike `sendButtons()`, this stays on the plain `interactiveMessage`
   * path (no `messageSecret` wrapping) — `single_select` list-row taps are
   * recognized fine without it, so there's no need for the extra wrapping.
   * @param {{ title?, footer?, header?, buttonText? }} content
   * @param {Array<{ title: string, rows: Array<{ title, id, description? }> }>} sections
   */
  async sendListMenu(content, sections, opts = {}) {
    const { title, footer, header, buttonText = "Menu" } = content;
    return this.send(
      {
        interactiveMessage: {
          title,
          footer,
          header,
          buttons: [
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({ title: buttonText, sections }),
            },
          ],
        },
      },
      { quoted: this.raw, ...opts }
    );
  },
};

/**
 * Normalizes one button for `ctx.sendButtons()`. Passes through the raw
 * `{ name, buttonParamsJson }` shape untouched; converts the friendly
 * shorthand (`{ type: "reply"|"url"|"copy"|"list", ... }`) into that shape.
 */
function normalizeButton(button) {
  if (button.name && button.buttonParamsJson) return button;

  switch (button.type) {
    case "reply":
      return {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: button.text, id: button.id }),
      };
    case "url":
      return {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({ display_text: button.text, url: button.url }),
      };
    case "copy":
      return {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({ display_text: button.text, copy_code: button.code }),
      };
    case "list":
      // Native list-menu button — tapping it opens the same row-picker UI
      // as `ctx.sendListMenu()`. `sections`: Array<{ title, rows: Array<{ title, id, description? }> }>.
      return {
        name: "single_select",
        buttonParamsJson: JSON.stringify({ title: button.text, sections: button.sections }),
      };
    default:
      throw new Error(`Unknown button type: "${button.type}". Use "reply", "url", "copy", or "list".`);
  }
}
