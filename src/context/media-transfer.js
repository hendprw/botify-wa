/**
 * media-transfer
 * --------------
 * Downloading media attached to the *incoming* triggering message
 * (as opposed to `sending/media.js`, which is for outbound media).
 */
import { downloadMedia, saveMedia } from "../media.js";

export const mediaTransferMethods = {
  /**
   * Download this message's media attachment.
   * @param {{ asStream?: boolean }} [opts] `asStream: true` for large files.
   * @returns {Promise<Buffer | NodeJS.ReadableStream>}
   */
  async download(opts) {
    if (!this.isMedia) {
      throw new Error(`Message of type "${this.type}" has no media to download`);
    }
    return downloadMedia(this.sock, this.raw, opts);
  },

  /** Download this message's media straight to disk. Returns the filePath. */
  async saveMedia(filePath, opts) {
    if (!this.isMedia) {
      throw new Error(`Message of type "${this.type}" has no media to download`);
    }
    return saveMedia(this.sock, this.raw, filePath, opts);
  },
};
