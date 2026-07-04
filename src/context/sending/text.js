/**
 * sending/text
 * ------------
 * The most basic outbound methods: plain replies, raw passthrough sends,
 * and the "link preview card" trick.
 */
import { resolveThumbnail, resolveHighQualityThumbnail } from "../../media.js";

export const textSendingMethods = {
  /** Reply in the same chat, quoting the triggering message. */
  async reply(text, opts = {}) {
    return this.sock.sendMessage(
      this.from,
      { text, ...opts },
      { quoted: this.raw }
    );
  },

  /** Send any core-compatible message content to the same chat. */
  async send(content, opts = {}) {
    return this.sock.sendMessage(this.from, content, opts);
  },

  /**
   * Send a lightweight "card" — text with a thumbnail/title/description
   * embedded directly in the message stanza, using the same mechanism as
   * WhatsApp's own link-preview cards. Unlike `image`/`video`/`document`,
   * this never touches WA's media CDN — the recipient sees the whole card
   * the instant the message arrives, at zero extra data cost.
   *
   * IMPORTANT: WhatsApp's client only renders the preview box when the
   * message text actually contains the matching link — there's no way
   * around that from the server side. So `url` is required, and it WILL
   * show up as visible, tappable blue text in the message (appended to
   * `text` automatically if not already present). If you need a card with
   * **no visible link at all**, use `sendButtons({ location, thumbnail }, …)`
   * instead — that renders its embedded thumbnail unconditionally, no URL
   * needed (see the `locationbuttons` example).
   *
   * By default this also uploads `thumbnail` to WA's media CDN the same
   * way WhatsApp's own client does for real link previews (a `thumbnail-link`
   * upload — see `resolveHighQualityThumbnail()` in `media.js`), so the
   * recipient's client re-fetches the actual full-resolution image instead
   * of only ever showing the small, quality-50 embedded `jpegThumbnail`.
   * That upload costs one network round-trip at send time; set
   * `highQuality: false` to skip it and stay fully local/zero-network
   * (same ~300px, blurrier-but-instant behavior as before). If the upload
   * fails for any reason (offline, WA media host hiccup, etc.), sendCard
   * silently falls back to the embedded-only thumbnail rather than throwing.
   *
   * @param {{ text?: string, title?: string, description?: string, thumbnail: Buffer|string, thumbnailWidth?: number, url: string, highQuality?: boolean }} content
   *   `thumbnail`: Buffer, local path, or http(s) URL of the card image.
   *   `url`: required — the link that makes WA render the card, shown as
   *   visible tappable text.
   *   `highQuality` (default `true`): upload to WA's CDN for a sharp,
   *   full-res preview image; `false` keeps the old embedded-only behavior.
   */
  async sendCard(content, opts = {}) {
    const {
      text = "", title, description, thumbnail, thumbnailWidth = 192, url,
      highQuality = true,
    } = content;
    if (!url) {
      throw new Error(
        'sendCard() requires a "url" — WhatsApp only renders the preview box when the message text contains a matching link. Use sendButtons({ location, thumbnail }, …) instead if you need a card with no visible link.'
      );
    }
    const jpegThumbnail = await resolveThumbnail(thumbnail, thumbnailWidth);
    let highQualityThumbnail;
    if (highQuality) {
      try {
        highQualityThumbnail = await resolveHighQualityThumbnail(this.sock, thumbnail);
      } catch (err) {
        this.sock?.logger?.debug?.(
          { err },
          "sendCard: high-quality thumbnail upload failed, falling back to embedded-only thumbnail"
        );
      }
    }
    const fullText = text.includes(url) ? text : `${text}${text ? "\n" : ""}${url}`;
    return this.send(
      {
        text: fullText,
        linkPreview: {
          "matched-text": url,
          title,
          description,
          jpegThumbnail,
          ...(highQualityThumbnail ? { highQualityThumbnail } : {}),
        },
      },
      { quoted: this.raw, ...opts }
    );
  },
};
