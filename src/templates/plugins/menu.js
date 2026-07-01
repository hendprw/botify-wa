/**
 * plugin: menu
 * ------------
 * Menampilkan daftar semua command yang terdaftar.
 */
export default function (bot) {
  bot.command("menu", async (ctx) => {
    const prefix = bot.options.prefix;
    const list = bot.plugins
      .list()
      .map((c) => {
        const aliases = c.aliases.length
          ? ` (alias: ${c.aliases.map((a) => prefix + a).join(", ")})`
          : "";
        const flags = [
          c.owner   ? "👑 owner"  : "",
          c.admin   ? "🛡️ admin"  : "",
          c.cooldown ? `⏱️ ${c.cooldown / 1000}s` : "",
        ].filter(Boolean).join(" · ");

        return `${prefix}${c.name}${aliases}${c.description ? ` — ${c.description}` : ""}${flags ? `\n   ${flags}` : ""}`;
      })
      .join("\n");

    await ctx.reply(`📋 *Command tersedia:*\n\n${list}`);
  }, {
    aliases:     ["help"],
    description: "Tampilkan daftar command",
  });
}
