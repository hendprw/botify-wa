# Botify (`botify-wa`)

A lightweight WhatsApp bot **framework**. The WhatsApp protocol core is **vendored directly in this repo** (`vendor/core/`) — it's not pulled from npm at install time, so your project keeps working even if any upstream package disappears from the registry. Its own dependencies (`ws`, `pino`, `libsignal`, `protobufjs`, etc.) are still installed normally from npm — those are established, widely-used packages with much lower risk.

Botify adds the structure most bots actually need on top of that core:

- A **command system** (`bot.command("ping", handler)`) instead of manually parsing raw connection events
- **Middleware** support (`bot.use(fn)`)
- A friendly **`Context`** object (`ctx.reply()`, `ctx.args`, `ctx.sender`, …) instead of raw message objects
- **Rich message handling** — every message type is classified (`ctx.type`: text, image, video, audio/voice-note, sticker, document, contact(s), location, poll, buttons/list replies, group invites, edits/deletes, …), with automatic unwrapping of ephemeral/view-once envelopes
- **Media download & sending** — `ctx.download()` / `ctx.saveMedia()`, and `ctx.sendImage()` / `sendVideo()` / `sendAudio()` / `sendDocument()` / `sendSticker()` / `sendContact()` / `sendLocation()` / `sendPoll()`
- **Message management** — `ctx.react()`, `ctx.edit()` / `ctx.editMessage()`, `ctx.delete()` / `ctx.deleteMessage()`, `ctx.pin()`, `ctx.star()`, `ctx.forward()`
- **Quoted-message support** — `ctx.quoted` gives you the same rich accessors + download/react/delete for whatever message was replied to
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

**Core**

| Property/Method | Description |
|---|---|
| `ctx.text` | Best-effort plain text (message body or caption) |
| `ctx.command` / `ctx.args` | Parsed command name + arguments |
| `ctx.sender` / `ctx.from` | Sender JID / chat JID |
| `ctx.isGroup` / `ctx.chatType` | Whether from a group, and `"group" \| "channel" \| "broadcast" \| "private"` |
| `ctx.type` | Friendly message type — see below |
| `ctx.mentions` / `ctx.isMentioned(jid)` | JIDs @mentioned in the message |
| `ctx.quoted` | The replied-to message, as a [`Quoted`](#quoted) — or `null` |

**Message types** — `ctx.type` is one of: `text`, `image`, `video`, `audio`
(`ctx.isPtt` for voice notes), `sticker`, `document`, `contact`, `contacts`,
`location`, `liveLocation`, `poll`, `pollUpdate`, `reaction`,
`buttonsResponse`, `listResponse`, `templateButtonReply`, `groupInvite`,
`product`, `event`, `protocol` (edits/deletes — see `ctx.protocol.kind`),
`unsupported`, `unknown`. Ephemeral and view-once wrappers are unwrapped
automatically, so `ctx.type` always reflects the real content.

Type-specific fields are populated accordingly: `ctx.mimetype`,
`ctx.caption`, `ctx.fileName`, `ctx.isViewOnce`, `ctx.location`,
`ctx.contact` / `ctx.contacts`, `ctx.poll`, `ctx.buttonReply`,
`ctx.listReply`, `ctx.groupInvite`, `ctx.protocol`.

**Sending**

| Method | Description |
|---|---|
| `ctx.reply(text, opts?)` | Reply, quoting the original message |
| `ctx.send(content, opts?)` | Send any core-compatible message content |
| `ctx.sendImage(source, opts?)` | `source`: Buffer, file path, http(s) URL, `{url}`/`{stream}` |
| `ctx.sendVideo(source, opts?)` | `opts.gifPlayback` to loop like a GIF |
| `ctx.sendAudio(source, opts?)` | `opts.ptt: true` to send as a voice note |
| `ctx.sendDocument(source, opts?)` | `opts.fileName`, `opts.mimetype` |
| `ctx.sendSticker(source, opts?)` | |
| `ctx.sendContact({name, number}, opts?)` | Accepts one contact or an array |
| `ctx.sendLocation({latitude, longitude, name?, address?})` | |
| `ctx.sendPoll({name, options, selectableCount?})` | |

**Media download**

| Method | Description |
|---|---|
| `ctx.download(opts?)` | Buffer (or stream with `{asStream:true}`) — throws if `!ctx.isMedia` |
| `ctx.saveMedia(filePath, opts?)` | Streams straight to disk, returns the path |

**Message management**

| Method | Description |
|---|---|
| `ctx.react(emoji)` / `ctx.removeReaction()` | React / clear the bot's reaction |
| `ctx.editMessage(target, content)` | Edit any of the bot's own sent messages — `target` is what `ctx.reply()`/`ctx.send()` returned |
| `ctx.deleteMessage(target?)` | Delete for everyone (bot's own msgs, or any msg if bot is group admin). Defaults to the triggering message |
| `ctx.edit(text)` / `ctx.delete()` | Shortcuts that target the triggering message itself |
| `ctx.pin(time?)` / `ctx.unpin()` | Pin/unpin the triggering message |
| `ctx.star(starred?)` | Star/unstar the triggering message |
| `ctx.forward(toJid, opts?)` | Forward the triggering message elsewhere |

**Group helpers**: `ctx.isGroupAdmin()`, `ctx.getGroupName()`, `ctx.describeChat()`.

### `Quoted`

`ctx.quoted` (when present) mirrors the relevant parts of `Context` for the
replied-to message: `type`, `text`, `mimetype`, `caption`, `isMedia`,
`sender`/`senderNumber`, plus `.download()`, `.saveMedia(path)`, `.react(emoji)`,
and `.delete()`. Handy for "reply to an image with `!sticker`" style commands:

```js
bot.command("sticker", async (ctx) => {
  const target = ctx.type === "image" ? ctx : ctx.quoted;
  if (target?.type !== "image") return ctx.reply("Reply to an image with !sticker");
  await ctx.sendSticker(await target.download());
});
```

## Dropping down to the raw connection

```js
bot.sock.ev.on("group-participants.update", (update) => {
  // raw core connection event
});
```

## License

MIT — see [LICENSE](./LICENSE). Third-party code vendored under `vendor/core/` retains its original license — see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

**Note:** Use responsibly and in accordance with WhatsApp's Terms of Service. This project is not affiliated with WhatsApp Inc. or Meta Platforms, Inc.