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
