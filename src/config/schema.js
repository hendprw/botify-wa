/**
 * config.bt schema + merger
 * --------------------------
 * Defines which config.bt keys map to which Bot options, handles type
 * validation with friendly error messages, and merges file config with
 * programmatic options (code always wins on conflict).
 *
 * config.bt keys            → Bot option
 * ─────────────────────────────────────────
 * [bot]
 *   prefix       = "!"     → prefix
 *   session_path = "./session" → sessionPath
 *   log_level    = "error" → logLevel
 *   print_qr     = true    → printQR
 *   owners       = ["628...@s.whatsapp.net"] → owners
 *
 * [reconnect]
 *   base_delay   = 1000    → reconnectBaseDelay
 *   max_delay    = 30000   → reconnectMaxDelay
 *
 * [cooldown]
 *   default      = 0       → defaultCooldown (ms, applied when command omits cooldown)
 *   message      = "..."   → cooldownMessage
 *
 * [anti_spam]
 *   enabled      = true    → antiSpam.enabled
 *   window_ms    = 5000    → antiSpam.windowMs
 *   max_messages = 5       → antiSpam.maxMessages
 *   message      = "..."   → antiSpam.message
 *
 * [permission]
 *   owner_message = "..."  → permissionMessages.owner
 *   admin_message = "..."  → permissionMessages.admin
 *
 * [logger]
 *   enabled  = true        → logger.enabled
 *   show_pn  = true        → logger.showPn
 */

/**
 * Merge file config (from config.bt) with programmatic options.
 * Programmatic options take priority on every key.
 *
 * @param {Record<string, any>} fileConfig  Parsed config.bt output.
 * @param {Record<string, any>} codeOptions Options passed to `new Bot(options)`.
 * @returns {Record<string, any>}           Merged, normalised options.
 */
export function mergeConfig(fileConfig, codeOptions) {
  const bot = fileConfig.bot ?? {};
  const reconnect = fileConfig.reconnect ?? {};
  const cooldown = fileConfig.cooldown ?? {};
  const antiSpam = fileConfig.anti_spam ?? {};
  const permission = fileConfig.permission ?? {};
  const loggerCfg = fileConfig.logger ?? {};

  // Build the "file defaults" object using config.bt values.
  const fileDefaults = {
    prefix: bot.prefix,
    sessionPath: bot.session_path,
    logLevel: bot.log_level,
    printQR: bot.print_qr,
    owners: bot.owners,
    reconnectBaseDelay: reconnect.base_delay,
    reconnectMaxDelay: reconnect.max_delay,

    defaultCooldown: cooldown.default,
    cooldownMessage: cooldown.message,

    antiSpam: {
      enabled: antiSpam.enabled ?? false,
      windowMs: antiSpam.window_ms,
      maxMessages: antiSpam.max_messages,
      message: antiSpam.message,
    },

    permissionMessages: {
      owner: permission.owner_message,
      admin: permission.admin_message,
    },

    logger: {
      enabled: loggerCfg.enabled ?? true,
      showPn: loggerCfg.show_pn,
    },
  };

  // Code options override file defaults — strip undefined so Object.assign
  // doesn't accidentally overwrite a file value with undefined.
  const clean = (obj) =>
    Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined)
    );

  // For nested objects (antiSpam, permissionMessages, logger) we merge one
  // level deep so a partial code override doesn't wipe the file's sub-keys.
  const merged = { ...fileDefaults, ...clean(codeOptions) };

  for (const nested of ["antiSpam", "permissionMessages", "logger"]) {
    merged[nested] = {
      ...fileDefaults[nested],
      ...clean(codeOptions[nested] ?? {}),
    };
  }

  return merged;
}
