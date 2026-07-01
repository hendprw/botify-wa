/**
 * PluginManager
 * -------------
 * Registers commands and middleware, then dispatches incoming messages
 * to the right handler. This is the "framework" layer that the core protocol
 * itself doesn't provide out of the box.
 */
export class PluginManager {
  constructor() {
    /** @type {Map<string, { handler: Function, description?: string }>} */
    this.commands = new Map();
    /** @type {Array<Function>} */
    this.middlewares = [];
  }

  /**
   * Register a command.
   * @param {string} name - command name, without prefix (e.g. "ping")
   * @param {(ctx: import('./Context.js').Context) => any} handler
   * @param {{ description?: string, aliases?: string[] }} [opts]
   */
  command(name, handler, opts = {}) {
    this.commands.set(name.toLowerCase(), {
      handler,
      description: opts.description ?? "",
    });
    for (const alias of opts.aliases ?? []) {
      this.commands.set(alias.toLowerCase(), {
        handler,
        description: opts.description ?? "",
      });
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
    return [...this.commands.entries()].map(([name, c]) => ({
      name,
      description: c.description,
    }));
  }

  has(name) {
    return this.commands.has(name.toLowerCase());
  }

  /**
   * Run middlewares then the matched command, in order.
   * @param {string} name
   * @param {import('./Context.js').Context} ctx
   */
  async dispatch(name, ctx) {
    for (const mw of this.middlewares) {
      const result = await mw(ctx);
      if (result === false) return;
    }

    const entry = this.commands.get(name.toLowerCase());
    if (!entry) return false;

    await entry.handler(ctx);
    return true;
  }
}
