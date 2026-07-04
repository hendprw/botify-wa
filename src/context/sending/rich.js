/**
 * sending/rich
 * ------------
 * "AI-style" rich responses — tables, key/value lists, syntax-highlighted
 * code blocks, and inline-link text. Each has a V1 (basic) and V2 (unified-
 * response protocol) variant; both are thin passthroughs to the vendored
 * core's own `sock.sendXxx()` builders.
 */

export const richSendingMethods = {
  /** Rich table (V1). `headers`: string[]; `rows`: string[][]. */
  async sendTable(title, headers, rows, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendTable(
      this.from,
      title,
      headers,
      rows,
      quoted === false ? undefined : this.raw,
      rest
    );
  },

  /**
   * Rich table (V2, unified-response protocol).
   * `table`: [title, "col1 | col2 | ...", "r1c1 | r1c2;;r2c1 | r2c2"]
   */
  async sendTableV2(table, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendTableV2(
      this.from,
      table,
      quoted === false ? undefined : this.raw,
      rest
    );
  },

  /** Rich key/value list (no heading). `items`: Array<[label, value]> or string[]. */
  async sendRichList(title, items, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendList(
      this.from,
      title,
      items,
      quoted === false ? undefined : this.raw,
      rest
    );
  },

  /** Rich code block (V1, basic highlighting). Languages: javascript, typescript, python. */
  async sendCodeBlock(code, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendCodeBlock(
      this.from,
      code,
      quoted === false ? undefined : this.raw,
      rest
    );
  },

  /** Rich code block (V2, unified-response protocol). Languages: javascript, python, go, lua, bash. */
  async sendCodeBlockV2(code, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendCodeBlockV2(
      this.from,
      code,
      quoted === false ? undefined : this.raw,
      rest
    );
  },

  /** Rich inline-link text using `{{IE_N}}display{{/IE_N}}` placeholders. `links`: string[] of URLs, matched by index N. */
  async sendLink(text, links, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendLink(
      this.from,
      text,
      links,
      quoted === false ? undefined : this.raw,
      rest
    );
  },

  /** Rich inline-link text, search-result style. `links`: Array<{ url, displayName?, sourceDisplayName?, sourceSubtitle? }>. */
  async sendLinkV2(text, links, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendLinkV2(
      this.from,
      text,
      links,
      quoted === false ? undefined : this.raw,
      rest
    );
  },

  /**
   * Send a mixed rich message built from raw submessages (text/table/code/
   * image/etc — see `RichSubMessageType` for the numeric `messageType`s).
   */
  async sendRichMessage(submessages, opts = {}) {
    const { quoted, ...rest } = opts;
    return this.sock.sendRichMessage(
      this.from,
      submessages,
      quoted === false ? undefined : this.raw,
      rest
    );
  },
};
