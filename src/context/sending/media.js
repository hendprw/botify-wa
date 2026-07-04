/**
 * sending/media
 * -------------
 * All outbound media types: image/video/audio/document/sticker, sticker
 * packs, and albums (multi-image/video galleries).
 */
import { makeStickerPack } from "../../../vendor/core/lib/index.js";
import { resolveMediaSource } from "../../media.js";

export const mediaSendingMethods = {
  /** Send an image. `source`: Buffer, local file path, http(s) URL, or `{ url }`/`{ stream }`. */
  async sendImage(source, opts = {}) {
    const { caption, quoted, ...rest } = opts;
    return this.send(
      { image: resolveMediaSource(source), caption, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  },

  /** Send a video. Pass `{ gifPlayback: true }` to loop it like a GIF. */
  async sendVideo(source, opts = {}) {
    const { caption, quoted, ...rest } = opts;
    return this.send(
      { video: resolveMediaSource(source), caption, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  },

  /** Send audio. Pass `{ ptt: true }` to send as a voice note. */
  async sendAudio(source, opts = {}) {
    const { quoted, mimetype = "audio/mp4", ptt = false, ...rest } = opts;
    return this.send(
      { audio: resolveMediaSource(source), mimetype, ptt, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  },

  /** Send a document/file. */
  async sendDocument(source, opts = {}) {
    const {
      quoted,
      mimetype = "application/octet-stream",
      fileName = "file",
      caption,
      ...rest
    } = opts;
    return this.send(
      { document: resolveMediaSource(source), mimetype, fileName, caption, ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  },

  /** Send a sticker (must be a valid animated/static WebP for best results). */
  async sendSticker(source, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.send(
      { sticker: resolveMediaSource(source), ...rest },
      quoted === false ? {} : { quoted: this.raw }
    );
  },

  /** Send a sticker pack (multiple stickers grouped together). */
  async sendStickerPack({ name, publisher, description, stickers, cover }, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.send(
      makeStickerPack({ name, publisher, description, stickers, cover }),
      { ...(quoted === false ? {} : { quoted: this.raw }), ...rest }
    );
  },

  /**
   * Send an album (multiple images/videos grouped into one gallery message).
   * @param {Array<{ image?: any, video?: any, caption?: string }>} items
   */
  async sendAlbum(items, opts = {}) {
    const { quoted, ...rest } = opts;
    const album = items.map((item) => {
      const out = { ...item };
      if (out.image) out.image = resolveMediaSource(out.image);
      if (out.video) out.video = resolveMediaSource(out.video);
      return out;
    });
    return this.send(
      { albumMessage: album },
      { ...(quoted === false ? {} : { quoted: this.raw }), ...rest }
    );
  },
};
