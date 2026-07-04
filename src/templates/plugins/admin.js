/**
 * plugin: admin
 * -------------
 * Contoh sub-command (`!admin ban`, `!admin kick`) plus penggunaan
 * `category` supaya command ini dikelompokkan rapi di `!menu`.
 *
 * `.sub()` bisa dirangkai berkali-kali. Setiap sub-command mewarisi flag
 * `owner`/`admin`/`cooldown` dari command induknya (di sini `admin: true`)
 * kecuali di-override sendiri — lihat "kick" di bawah yang mengubah cooldown.
 */
export default function (bot) {
  bot.command("admin", async (ctx) => {
    await ctx.reply(
      `Gunakan:\n${bot.options.prefix}admin ban @user\n${bot.options.prefix}admin kick @user`
    );
  }, {
    category:    "Admin",
    admin:       true, // berlaku juga untuk sub "ban" & "kick" di bawah
    description: "Perintah khusus admin grup",
  })
    .sub("ban", async (ctx) => {
      const target = ctx.mentions[0];
      if (!target) return ctx.reply("Mention orang yang mau di-ban.");
      // TODO: panggil groupParticipantsUpdate lewat ctx.sock kalau mau nyata.
      await ctx.reply(`🔨 (contoh) Ban ${target}`);
    }, {
      description: "Ban member dari grup",
    })
    .sub("kick", async (ctx) => {
      const target = ctx.mentions[0];
      if (!target) return ctx.reply("Mention orang yang mau di-kick.");
      await ctx.reply(`👋 (contoh) Kick ${target}`);
    }, {
      description: "Kick member dari grup",
      cooldown:    10_000, // override — beda cooldown dari "ban"
    });
}