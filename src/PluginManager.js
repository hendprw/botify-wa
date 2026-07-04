/**
 * PluginManager
 * -------------
 * Registers commands and middleware, then dispatches incoming messages
 * to the right handler.
 *
 * Cooldown and permission logic have been moved to built-in middlewares
 * (src/middlewares/cooldown.js and src/middlewares/permission.js).
 * PluginManager's job is now strictly:
 *   1. Store command definitions (including nested sub-commands).
 *   2. Resolve which entry (top-level command or matched sub-command)
 *      applies to this message, and attach it to ctx._commandEntry so
 *      middlewares can read its opts (cooldown ms, owner flag, admin flag)
 *      without caring whether it came from a top-level command or a sub.
 *   3. Run the middleware chain.
 *   4. Call the handler if the chain wasn't stopped.
 *   5. Return a typed result object — never throw.
 */

/**
 * Returned by `PluginManager#command()` (and thus `bot.command()`) so
 * nested sub-commands can be registered fluently:
 *
 *   bot.command("admin", adminHandler, { admin: true })
 *     .sub("ban",  banHandler,  { description: "Ban member" })
 *     .sub("kick", kickHandler, { description: "Kick member" });
 *
 * Sub-commands inherit `owner`/`admin`/`cooldown` from their parent unless
 * they explicitly override it in their own opts — so `!admin ban` is
 * admin-only "for free" because `admin` declared `{ admin: true }`, but a
 * sub can still loosen/tighten that individually.
 *
 * Note: `bot.command()` used to return the `Bot` instance itself (for
 * `.command().command()`-style chaining). It now returns this builder
 * instead — chain `.sub()` on it, or just call `bot.command()` again as a
 * separate statement (this is how every built-in template already does it).
 */
export class CommandBuilder {
  constructor(manager, entry) {
    this._manager = manager;
    this._entry   = entry;
  }

  /**
   * Register a nested sub-command (e.g. "ban" under "admin" → `!admin ban`).
   * @param {string} name
   * @param {(ctx: import('./Context.js').Context) => any} handler
   * @param {{
   *   description?: string,
   *   aliases?:     string[],
   *   cooldown?:    number,
   *   owner?:       boolean,
   *   admin?:       boolean
   * }} [opts]
   * @returns {CommandBuilder} itself, so `.sub()` calls can be chained
   */
  sub(name, handler, opts = {}) {
    this._manager._registerSub(this._entry, name, handler, opts);
    return this;
  }
}

export class PluginManager {
  constructor() {
    /**
     * @type {Map<string, {
     *   handler: Function,
     *   description?: string,
     *   category?: string | null,
     *   cooldown?: number,
     *   owner?: boolean,
     *   admin?: boolean,
     *   subcommands: Map<string, object>
     * }>}
     */
    this.commands = new Map();
    /** @type {Array<Function>} */
    this.middlewares = [];
  }

  /**
   * Register a top-level command.
   * @param {string} name - command name without prefix (e.g. "ping")
   * @param {(ctx: import('./Context.js').Context) => any} handler
   * @param {{
   *   description?: string,
   *   aliases?:     string[],
   *   category?:    string,   // grouping label, e.g. "Media" — read by !menu
   *   cooldown?:    number,   // ms — read by the cooldown middleware
   *   owner?:       boolean,  // read by the permission middleware
   *   admin?:       boolean   // read by the permission middleware
   * }} [opts]
   * @returns {CommandBuilder} use `.sub()` on it to add nested sub-commands
   */
  command(name, handler, opts = {}) {
    const entry = {
      handler,
      description: opts.description ?? "",
      category:    opts.category    ?? null,
      cooldown:    opts.cooldown    ?? 0,
      owner:       opts.owner       ?? false,
      admin:       opts.admin       ?? false,
      subcommands: new Map(),
    };

    this.commands.set(name.toLowerCase(), entry);
    for (const alias of opts.aliases ?? []) {
      this.commands.set(alias.toLowerCase(), entry);
    }
    return new CommandBuilder(this, entry);
  }

