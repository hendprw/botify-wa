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

// ── Interactive / rich messages (new) ─────────────────────────────────────────

bot.command(
  "buttons",
  async (ctx) => {
    await ctx.sendButtons(
      { title: "Welcome!", footer: "Powered by Botify" },
      [
{ type: "reply", text: "Menu", id: `${bot.options.prefix}menu` },
        { type: "url", text: "Website", url: "https://example.com" },
        { type: "copy", text: "Copy Code", code: "BOTIFY2024" },
      ]
    );
  },
  { description: "Send example native-flow buttons" }
);

bot.command(
  "listmenu",
  async (ctx) => {
    await ctx.sendListMenu(
      { title: "Bot Menu", footer: "Powered by Botify", buttonText: "Open Menu" },
      [
        {
          title: "Games",
          rows: [
            { title: "Quiz", id: `${bot.options.prefix}quiz` },
            { title: "Roll a die", id: `${bot.options.prefix}roll` },
          ],
        },
        {
          title: "Tools",
          rows: [
            { title: "Sticker", id: `${bot.options.prefix}sticker` },
            { title: "Save media", id: `${bot.options.prefix}save` },
          ],
        },
      ]
    );
  },
  { description: "Send an example WhatsApp list menu" }
);

// Location card as an interactive message — custom thumbnail replaces WA's
// auto-generated map snapshot, plus a mix of reply/url buttons AND a native
// list-menu button, all in one message.
//
// NOTE: `location`'s thumbnail is embedded directly in the message (not
// uploaded like normal media), so WA caps how big it can be — ~300px wide
// is about the ceiling before WA silently rejects it and falls back to a
// generic pin icon. If you want a genuinely crisp/HD image, see
// `locationHdButtons` below instead.
bot.command(
  "locationbuttons",
  async (ctx) => {
    await ctx.sendButtons(
      {
        title: "📍 Kantor kami ada di sini",
        footer: "Powered by Botify",
        location: {
          latitude: -6.2,
          longitude: 106.816666,
          name: "Jakarta",
          address: "Indonesia",
        },
        thumbnail: "https://placehold.co/400x400.jpg",
        thumbnailWidth: 300, // confirmed ceiling before WA rejects it
      },
      [
        { type: "reply", text: "📞 Hubungi Kami", id: `${bot.options.prefix}ping` },
        { type: "url", text: "🌐 Website", url: "https://example.com" },
        {
          type: "list",
          text: "📋 Lihat Menu",
          sections: [
            {
              title: "Menu Utama",
              rows: [
                { title: "Produk A", id: "menu_produk_a", description: "Deskripsi produk A" },
                { title: "Produk B", id: "menu_produk_b", description: "Deskripsi produk B" },
              ],
            },
          ],
        },
      ]
    );
  },
  { description: "Send a location card with a custom thumbnail + buttons + list menu" }
);

// Alternative when you actually want a crisp/HD image: use `image` (goes
// through WA's normal media-upload pipeline, no embedded-thumbnail size
// ceiling) instead of `location`, and put the location behind a Google
// Maps link button. Same practical result for the user — full-quality
// photo + one tap to open the location — without the ~300px cap.
bot.command(
  "locationhdbuttons",
  async (ctx) => {
    const latitude = -6.2;
    const longitude = 106.816666;
    await ctx.sendButtons(
      {
        title: "📍 Kantor kami ada di Jakarta, Indonesia\n\nKantor kami ada di sini",
        footer: "Powered by Botify",
        image: "https://placehold.co/400x400.jpg", // full quality, no cap
      },
      [
        { type: "reply", text: "📞 Hubungi Kami", id: `${bot.options.prefix}ping` },
        { type: "url", text: "📍 Buka di Google Maps", url: `https://maps.google.com/?q=${latitude},${longitude}` },
        { type: "url", text: "🌐 Website", url: "https://example.com" },
        {
          type: "list",
          text: "📋 Lihat Menu",
          sections: [
            {
              title: "Menu Utama",
              rows: [
                { title: "Produk A", id: "menu_produk_a", description: "Deskripsi produk A" },
                { title: "Produk B", id: "menu_produk_b", description: "Deskripsi produk B" },
              ],
            },
          ],
        },
      ]
    );
  },
  { description: "Same as !locationbuttons but with a full-HD image + a Google Maps link button instead of the native location card" }
);

