/**
 * group-info
 * ----------
 * Group-metadata lookups (cached per-Context so a single incoming message
 * never fetches it twice) and small human-readable descriptions.
 */

export const groupInfoMethods = {
  /**
   * Fetches (and caches) this chat's group metadata. Returns `null` outside
   * of groups, or if the fetch fails (e.g. bot was removed from the group).
   */
  async _getGroupMetadata() {
    if (this.chatType !== "group") return null;
    if (this._groupMetadataCache !== undefined) return this._groupMetadataCache;

    try {
      this._groupMetadataCache = await this.sock.groupMetadata(this.from);
    } catch {
      this._groupMetadataCache = null;
    }
    return this._groupMetadataCache;
  },

  /**
   * Whether the sender is an admin (or superadmin) of the current group.
   * Always `false` outside of groups.
   */
  async isGroupAdmin() {
    const metadata = await this._getGroupMetadata();
    if (!metadata) return false;

    const ids = [this.sender, this.senderLid, this.senderPn].filter(Boolean);
    const participant = metadata.participants.find((p) => ids.includes(p.id));
    return (
      !!participant &&
      (participant.admin === "admin" || participant.admin === "superadmin")
    );
  },

  /**
   * The current group's display name (its "subject"). Returns `null`
   * outside of groups or if metadata couldn't be fetched.
   */
  async getGroupName() {
    const metadata = await this._getGroupMetadata();
    return metadata?.subject ?? null;
  },

  /**
   * A human-readable one-liner describing where this message came from,
   * handy for logging: e.g. `group "Koalisi Community"` or `private chat`.
   */
  async describeChat() {
    if (this.chatType === "group") {
      const name = await this.getGroupName();
      return `group "${name ?? this.from}"`;
    }
    if (this.chatType === "channel") return "channel";
    if (this.chatType === "broadcast") return "broadcast list";
    return "private chat";
  },
};
