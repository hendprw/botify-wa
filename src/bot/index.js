/**
 * bot (barrel)
 * ------------
 * Everything the `Bot` class mixes onto its prototype lives under this
 * folder, split by concern the same way `./context/` is:
 *
 *   register-builtins.js → built-in middleware registration (logger →
 *                           antiSpam → permission → cooldown), called once
 *                           from the constructor
 *   connection.js         → auth state, socket creation, connection.update
 *                           handling (QR, ready), wiring dispatch/reconnect
 *   dispatch.js            → messages.upsert → Context → PluginManager#dispatch
 *   reconnect.js            → exponential-backoff reconnect on unexpected close
 *
 * `Bot.js` (one level up) owns the class itself — constructor, public API
 * (command/use/on/onError), and the small `_emit`/`_handleError` glue used
 * by all of the mixins above — plus
 * `Object.assign(Bot.prototype, ...)` to wire them together.
 */
export { registerBuiltinsMethods } from "./register-builtins.js";
export { connectionMethods }       from "./connection.js";
export { dispatchMethods }         from "./dispatch.js";
export { reconnectMethods }        from "./reconnect.js";
