import { logger }     from "../middlewares/logger.js";
import { cooldown }   from "../middlewares/cooldown.js";
import { permission } from "../middlewares/permission.js";
import { antiSpam }   from "../middlewares/antiSpam.js";

/**
 * register-builtins
 * -----------------
 * Registers Botify's built-in middlewares onto `this.plugins`, in the
 * order the framework guarantees:
 *
 *   1. logger      — log first so every attempt is recorded, even blocked ones
 *   2. antiSpam    — global rate limit before any per-command check
 *   3. permission  — owner / admin gate
 *   4. cooldown    — per-user per-command throttle
 *   (user middlewares added via bot.use() run after all of the above)
 *
 * Called once from the Bot constructor, after `this.options` has been
 * normalized and `this.plugins` has been created.
 */
export const registerBuiltinsMethods = {
  _registerBuiltinMiddlewares() {
    this.plugins.use(
      logger({
        enabled: this.options.logger.enabled,
        showPn:  this.options.logger.showPn,
        logFn:   this.options.logger.logFn,
        format:  this.options.logger.format,
      })
    );

    if (this.options.antiSpam.enabled) {
      this.plugins.use(
        antiSpam({
          windowMs:    this.options.antiSpam.windowMs,
          maxMessages: this.options.antiSpam.maxMessages,
          message:     this.options.antiSpam.message,
        })
      );
    }

    this.plugins.use(
      permission({
        ownerMessage: this.options.permissionMessages.owner,
        adminMessage:  this.options.permissionMessages.admin,
        emitEvent: (ctx, reason) => this._emit("noPermission", ctx, reason),
      })
    );

    this.plugins.use(
      cooldown({
        defaultCooldown: this.options.defaultCooldown,
        message:         this.options.cooldownMessage,
        emitEvent: (ctx, remainingMs) => this._emit("cooldown", ctx, remainingMs),
      })
    );
  },
};
