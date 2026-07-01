import { Bot } from "../src/index.js";

const bot = new Bot({
  sessionPath: "./session",
  prefix: "!",
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

// Middleware example: simple logger
bot.use(async (ctx) => {
  if (ctx.command) {
    console.log(`[cmd] ${ctx.sender} -> ${ctx.command}`);
  }
});

// Framework-level events
bot.on("ready", () => {
  console.log("✅ Botify is connected and ready.");
});

bot.on("disconnect", ({ willReconnect }) => {
  console.log(`⚠️ Disconnected. Reconnecting: ${willReconnect}`);
});

await bot.start();