// Zero-download "card" — great for leveling/rank cards, welcome cards, etc.
// The thumbnail is embedded straight in the message (piggybacking on
// locationMessage's jpegThumbnail field), so it never touches the media
// CDN and costs the recipient no extra data — unlike a normal !sendImage().
// (There's also ctx.sendCard(), but that needs a real URL in the text for
// WA to render the preview box — use it only if a visible link is fine.)
bot.command(
  "rankcard",
  async (ctx) => {
    await ctx.sendButtons(
      {
        title: `Rank #3 in this group`,
        footer: "Powered by Botify",
        location: {
          latitude: 0,
          longitude: 0,
          name: `⭐ Level 12 — ${ctx.pushName}`,
          address: "XP: 4,200 / 5,000",
        },
        thumbnail: "https://placehold.co/700x700.jpg", // swap for a real generated rank-card image
      },
      [{ type: "reply", text: "🏆 Lihat Profil", id: `${bot.options.prefix}menu` }]
    );
  },
  { description: "Send a rank/level card with zero media download cost" }
);

// ctx.sendCard() — a link-preview-style card. Needs a visible `url` (WA only
// renders the preview box when the message text contains a matching link),
// but in exchange the thumbnail defaults to `highQuality: true`: it's
// uploaded to WA's media CDN the same way WhatsApp's own client does for
// real link previews, so it comes out sharp/full-res instead of the old
// ~192px, quality-50 embedded-only thumbnail. Costs one extra upload
// round-trip at send time.
bot.command(
  "sendcard",
  async (ctx) => {
    await ctx.sendCard({
      title: "Botify WA",
      description: "Framework WhatsApp bot yang ringan dan modular.",
      thumbnail: "https://placehold.co/800x800.jpg", // swap for a real image
      url: "https://github.com",
    });
  },
  { description: "Send a sharp, CDN-backed link-preview card (highQuality: true by default)" }
);

// Same card, but with highQuality: false — old behavior, zero network
// round-trip, instant send, but capped at ~300px/quality-50 → visibly
// blurrier. Useful if you're sending a LOT of these and want to skip the
// extra upload latency, or you're offline-tolerant and don't want a failed
// upload to add delay.
bot.command(
  "sendcardlq",
  async (ctx) => {
    await ctx.sendCard({
      title: "Botify WA",
      description: "Framework WhatsApp bot yang ringan dan modular.",
      thumbnail: "https://placehold.co/800x800.jpg",
      url: "https://github.com",
      highQuality: false,
    });
  },
  { description: "Same as !sendcard but forced low-res/embedded-only (highQuality: false) — compare the blur" }
);

// Reply to two images with "!album" to group them into one gallery message.
bot.command(
  "album",
  async (ctx) => {
    if (ctx.type !== "image" || !ctx.quoted || ctx.quoted.type !== "image") {
      return ctx.reply("Reply to an image with !album, while quoting another image.");
    }
    const [first, second] = await Promise.all([
      ctx.download(),
      ctx.quoted.download(),
    ]);
    await ctx.sendAlbum([
      { image: first, caption: "First" },
      { image: second, caption: "Second" },
    ]);
  },
  { description: "Group two images (this + the one you replied to) into an album" }
);

bot.command(
  "table",
  async (ctx) => {
    await ctx.sendTable(
      "Java vs JavaScript",
      ["Feature", "Java", "JavaScript"],
      [
        ["Type", "Compiled", "Interpreted"],
        ["Typing", "Static", "Dynamic"],
      ],
      { headerText: "Comparison:", footer: "Hope this helps!" }
    );
  },
  { description: "Send an example rich table" }
);

bot.command(
  "codeblock",
  async (ctx) => {
    await ctx.sendCodeBlock(
      `function sayHello(name) {\n  return "Hello, " + name;\n}`,
      { language: "javascript", title: "Example Code", footer: "Powered by Botify" }
    );
  },
  { description: "Send an example rich code block" }
);

bot.command(
  "link",
  async (ctx) => {
    await ctx.sendLink(
      "Check this out: {{IE_0}}the Botify repo{{/IE_0}}",
      ["https://github.com/example/botify-wa"],
      { headerText: "🔗 Link", footer: "✨ Done!" }
    );
  },
  { description: "Send an example rich inline link" }
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