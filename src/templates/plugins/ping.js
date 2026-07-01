/**
 * plugin: ping
 * ------------
 * Contoh command paling dasar.
 * Setiap plugin mengekspor fungsi default yang menerima `bot` sebagai argumen.
 */
export default function (bot) {
  bot.command("ping", async (ctx) => {
    await ctx.reply("pong 🏓");
  }, {
    description: "Cek apakah bot aktif",
  });
}
