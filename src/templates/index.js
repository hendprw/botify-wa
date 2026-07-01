import { Bot, loadPlugins } from "botify-wa";

const bot = new Bot();
// config.bt di folder ini dibaca otomatis.
// Kalau mau override satu opsi: new Bot({ prefix: "?" })

// Load semua command dari folder plugins/ secara otomatis.
await loadPlugins(bot, "./plugins");

// ── Framework events ─────────────────────────────────────────────────────────

bot.on("ready", () => {
  console.log("✅ Bot online!");
});

bot.on("disconnect", ({ willReconnect, reconnectDelayMs, attempt }) => {
  if (willReconnect) {
    console.log(`⚠️  Terputus. Reconnect dalam ${reconnectDelayMs}ms (percobaan #${attempt})...`);
  } else {
    console.log("⚠️  Terputus. Sesi habis — tidak reconnect.");
  }
});

bot.on("unknownCommand", (ctx) => {
  // Hapus baris ini kalau tidak mau balas command yang tidak dikenal.
  ctx.reply(`❓ Command tidak ditemukan. Ketik ${bot.options.prefix}menu untuk daftar command.`);
});

bot.onError(async (error, ctx) => {
  console.error(`[error] command "${ctx.command}" gagal:`, error);
  await ctx.reply("⚠️ Terjadi kesalahan saat menjalankan command ini.");
});

await bot.start();
