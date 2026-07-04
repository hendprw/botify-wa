/**
 * command-parsing
 * ---------------
 * Pure text/id → `{ command, args }` parsing. No dependency on Context or
 * the socket, so these are trivially unit-testable on their own.
 */

/**
 * Parses free-typed text against the configured prefix.
 * @param {string} text
 * @param {string} prefix
 * @returns {{ command: string | null, args: string[] }}
 */
export function parseCommand(text, prefix) {
  if (!text || !text.startsWith(prefix)) {
    return { command: null, args: [] };
  }
  const [command, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  return { command: command?.toLowerCase() ?? null, args };
}

/**
 * Same idea as `parseCommand()`, but for native-flow button/list-row ids
 * (`ctx.buttonReply.id` / `ctx.listReply.id`). These don't need to start
 * with the prefix to count as a command — strips it if present, uses the
 * id as-is otherwise.
 * @param {string} id
 * @param {string} prefix
 * @returns {{ command: string | null, args: string[] }}
 */
export function parseNativeFlowCommand(id, prefix) {
  if (!id) return { command: null, args: [] };
  const stripped = id.startsWith(prefix) ? id.slice(prefix.length) : id;
  const [command, ...args] = stripped.trim().split(/\s+/);
  return { command: command?.toLowerCase() || null, args };
}
