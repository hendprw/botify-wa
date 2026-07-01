/**
 * PluginManager
 * -------------
 * Registers commands and middleware, then dispatches incoming messages
 * to the right handler.
 *
 * Cooldown and permission logic have been moved to built-in middlewares
 * (src/middlewares/cooldown.js and src/middlewares/permission.js).
 * PluginManager's job is now strictly:
 *   1. Store command definitions.
 *   2. Attach the matched command entry to ctx._commandEntry so middlewares
 *      can read per-command opts (cooldown ms, owner flag, admin flag).
 *   3. Run the middleware chain.
 *   4. Call the handler if the chain wasn't stopped.
 *   5. Return a typed result object — never throw.
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
  }

  /**
   * Register a command.
   * @param {string} name - command name without prefix (e.g. "ping")
   * @param {(ctx: import('./Context.js').Context) => any} handler
   * @param {{
   *   description?: string,
   *   aliases?:     string[],
   *   cooldown?:    number,   // ms — read by the cooldown middleware
   *   owner?:       boolean,  // read by the permission middleware
   *   admin?:       boolean   // read by the permission middleware
   * }} [opts]
   */
  command(name, handler, opts = {}) {
    const entry = {
      handler,
      description: opts.description ?? "",
      cooldown:    opts.cooldown    ?? 0,
      owner:       opts.owner       ?? false,
      admin:       opts.admin       ?? false,
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

  /** List all unique registered commands (deduplicates aliases). */
  list() {
    const seen = new Set();
    const out  = [];
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
        cooldown:    entry.cooldown,
        owner:       entry.owner,
        admin:       entry.admin,
      });
    }
    return out;
  }

  has(name) {
    return this.commands.has(name.toLowerCase());
  }

  /**
   * Attach command entry, run middlewares, then call the handler.
   * Never throws — errors are caught and returned as a result object.
   *
   * @param {string} name
   * @param {import('./Context.js').Context} ctx
   * @returns {Promise<
   *   | { status: "not_found" }
   *   | { status: "stopped" }
   *   | { status: "ok" }
   *   | { status: "error", error: unknown }
   * >}
   */
  async dispatch(name, ctx) {
    const key   = name.toLowerCase();
    const entry = this.commands.get(key);
    if (!entry) return { status: "not_found" };

    try {
      // Attach command metadata to ctx so middlewares (cooldown, permission)
      // can read per-command options without needing a registry reference.
      ctx._commandEntry = entry;

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
