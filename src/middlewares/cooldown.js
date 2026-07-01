/**
 * cooldown middleware
 * -------------------
 * Enforces a per-user, per-command cooldown.
 *
 * Priority order (highest to lowest):
 *   1. opts.cooldown passed to bot.command()  — per-command override
 *   2. defaultCooldown from config.bt / Bot() — global default
 *   3. 0 (no cooldown)
 *
 * When a user triggers a cooldown the middleware emits the "cooldown" event
 * on the Bot instance and returns `false` to stop the middleware chain —
 * the command handler is never reached.
 *
 * The store is an in-memory Map keyed "commandName:senderJID". It never
 * grows unboundedly: entries are pruned lazily on each lookup once they've
 * expired, and a periodic sweep cleans up any remaining stale entries every
 * `sweepIntervalMs` milliseconds (default: 5 min).
 */

/**
 * @param {{
 *   defaultCooldown?: number,   // ms; 0 = disabled (default)
 *   message?: string | ((ctx, remainingMs: number) => string),
 *   sweepIntervalMs?: number,   // how often to prune expired entries (default: 300_000)
 *   emitEvent?: (ctx, remainingMs: number) => void,  // hook so Bot can emit "cooldown"
 * }} [opts]
 * @returns {(ctx: import('../Context.js').Context) => Promise<false | void>}
 */
export function cooldown(opts = {}) {
  const defaultMs = opts.defaultCooldown ?? 0;
  const sweepMs = opts.sweepIntervalMs ?? 300_000;
  const emitEvent = opts.emitEvent ?? (() => {});

  /** @type {Map<string, number>} key → expiry timestamp */
  const store = new Map();

  // Periodic sweep — remove entries whose cooldown has already expired.
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, expiry] of store) {
      if (expiry <= now) store.delete(k);
    }
  }, sweepMs);

  // Don't keep the process alive just for cleanup.
  if (sweepTimer.unref) sweepTimer.unref();

  return async (ctx) => {
    if (!ctx.command) return;

    // Resolve cooldown duration for this command.
    // ctx._commandEntry is attached by PluginManager before running middlewares.
    const commandMs = ctx._commandEntry?.cooldown ?? 0;
    const ms = commandMs > 0 ? commandMs : defaultMs;
    if (ms <= 0) return;

    const key = `${ctx.command}:${ctx.sender}`;
    const expiry = store.get(key) ?? 0;
    const now = Date.now();

    if (now < expiry) {
      const remainingMs = expiry - now;
      emitEvent(ctx, remainingMs);

      if (opts.message) {
        const text =
          typeof opts.message === "function"
            ? opts.message(ctx, remainingMs)
            : opts.message;
        await ctx.reply(text);
      }

      return false; // stop chain
    }

    // Record new expiry — set BEFORE running the handler so concurrent
    // messages from the same user don't both slip through.
    store.set(key, now + ms);
  };
}
