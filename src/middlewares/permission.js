/**
 * permission middleware
 * ---------------------
 * Enforces owner-only and group-admin-only gates for commands that declare
 * `{ owner: true }` or `{ admin: true }` in their options.
 *
 * The command metadata is attached to ctx._commandEntry by PluginManager
 * before the middleware chain runs, so this middleware can read it without
 * needing a reference to the command registry.
 *
 * When access is denied:
 *   - The "noPermission" event is emitted on the Bot instance.
 *   - An optional message is sent to the chat.
 *   - `false` is returned to stop the middleware chain.
 */

/**
 * @param {{
 *   ownerMessage?: string | ((ctx) => string),
 *   adminMessage?:  string | ((ctx) => string),
 *   emitEvent?: (ctx, reason: "owner" | "admin") => void,
 * }} [opts]
 * @returns {(ctx: import('../Context.js').Context) => Promise<false | void>}
 */
export function permission(opts = {}) {
  const emitEvent = opts.emitEvent ?? (() => {});

  const ownerMsg =
    opts.ownerMessage ?? "🚫 This command is owner-only.";
  const adminMsg =
    opts.adminMessage ?? "🚫 This command is for group admins only.";

  return async (ctx) => {
    if (!ctx.command) return;

    const entry = ctx._commandEntry;
    if (!entry) return;

    // ── owner gate ──────────────────────────────────────────────────────────
    if (entry.owner && !ctx.isOwner) {
      emitEvent(ctx, "owner");
      const text =
        typeof ownerMsg === "function" ? ownerMsg(ctx) : ownerMsg;
      await ctx.reply(text);
      return false;
    }

    // ── admin gate ──────────────────────────────────────────────────────────
    if (entry.admin) {
      const isAdmin = await ctx.isGroupAdmin();
      if (!isAdmin) {
        emitEvent(ctx, "admin");
        const text =
          typeof adminMsg === "function" ? adminMsg(ctx) : adminMsg;
        await ctx.reply(text);
        return false;
      }
    }
  };
}