  /**
   * Internal: register a sub-command onto an existing parent entry.
   * Not called directly — use the `CommandBuilder` returned by `command()`.
   * @param {object} parentEntry
   * @param {string} name
   * @param {Function} handler
   * @param {object} opts
   */
  _registerSub(parentEntry, name, handler, opts = {}) {
    const subEntry = {
      handler,
      description: opts.description ?? "",
      // Inherit gating/cooldown from the parent by default — `!admin` being
      // admin-only should mean `!admin ban` is too, unless overridden here.
      cooldown: opts.cooldown ?? parentEntry.cooldown ?? 0,
      owner:    opts.owner    ?? parentEntry.owner     ?? false,
      admin:    opts.admin    ?? parentEntry.admin     ?? false,
      parent:   parentEntry,
    };

    parentEntry.subcommands.set(name.toLowerCase(), subEntry);
    for (const alias of opts.aliases ?? []) {
      parentEntry.subcommands.set(alias.toLowerCase(), subEntry);
    }
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

  /** List all unique registered top-level commands (deduplicates aliases). */
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
        category:    entry.category,
        cooldown:    entry.cooldown,
        owner:       entry.owner,
        admin:       entry.admin,
        subcommands: this._listSubcommands(entry),
      });
    }
    return out;
  }

  /**
   * Same as `list()`, but grouped by `category` (insertion-ordered).
   * Commands without a `category` are grouped under `uncategorized`.
   * @returns {Map<string, Array<object>>}
   */
  listByCategory() {
    const grouped = new Map();
    for (const cmd of this.list()) {
      const cat = cmd.category ?? "uncategorized";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat).push(cmd);
    }
    return grouped;
  }

  /** Dedup + shape a parent entry's sub-commands the same way `list()` does. */
  _listSubcommands(entry) {
    if (!entry.subcommands || entry.subcommands.size === 0) return [];
    const seen = new Set();
    const out  = [];
    for (const [key, sub] of entry.subcommands.entries()) {
      if (seen.has(sub)) continue;
      seen.add(sub);
      const aliases = [...entry.subcommands.entries()]
        .filter(([k, v]) => v === sub && k !== key)
        .map(([k]) => k);
      out.push({
        name: key,
        aliases,
        description: sub.description,
        cooldown:    sub.cooldown,
        owner:       sub.owner,
        admin:       sub.admin,
      });
    }
    return out;
  }

  has(name) {
    return this.commands.has(name.toLowerCase());
  }

  /**
   * Given a top-level entry and the parsed args, figure out whether the
   * first arg matches a registered sub-command. Doesn't mutate anything.
   * @param {object} entry
   * @param {string[]} args
   * @returns {{ target: object, subcommand: string|null, args: string[] }}
   */
  _resolveTarget(entry, args) {
    if (entry.subcommands.size && args.length) {
      const subKey   = args[0].toLowerCase();
      const subEntry = entry.subcommands.get(subKey);
      if (subEntry) {
        return { target: subEntry, subcommand: subKey, args: args.slice(1) };
      }
    }
    // No sub-command matched (or none registered) — dispatch to the
    // top-level handler with args untouched, e.g. so it can print usage.
    return { target: entry, subcommand: null, args };
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

    const resolved = this._resolveTarget(entry, ctx.args);

    try {
      // Attach the *resolved* entry (parent or matched sub) to ctx so
      // middlewares (cooldown, permission) transparently apply the right
      // gating/cooldown, whether this is "!admin" or "!admin ban".
      ctx._commandEntry = resolved.target;
      // Exposed for handlers/middlewares/logging: null when no sub matched.
      ctx.subcommand = resolved.subcommand;

      for (const mw of this.middlewares) {
        const result = await mw(ctx);
        if (result === false) return { status: "stopped" };
      }

      // Only shift args past the matched sub-command name right before
      // calling the handler — built-in middlewares (e.g. the logger) still
      // see ctx.args exactly as typed, sub-command name included.
      const originalArgs = ctx.args;
      if (resolved.subcommand) ctx.args = resolved.args;
      try {
        await resolved.target.handler(ctx);
      } finally {
        ctx.args = originalArgs;
      }

      return { status: "ok" };
    } catch (error) {
      return { status: "error", error };
    }
  }
}