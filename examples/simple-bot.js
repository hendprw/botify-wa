/**
 * all-sending-methods.js
 * ----------------------
 * Referensi lengkap: satu command untuk SETIAP method `ctx.sendXxx()` /
 * `ctx.reply()` / `ctx.send()` yang didukung Botify — total 27 method.
 *
 * Tujuan file ini murni sebagai *cheat sheet* yang bisa langsung dijalankan
 * dan dicoba satu-satu, bukan struktur bot produksi. Untuk contoh command
 * system, middleware, cooldown, dsb — lihat `examples/simple-bot.js`.
 *
 * Cara pakai:
 *   1. `npm install` di root project (kalau belum).
 *   2. Jalankan: `node examples/all-sending-methods.js`
 *   3. Scan QR code, lalu kirim `!menu` ke bot untuk lihat semua command demo.
 *
 * Beberapa command memakai URL gambar placeholder (`placehold.co`) — ganti
 * dengan gambar/berkas asli kalau mau melihat hasil yang lebih meyakinkan.
 */
import { Bot, RichSubMessageType } from "../src/index.js";

const bot = new Bot({ prefix: "!" });

// ── Daftar semua command demo, untuk ditampilkan lewat !menu ────────────────
const DEMO_COMMANDS = [
  ["reply", "ctx.reply() — balas teks biasa, mengutip pesan asal"],
  ["send", "ctx.send() — kirim konten mentah apa pun yang dipahami core"],
  ["card", "ctx.sendCard() — kartu link-preview ringan"],
  ["image", "ctx.sendImage() — kirim gambar"],
  ["video", "ctx.sendVideo() — kirim video"],
  ["audio", "ctx.sendAudio() — kirim audio/voice note"],
  ["document", "ctx.sendDocument() — kirim dokumen/berkas"],
  ["sticker", "ctx.sendSticker() — kirim satu stiker"],
  ["stickerpack", "ctx.sendStickerPack() — kirim sekumpulan stiker"],
  ["album", "ctx.sendAlbum() — galeri berisi beberapa gambar/video"],
  ["contact", "ctx.sendContact() — kirim satu/beberapa kontak"],
  ["location", "ctx.sendLocation() — kirim pin lokasi"],
  ["poll", "ctx.sendPoll() — kirim polling"],
  ["buttons", "ctx.sendButtons() — tombol interaktif (reply/url/copy)"],
  ["listmenu", "ctx.sendListMenu() — menu list native WhatsApp"],
  ["table", "ctx.sendTable() — tabel kaya (V1)"],
  ["tablev2", "ctx.sendTableV2() — tabel kaya (V2, unified-response)"],
  ["richlist", "ctx.sendRichList() — list key/value tanpa judul kolom"],
  ["codeblock", "ctx.sendCodeBlock() — code block (V1)"],
  ["codeblockv2", "ctx.sendCodeBlockV2() — code block (V2)"],
  ["link", "ctx.sendLink() — teks dengan tautan inline (V1)"],
  ["linkv2", "ctx.sendLinkV2() — teks dengan tautan gaya hasil pencarian (V2)"],
  ["richmessage", "ctx.sendRichMessage() — gabungan beberapa submessage"],
  ["payment", "ctx.sendPayment() — permintaan pembayaran"],
  ["event", "ctx.sendEvent() — undangan event kalender"],
  ["pollresult", "ctx.sendPollResult() — hasil akhir poll"],
  ["product", "ctx.sendProduct() — kartu produk katalog"],
  ["statusmention", "ctx.sendStatusMention() — Status (story) yang me-mention kontak"],
];

bot.command("menu", async (ctx) => {
  const list = DEMO_COMMANDS.map(([name, desc]) => `• !${name} — ${desc}`).join("\n");
  await ctx.reply(`📋 *Demo semua jenis pengiriman Botify*\n\n${list}`);
});

// ── 1. Teks dasar ────────────────────────────────────────────────────────────

bot.command("reply", async (ctx) => {
  await ctx.reply("Ini balasan biasa — otomatis mengutip pesanmu. 👋");
});

bot.command("send", async (ctx) => {
  // ctx.send() meneruskan konten apa pun langsung ke sock.sendMessage(),
  // tanpa auto-quote seperti ctx.reply().
  await ctx.send({ text: "Dikirim lewat ctx.send() — konten mentah, tanpa auto-quote." });
});

bot.command("card", async (ctx) => {
  // Kartu link-preview: butuh `url` asli agar WhatsApp menampilkan kotak
  // preview-nya. highQuality: true (default) meng-upload thumbnail agar tajam.
  await ctx.sendCard({
    title: "Botify WA",
    description: "Framework WhatsApp bot yang ringan dan modular.",
    thumbnail: "https://placehold.co/800x800.jpg",
    url: "https://github.com",
  });
});

