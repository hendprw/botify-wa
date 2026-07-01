/**
 * antiSpam middleware
 * -------------------
 * Global rate limiter: limits how many commands a single sender can trigger
 * within a rolling time window, regardless of which command they used.
 *
 * Algorithm: sliding window counter per sender.
 *   - Each sender gets a bucket: { count, windowStart }.
 *   - On every command: if now - windowStart >= windowMs, reset the bucket.
 *   - If count >= maxMessages after the reset check, deny and return false.
 *   - Otherwise increment count and continue.
 *
 * This is intentionally coarser than the per-command cooldown: it's a
 * last-resort spam brake, not a gameplay mechanic.
 *
 * Stale buckets (senders who haven't sent anything in > windowMs) are
 * pruned lazily on lookup and periodically via a background sweep.
 */

/**
 * @param {{
 *   windowMs?:    number,  // rolling window size in ms (default: 5000)
 *   maxMessages?: number,  // max commands per sender per window (default: 5)
 *   message?: string | ((ctx) => string),
 *   sweepIntervalMs?: number,  // cleanup interval (default: 60_000)
 * }} [opts]
 * @returns {(ctx: import('../Context.js').Context) => false | void}
 */
export function antiSpam(opts = {}) {
  const windowMs = opts.windowMs ?? 5_000;
  const maxMessages = opts.maxMessages ?? 5;
  const sweepMs = opts.sweepIntervalMs ?? 60_000;

  const defaultMsg = `🚫 Slow down! You're sending commands too fast.`;

  /** @type {Map<string, { count: number, windowStart: number }>} */
  const buckets = new Map();

  const sweepTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, bucket] of buckets) {
      if (bucket.windowStart < cutoff) buckets.delete(k);
    }
  }, sweepMs);

  if (sweepTimer.unref) sweepTimer.unref();

  return (ctx) => {
    if (!ctx.command) return;

    const now = Date.now();
    const key = ctx.sender;
    let bucket = buckets.get(key);

    // New sender or expired window — reset.
    if (!bucket || now - bucket.windowStart >= windowMs) {
      bucket = { count: 0, windowStart: now };
      buckets.set(key, bucket);
    }

    bucket.count++;

    if (bucket.count > maxMessages) {
      const text =
        typeof opts.message === "function"
          ? opts.message(ctx)
          : (opts.message ?? defaultMsg);

      // Fire-and-forget — we don't await here so the chain stops
      // immediately without waiting for the WA send round-trip.
      ctx.reply(text).catch(() => {});
      return false;
    }
  };
}
