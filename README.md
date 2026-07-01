# Botify (`botify-wa`)

# Botify (`botify-wa`)

A lightweight WhatsApp bot **framework**. The WhatsApp protocol core is **vendored directly in this repo** (`vendor/core/`) — it's not pulled from npm at install time, so your project keeps working even if any upstream package disappears from the registry. Its own dependencies (`ws`, `pino`, `libsignal`, `protobufjs`, etc.) are still installed normally from npm — those are established, widely-used packages with much lower risk.

Botify adds the structure most bots actually need on top of that core:

- A **command system** (`bot.command("ping", handler)`) instead of manually parsing raw connection events
- **Middleware** support (`bot.use(fn)`)
- A friendly **`Context`** object (`ctx.reply()`, `ctx.args`, `ctx.sender`, …) instead of raw message objects
- Built-in **auto-reconnect** and session handling via `useMultiFileAuthState`
- Clean framework-level **events**: `ready`, `message`, `disconnect`, `unknownCommand`

## Project structure

```
botify-wa/
├── vendor/core/    ← vendored WhatsApp protocol core (encryption, sockets)
├── src/             ← Botify framework layer (Bot, Context, PluginManager)
├── examples/         ← example bots
└── package.json
```

Raw core APIs are still fully accessible via `bot.sock` if you need to drop down a level.

## Install

```bash
npm install
```

(The protocol core is already vendored in `vendor/core/` — nothing extra to install for it.)

## Quick start

```js
import { Bot } from "./src/index.js";

const bot = new Bot({ prefix: "!" });

bot.command("ping", async (ctx) => {
  await ctx.reply("pong 🏓");
});

bot.on("ready", () => console.log("Bot is online!"));

await bot.start();
```

Scan the QR code printed in your terminal with WhatsApp (Linked Devices) and you're connected.

See [`examples/simple-bot.js`](./examples/simple-bot.js) for a fuller example (commands, aliases, middleware, help menu).

## Updating the vendored core

Since the core is vendored (not an npm dependency), it won't auto-update. If you want to pull in upstream protocol fixes later, download the source, diff it against `vendor/core/`, and merge changes manually — this keeps you in control of what changes land in your framework.

## API overview

### `new Bot(options)`
| Option | Default | Description |
|---|---|---|
| `sessionPath` | `"./session"` | Folder where auth credentials are stored |
| `prefix` | `"!"` | Command prefix |
| `printQR` | `true` | Print QR code to terminal on first login |
| `socketConfig` | `{}` | Passed straight through to the underlying connection socket |

### `bot.command(name, handler, opts?)`
Registers a command. `handler` receives a [`Context`](./src/Context.js). `opts.aliases` and `opts.description` are optional.

### `bot.use(fn)`
Registers a middleware that runs before every command dispatch. Return `false` to stop the chain.

### `bot.on(event, handler)`
Framework-level events: `"ready"`, `"message"` (every incoming message, command or not), `"disconnect"`, `"unknownCommand"`.

### `Context`
| Property/Method | Description |
|---|---|
| `ctx.text` | Full message text |
| `ctx.command` / `ctx.args` | Parsed command name + arguments |
| `ctx.sender` / `ctx.from` | Sender JID / chat JID |
| `ctx.isGroup` | Whether the message is from a group |
| `ctx.reply(text, opts?)` | Reply, quoting the original message |
| `ctx.send(content, opts?)` | Send any message content to the chat |
| `ctx.react(emoji)` | React to the triggering message |

## Dropping down to the raw connection

```js
bot.sock.ev.on("group-participants.update", (update) => {
  // raw core connection event
});
```

## License

MIT — see [LICENSE](./LICENSE). Third-party code vendored under `vendor/core/` retains its original license — see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

**Note:** Use responsibly and in accordance with WhatsApp's Terms of Service. This project is not affiliated with WhatsApp Inc. or Meta Platforms, Inc.
