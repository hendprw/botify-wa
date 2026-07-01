/**
 * plugin: info
 * ------------
 * Contoh command dengan cooldown dan penggunaan ctx (args, isGroup, sender).
 */
export default function (bot) {
  bot.command("info", async (ctx) => {
    const chat = await ctx.describeChat();
    const lines = [
      `👤 *Pengirim:* ${ctx.pushName}`,
      `📱 *Nomor:* ${ctx.senderNumber}`,
      `💬 *Chat:* ${chat}`,
      `🤖 *Prefix:* ${bot.options.prefix}`,
    ];

    if (ctx.args.length) {
      lines.push(`📝 *Args:* ${ctx.args.join(", ")}`);
    }

    await ctx.reply(lines.join("\n"));
  }, {
    description: "Info tentang pengirim dan chat",
    cooldown:    5_000,
  });
}
