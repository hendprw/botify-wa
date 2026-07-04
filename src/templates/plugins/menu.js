/**
 * plugin: menu
 * ------------
 * Menampilkan daftar semua command yang terdaftar, dikelompokkan otomatis
 * per `category` (opts.category saat registrasi), dan menampilkan
 * sub-command (dari `.sub()`) secara nested di bawah command induknya.
 *
 * Command tanpa `category` masuk ke grup "Lainnya".
 */
export default function (bot) {
  bot.command("menu", async (ctx) => {
    const prefix  = bot.options.prefix;
    const grouped = bot.plugins.listByCategory();

    const sections = [...grouped.entries()].map(([category, commands]) => {
      const label = category === "uncategorized" ? "Lainnya" : category;
      const lines = commands.map((c) => formatCommand(c, prefix)).join("\n");
      return `*${label}*\n${lines}`;
    });

    await ctx.reply(`📋 *Command tersedia:*\n\n${sections.join("\n\n")}`);
  }, {
    aliases:     ["help"],
    description: "Tampilkan daftar command",
  });
}

function formatCommand(c, prefix) {
  const aliases = c.aliases.length
    ? ` (alias: ${c.aliases.map((a) => prefix + a).join(", ")})`
    : "";
  const flags = formatFlags(c);
  const header = `${prefix}${c.name}${aliases}${c.description ? ` — ${c.description}` : ""}${flags ? `\n   ${flags}` : ""}`;

  if (!c.subcommands.length) return header;

  const subLines = c.subcommands
    .map((s) => {
      const subFlags = formatFlags(s);
      return `   ↳ ${s.name}${s.description ? ` — ${s.description}` : ""}${subFlags ? ` (${subFlags})` : ""}`;
    })
    .join("\n");

  return `${header}\n${subLines}`;
}

function formatFlags(c) {
  return [
    c.owner    ? "👑 owner"  : "",
    c.admin    ? "🛡️ admin"  : "",
    c.cooldown ? `⏱️ ${c.cooldown / 1000}s` : "",
  ].filter(Boolean).join(" · ");
}