// ── 2. Media ─────────────────────────────────────────────────────────────────

bot.command("image", async (ctx) => {
  await ctx.sendImage("https://placehold.co/600x400.jpg", {
    caption: "Contoh gambar lewat ctx.sendImage()",
  });
});

bot.command("video", async (ctx) => {
  await ctx.sendVideo("https://www.w3schools.com/html/mov_bbb.mp4", {
    caption: "Contoh video lewat ctx.sendVideo()",
    // gifPlayback: true, // aktifkan untuk diputar seperti GIF
  });
});

bot.command("audio", async (ctx) => {
  await ctx.sendAudio("https://www.w3schools.com/html/horse.mp3", {
    ptt: true, // kirim sebagai voice note; set false untuk audio biasa
  });
});

bot.command("document", async (ctx) => {
  const buffer = Buffer.from("Ini isi contoh dokumen dari Botify.\n", "utf8");
  await ctx.sendDocument(buffer, {
    fileName: "contoh.txt",
    mimetype: "text/plain",
    caption: "Contoh dokumen lewat ctx.sendDocument()",
  });
});

bot.command("sticker", async (ctx) => {
  await ctx.sendSticker("https://placehold.co/512x512.png");
});

bot.command("stickerpack", async (ctx) => {
  await ctx.sendStickerPack({
    name: "Paket Demo Botify",
    publisher: "Botify",
    description: "Contoh paket stiker",
    stickers: [
      { source: "https://placehold.co/512x512.png", emojis: ["👋"] },
      { source: "https://placehold.co/512x512.png", emojis: ["🎉"] },
    ],
    cover: "https://placehold.co/512x512.png",
  });
});

bot.command("album", async (ctx) => {
  await ctx.sendAlbum([
    { image: "https://placehold.co/600x400/png?text=Foto+1", caption: "Foto pertama" },
    { image: "https://placehold.co/600x400/png?text=Foto+2", caption: "Foto kedua" },
  ]);
});

// ── 3. Kontak, lokasi, poll ──────────────────────────────────────────────────

bot.command("contact", async (ctx) => {
  await ctx.sendContact({
    name: "Botify Support",
    number: "628123456789",
    organization: "Botify",
  });
});

bot.command("location", async (ctx) => {
  await ctx.sendLocation({
    latitude: -6.2,
    longitude: 106.816666,
    name: "Jakarta",
    address: "Indonesia",
  });
});

bot.command("poll", async (ctx) => {
  await ctx.sendPoll({
    name: "Bahasa pemrograman favoritmu?",
    options: ["JavaScript", "Python", "Rust", "Go"],
    selectableCount: 1,
  });
});

// ── 4. Pesan interaktif (native-flow) ───────────────────────────────────────

bot.command("buttons", async (ctx) => {
  await ctx.sendButtons(
    { title: "Selamat datang di Botify!", footer: "Powered by Botify" },
    [
      { type: "reply", text: "Lihat Menu", id: `${bot.options.prefix}menu` },
      { type: "url", text: "Website", url: "https://example.com" },
      { type: "copy", text: "Salin Kode", code: "BOTIFY2024" },
    ]
  );
});

bot.command("listmenu", async (ctx) => {
  await ctx.sendListMenu(
    { title: "Menu Bot", footer: "Powered by Botify", buttonText: "Buka Menu" },
    [
      {
        title: "Media",
        rows: [
          { title: "Gambar", id: `${bot.options.prefix}image`, description: "Contoh kirim gambar" },
          { title: "Stiker", id: `${bot.options.prefix}sticker`, description: "Contoh kirim stiker" },
        ],
      },
      {
        title: "Lainnya",
        rows: [
          { title: "Poll", id: `${bot.options.prefix}poll` },
          { title: "Lokasi", id: `${bot.options.prefix}location` },
        ],
      },
    ]
  );
});

// ── 5. Pesan rich / gaya AI (tabel, list, code block, link) ────────────────

bot.command("table", async (ctx) => {
  await ctx.sendTable(
    "Java vs JavaScript",
    ["Fitur", "Java", "JavaScript"],
    [
      ["Tipe", "Compiled", "Interpreted"],
      ["Typing", "Static", "Dynamic"],
    ],
    { headerText: "Perbandingan:", footer: "Semoga membantu!" }
  );
});

