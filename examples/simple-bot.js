import { Bot } from "../src/index.js";

const bot = new Bot({
  sessionPath: "./session",
  prefix: "!",
  // JIDs allowed to run { owner: true } commands, e.g. "6281234567890@s.whatsapp.net"
  owners: [],
});

// Simple command
bot.command("ping", async (ctx) => {
  await ctx.reply("pong 🏓");
});

// Command with args
bot.command(
  "echo",
  async (ctx) => {
    await ctx.reply(ctx.args.join(" ") || "(nothing to echo)");
  },
  { description: "Repeat back whatever you type after the command" }
);

// Command with a cooldown — each sender can only run this once every 10s
bot.command(
  "roll",
  async (ctx) => {
    await ctx.reply(`🎲 You rolled a ${1 + Math.floor(Math.random() * 6)}`);
  },
  { description: "Roll a die", cooldown: 10_000 }
);

// Owner-only command — only JIDs listed in Bot({ owners }) can run this
bot.command(
  "broadcast",
  async (ctx) => {
    await ctx.reply(`📢 (pretend this went out to everyone): ${ctx.args.join(" ")}`);
  },
  { description: "Send an announcement (owner only)", owner: true }
);

// Admin-only command — only group admins can run this, no-op in DMs
bot.command(
  "kick",
  async (ctx) => {
    await ctx.reply("(pretend someone just got kicked)");
  },
  { description: "Remove a member (group admins only)", admin: true }
);

// A command that intentionally throws, to demonstrate onError below
bot.command("crash", async () => {
  throw new Error("boom — something went wrong inside the handler");
});

// Command with alias
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

// Middleware example: detailed logger — shows who sent it, from where
// (private chat / which group), and what command+args they ran.
bot.use(async (ctx) => {
  if (!ctx.command) return;

  const chat = await ctx.describeChat(); // e.g. `group "Koalisi Community"` or `private chat`

  console.log(
    `[cmd] ${ctx.pushName} (${ctx.sender}) via ${chat} -> ${bot.options.prefix}${ctx.command} ${ctx.args.join(" ")}`.trimEnd()
  );
});

// Framework-level events
bot.on("ready", () => {
  console.log("✅ Botify is connected and ready.");
});

bot.on("disconnect", ({ willReconnect, reconnectDelayMs, attempt }) => {
  if (willReconnect) {
    console.log(
      `⚠️ Disconnected. Reconnecting in ${reconnectDelayMs}ms (attempt #${attempt})...`
    );
  } else {
    console.log("⚠️ Disconnected. Logged out — not reconnecting.");
  }
});

bot.on("cooldown", (ctx, remainingMs) => {
  ctx.reply(`⏳ Slow down! Try again in ${Math.ceil(remainingMs / 1000)}s.`);
});

bot.on("noPermission", (ctx, reason) => {
  const message =
    reason === "owner"
      ? "🚫 This command is owner-only."
      : "🚫 This command is for group admins only.";
  ctx.reply(message);
});

bot.on("unknownCommand", (ctx) => {
  ctx.reply(`❓ Unknown command "${ctx.command}". Try ${bot.options.prefix}help`);
});

// Centralized error handling — catches anything thrown inside a command
// handler or middleware so a single bad command can't crash the whole bot.
bot.onError(async (error, ctx) => {
  console.error(`[error] command "${ctx.command}" failed:`, error);
  await ctx.reply("⚠️ Something went wrong running that command.");
});

await bot.start();