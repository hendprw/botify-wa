/**
 * PluginManager
 * -------------
 * Registers commands and middleware, then dispatches incoming messages
 * to the right handler. This is the "framework" layer that the core protocol
 * itself doesn't provide out of the box.
 *
 * Also owns cross-cutting command concerns that don't belong in the handler
 * itself: cooldowns and owner/admin permission gates.
 */
export class PluginManager {
  constructor() {
    /**
     * @type {Map<string, {
     *   handler: Function,
     *   description?: string,
     *   cooldown?: number,
     *   owner?: boolean,
     *   admin?: boolean
     * }>}
     */
    this.commands = new Map();
    /** @type {Array<Function>} */
    this.middlewares = [];
    /** @type {Map<string, number>} last-used timestamp, keyed "command:sender" */
    this.cooldowns = new Map();
  }

  /**
   * Register a command.
   * @param {string} name - command name, without prefix (e.g. "ping")
   * @param {(ctx: import('./Context.js').Context) => any} handler
   * @param {{
   *   description?: string,
   *   aliases?: string[],
   *   cooldown?: number,   // ms a user must wait between uses of this command
   *   owner?: boolean,     // only bot owners (see Bot({ owners })) can run this
   *   admin?: boolean      // only group admins can run this (no-op outside groups)
   * }} [opts]
   */
  command(name, handler, opts = {}) {
    const entry = {
      handler,
      description: opts.description ?? "",
      cooldown: opts.cooldown ?? 0,
      owner: opts.owner ?? false,
      admin: opts.admin ?? false,
    };

    this.commands.set(name.toLowerCase(), entry);
    for (const alias of opts.aliases ?? []) {
      this.commands.set(alias.toLowerCase(), entry);
    }
    return this;
  }

  /**
   * Register a middleware that runs before command dispatch.
   * Return `false` from a middleware to stop the chain.
   * @param {(ctx: import('./Context.js').Context) => any} fn
   */
  use(fn) {
    this.middlewares.push(fn);
    return this;
  }

  list() {
    const seen = new Set();
    const out = [];
    for (const [key, entry] of this.commands.entries()) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      const aliases = [...this.commands.entries()]
        .filter(([k, v]) => v === entry && k !== key)
        .map(([k]) => k);
      out.push({
        name: key,
        aliases,
        description: entry.description,
        cooldown: entry.cooldown,
        owner: entry.owner,
        admin: entry.admin,
      });
    }
    return out;
  }

  has(name) {
    return this.commands.has(name.toLowerCase());
  }

  /**
   * Run permission/cooldown checks, middlewares, then the matched command.
   * Never throws — errors are caught and returned as a result so the caller
   * (Bot) can route them to a single error-handling path.
   *
   * @param {string} name
   * @param {import('./Context.js').Context} ctx
   * @returns {Promise<
   *   | { status: "not_found" }
   *   | { status: "no_permission", reason: "owner" | "admin" }
   *   | { status: "cooldown", remainingMs: number }
   *   | { status: "stopped" }
   *   | { status: "ok" }
   *   | { status: "error", error: unknown }
   * >}
   */
  async dispatch(name, ctx) {
    const key = name.toLowerCase();
    const entry = this.commands.get(key);
    if (!entry) return { status: "not_found" };

    try {
      if (entry.owner && !ctx.isOwner) {
        return { status: "no_permission", reason: "owner" };
      }

      if (entry.admin) {
        const isAdmin = await ctx.isGroupAdmin();
        if (!isAdmin) return { status: "no_permission", reason: "admin" };
      }

      if (entry.cooldown > 0) {
        const cooldownKey = `${key}:${ctx.sender}`;
        const lastUsed = this.cooldowns.get(cooldownKey) ?? 0;
        const elapsed = Date.now() - lastUsed;

        if (elapsed < entry.cooldown) {
          return { status: "cooldown", remainingMs: entry.cooldown - elapsed };
        }
        this.cooldowns.set(cooldownKey, Date.now());
      }

      for (const mw of this.middlewares) {
        const result = await mw(ctx);
        if (result === false) return { status: "stopped" };
      }

      await entry.handler(ctx);
      return { status: "ok" };
    } catch (error) {
      return { status: "error", error };
    }
  }
}