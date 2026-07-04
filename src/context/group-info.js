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
   * Whether the *bot itself* is an admin (or superadmin) of the current
   * group. Always `false` outside of groups. Handy as a guard before
   * actions that require it, e.g. `ctx.deleteMessage()`/`kick` on someone
   * else's message, or `ctx.pin()` in some group settings:
   *
   *   if (!(await ctx.isBotAdmin())) return ctx.reply("Bot harus jadi admin dulu.");
   */
  async isBotAdmin() {
    const metadata = await this._getGroupMetadata();
    if (!metadata || !this.botJid) return false;

    const participant = metadata.participants.find((p) => p.id === this.botJid);
    return (
      !!participant &&
      (participant.admin === "admin" || participant.admin === "superadmin")
    );
  },

  /**
   * All admin (and superadmin) JIDs in the current group, as a plain
   * array. Returns `[]` outside of groups or if metadata couldn't be
   * fetched. Handy for "notify all admins" / "mention all admins" style
   * commands.
   * @returns {Promise<string[]>}
   */
  async groupAdmins() {
    const metadata = await this._getGroupMetadata();
    if (!metadata) return [];

    return metadata.participants
      .filter((p) => p.admin === "admin" || p.admin === "superadmin")
      .map((p) => p.id);
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