bot.command("tablev2", async (ctx) => {
  // Format table: [judul(diabaikan), "kolom1 | kolom2 | ...", "baris1;;baris2..."]
  await ctx.sendTableV2(
    [
      "Perbandingan Bahasa",
      "Bahasa | Tipe | Performa",
      "Python | Interpreted | Sedang;;Rust | Compiled | Sangat cepat",
    ],
    { title: "Perbandingan Bahasa Pemrograman", footer: "Data demo, bukan benchmark resmi." }
  );
});

bot.command("richlist", async (ctx) => {
  await ctx.sendRichList(
    "Info Bot",
    [
      ["Nama", "Botify"],
      ["Versi", "0.2.0"],
      ["Lisensi", "MIT"],
    ],
    { footer: "Powered by Botify" }
  );
});

bot.command("codeblock", async (ctx) => {
  await ctx.sendCodeBlock(
    `function sapa(nama) {\n  return "Halo, " + nama;\n}`,
    { language: "javascript", title: "Contoh Kode", footer: "Powered by Botify" }
  );
});

bot.command("codeblockv2", async (ctx) => {
  await ctx.sendCodeBlockV2(
    `def sapa(nama):\n    return f"Halo, {nama}"`,
    { language: "python", text: "Versi Python-nya:", footer: "Powered by Botify" }
  );
});

bot.command("link", async (ctx) => {
  await ctx.sendLink(
    "Lihat repo-nya di sini: {{IE_0}}Botify di GitHub{{/IE_0}}",
    ["https://github.com/example/botify-wa"],
    { headerText: "🔗 Tautan", footer: "✨ Selesai!" }
  );
});

bot.command("linkv2", async (ctx) => {
  await ctx.sendLinkV2(
    "Beberapa referensi tentang Botify:",
    [
      {
        url: "https://github.com/example/botify-wa",
        displayName: "Botify di GitHub",
        sourceDisplayName: "GitHub",
        sourceSubtitle: "Kode sumber & dokumentasi",
      },
    ],
    { footer: "\n\nSumber dikurasi otomatis." }
  );
});

bot.command("richmessage", async (ctx) => {
  // Gabungan beberapa submessage manual — lihat RichSubMessageType untuk
  // daftar tipe numeriknya (TEXT, TABLE, CODE, GRID_IMAGE, dst).
  await ctx.sendRichMessage([
    { messageType: RichSubMessageType.TEXT, messageText: "Ringkasan gabungan:" },
    {
      messageType: RichSubMessageType.TABLE,
      tableMetadata: {
        title: "Statistik",
        rows: [
          { items: ["Metrik", "Nilai"], isHeading: true },
          { items: ["Pengguna aktif", "1.234"] },
        ],
      },
    },
  ]);
});

// ── 6. Lainnya (pembayaran, event, hasil poll, produk, status) ─────────────

bot.command("payment", async (ctx) => {
  await ctx.sendPayment({
    amount: 50000,
    currency: "IDR",
    note: "Contoh permintaan pembayaran dari Botify",
    from: ctx.sender,
  });
});

bot.command("event", async (ctx) => {
  const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 jam dari sekarang
  await ctx.sendEvent({
    name: "Meetup Koalisi Community",
    description: "Diskusi rutin komunitas keamanan siber & IT.",
    startTime,
    endTime: startTime + 7200,
    location: "Madura, Indonesia",
  });
});

bot.command("pollresult", async (ctx) => {
  await ctx.sendPollResult({
    name: "Bahasa pemrograman favoritmu?",
    votes: [
      { optionName: "JavaScript", optionVoteCount: 12 },
      { optionName: "Python", optionVoteCount: 9 },
      { optionName: "Rust", optionVoteCount: 4 },
    ],
  });
});

bot.command("product", async (ctx) => {
  await ctx.sendProduct({
    title: "Kaos Botify",
    description: "Kaos katun premium dengan logo Botify.",
    thumbnail: "https://placehold.co/500x500.jpg",
    productId: "demo-001",
    retailerId: "botify-store",
    url: "https://example.com/produk/kaos-botify",
    priceAmount1000: 150000,
    currencyCode: "IDR",
  });
});

bot.command("statusmention", async (ctx) => {
  // Berbeda dari method send* lain — ini tidak terkirim ke ctx.from,
  // melainkan diposting sebagai Status (story) yang menyorot kontak tertentu.
  await ctx.sendStatusMention({ text: "Halo dari Status Botify! 👋" }, [ctx.sender]);
});

// ── Event framework dasar ────────────────────────────────────────────────────

bot.on("ready", () => console.log("✅ Bot demo siap. Kirim !menu untuk lihat semua contoh."));

bot.onError(async (error, ctx) => {
  console.error(`[error] command "${ctx.command}" gagal:`, error);
  await ctx.reply("⚠️ Terjadi kesalahan saat menjalankan demo ini.");
});

await bot.start();