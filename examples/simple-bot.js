/**
 * simple-bot.js
 * -------------
 * Minimal example — config.bt in the project root handles all global settings.
 * No need to configure cooldown, permission, anti-spam, or logger here:
 * those are auto-registered by Bot based on config.bt values.
 */
import { Bot } from "../src/index.js";

const bot = new Bot();
// config.bt is loaded automatically from cwd.
// Any option you pass here overrides the file:
//   new Bot({ prefix: "?", owners: ["628...@s.whatsapp.net"] })

// ── Commands ────────────────────────────────────────────────────────────────

bot.command("ping", async (ctx) => {
  await ctx.reply("pong 🏓");
});

bot.command(
  "echo",
  async (ctx) => {
    await ctx.reply(ctx.args.join(" ") || "(nothing to echo)");
  },
  { description: "Repeat back whatever you type after the command" }
);

// Per-command cooldown — overrides the global default from config.bt.
bot.command(
  "roll",
  async (ctx) => {
    await ctx.reply(`🎲 You rolled a ${1 + Math.floor(Math.random() * 6)}`);
  },
  { description: "Roll a die", cooldown: 10_000 }
);

// Owner-only — only JIDs listed in config.bt [bot] owners (or Bot({ owners })) can run this.
bot.command(
  "broadcast",
  async (ctx) => {
    await ctx.reply(`📢 (pretend this went out to everyone): ${ctx.args.join(" ")}`);
  },
  { description: "Send an announcement (owner only)", owner: true }
);

// Admin-only — only group admins can run this; no-op in DMs.
bot.command(
  "kick",
  async (ctx) => {
    await ctx.reply("(pretend someone just got kicked)");
  },
  { description: "Remove a member (group admins only)", admin: true }
);

bot.command(
  "menu",
  async (ctx) => {
    const list = bot.plugins
      .list()
      .map((c) => `• ${bot.options.prefix}${c.name} — ${c.description}`)
      .join("\n");
    await ctx.reply(`Available commands:\n${list}`);
  },
  { aliases: ["help"] }
);

// ── Rich message handling ────────────────────────────────────────────────────

// Auto-react to whatever media type someone sends (no command needed).
bot.on("message", async (ctx) => {
  if (ctx.command) return; // let the command handlers deal with these
  if (ctx.isMedia) await ctx.react("👀");
});

// Send this as a caption on media, or reply to media, with "!save" to download it.
bot.command(
  "save",
  async (ctx) => {
    const target = ctx.isMedia ? ctx : ctx.quoted;
    if (!target?.isMedia) {
      return ctx.reply("Send this as a caption on media, or reply to media, with !save");
    }
    const buffer = await target.download();
    await ctx.reply(`Downloaded ${buffer.length} bytes (${target.mimetype}).`);
  },
  { description: "Download media you send or reply to" }
);

// Reply to any image with "!sticker" to convert it into a sticker.
bot.command(
  "sticker",
  async (ctx) => {
    const target = ctx.type === "image" ? ctx : ctx.quoted;
    if (target?.type !== "image") {
      return ctx.reply("Send an image with !sticker, or reply to one.");
    }
    const buffer = await target.download();
    await ctx.sendSticker(buffer);
  },
  { description: "Turn an image into a sticker" }
);

bot.command(
  "location",
  async (ctx) => {
    await ctx.sendLocation({
      latitude: -6.2,
      longitude: 106.816666,
      name: "Jakarta",
      address: "Indonesia",
    });
  },
  { description: "Send an example location pin" }
);

// Demonstrates ctx.edit() — edits the message that triggered it (self-bot
// pattern: only works when the message being processed is the bot's own).
bot.command(
  "editme",
  async (ctx) => {
    await ctx.edit("✏️ (this message was edited by the bot)");
  },
  { description: "Edit the triggering message (only works on the bot's own messages)" }
);

// Demonstrates centralized error handling.
bot.command("crash", async () => {
  throw new Error("boom — something went wrong inside the handler");
});

// ── Framework events ─────────────────────────────────────────────────────────

bot.on("ready", () => {
  console.log("✅ Botify is connected and ready.");
});

bot.on("disconnect", ({ willReconnect, reconnectDelayMs, attempt }) => {
  if (willReconnect) {
    console.log(`⚠️ Disconnected. Reconnecting in ${reconnectDelayMs}ms (attempt #${attempt})...`);
  } else {
    console.log("⚠️ Disconnected. Logged out — not reconnecting.");
  }
});

// cooldown and noPermission events are still available for custom handling.
// If you don't listen to them, the built-in middlewares already send the
// reply messages defined in config.bt.
bot.on("cooldown", (ctx, remainingMs) => {
  // Optional: override the default cooldown message here.
  // ctx.reply(`⏳ Tunggu ${Math.ceil(remainingMs / 1000)}s lagi.`);
});

bot.on("unknownCommand", (ctx) => {
  ctx.reply(`❓ Unknown command "${ctx.command}". Try ${bot.options.prefix}help`);
});

bot.onError(async (error, ctx) => {
  console.error(`[error] command "${ctx.command}" failed:`, error);
  await ctx.reply("⚠️ Something went wrong running that command.");
});

await bot.start();