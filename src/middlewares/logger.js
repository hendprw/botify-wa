/**
 * logger middleware
 * ------------------
 * A ready-to-use command logger: who sent it, what chat it came from
 * (private / which group), and what command+args they ran. Built in so
 * production bots don't need to hand-roll this — just `bot.use(logger())`.
 *
 * Handles WhatsApp's LID (Linked ID, @lid) addressing automatically: it
 * always has *a* sender identifier to log (LID or phone-number JID,
 * whichever WhatsApp gave us), and optionally shows the real phone number
 * alongside it when available.
 *
 * Can be disabled via config.bt:
 *   [logger]
 *   enabled = false
 */

/**
 * @param {{
 *   enabled?: boolean,                  // set false to disable entirely (default: true)
 *   logFn?:   (line: string) => void,   // defaults to console.log
 *   showPn?:  boolean,                  // show phone number next to LID when known (default: true)
 *   format?:  (ctx: import('../Context.js').Context) => string | Promise<string>
 * }} [opts]
 * @returns {(ctx: import('../Context.js').Context) => Promise<void>}
 */
export function logger(opts = {}) {
  if (opts.enabled === false) return () => {};

  const logFn  = opts.logFn  ?? console.log;
  const showPn = opts.showPn ?? true;
  const format = opts.format ?? ((ctx) => defaultFormat(ctx, showPn));

  return async (ctx) => {
    if (!ctx.command) return;
    logFn(await format(ctx));
  };
}

async function defaultFormat(ctx, showPn) {
  const chat = await ctx.describeChat();
  const senderLabel = showPn
    ? `${ctx.sender}, pn: ${ctx.senderPn ? ctx.senderPn.split("@")[0] : "unknown"}`
    : ctx.sender;

  return `[cmd] ${ctx.pushName} (${senderLabel}) via ${chat} -> ${ctx.botConfig.prefix}${ctx.command} ${ctx.args.join(" ")}`.trimEnd();
}
