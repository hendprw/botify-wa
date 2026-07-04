# Botify (`botify-wa`)

**Botify** adalah *framework* WhatsApp bot yang ringan, dibangun di atas *core* protokol WhatsApp yang di-*vendor* langsung ke dalam repo ini (`vendor/core/`) — bukan diambil dari npm saat instalasi. Artinya, proyekmu tetap berjalan normal walaupun suatu saat paket upstream-nya hilang dari registry. Dependensi dari core itu sendiri (`ws`, `pino`, `libsignal`, `protobufjs`, dll) tetap ter-install seperti biasa lewat npm — semuanya paket yang sudah mapan dan berisiko rendah.

Di atas core tersebut, Botify menambahkan struktur yang benar-benar dibutuhkan hampir semua bot:

- **Sistem command** — `bot.command("ping", handler)`, tanpa perlu parsing manual event koneksi mentah
- **Sub-command** — `bot.command("admin", handler, { admin: true }).sub("ban", banHandler)` untuk pola `!admin ban`, `!admin kick`, dengan pewarisan `owner`/`admin`/`cooldown` dari command induknya
- **Kategori command** — `opts.category` untuk grouping command, dibaca otomatis oleh template `!menu`
- **Middleware** — `bot.use(fn)`
- **Objek `Context`** yang ramah pakai — `ctx.reply()`, `ctx.args`, `ctx.sender`, dst — menggantikan objek pesan mentah
- **Penanganan pesan lengkap** — setiap tipe pesan sudah diklasifikasikan (`ctx.type`: teks, gambar, video, audio/voice note, stiker, dokumen, kontak, lokasi, poll, balasan tombol/list, undangan grup, edit/hapus, dan lainnya), dengan pembongkaran otomatis untuk pesan *ephemeral*/*view-once*
- **Unduh & kirim media** — `ctx.download()` / `ctx.saveMedia()`, serta lebih dari 20 metode `ctx.sendXxx()` (gambar, video, audio, dokumen, stiker, kontak, lokasi, poll, tombol interaktif, list menu, album, tabel, code block, dan lain-lain — lihat [Referensi API](#referensi-api))
- **Manajemen pesan** — `ctx.react()`, `ctx.edit()` / `ctx.editMessage()`, `ctx.delete()` / `ctx.deleteMessage()`, `ctx.pin()`, `ctx.star()`, `ctx.forward()`
- **Dukungan pesan yang di-*reply* (Quoted)** — `ctx.quoted` memberi akses yang sama lengkapnya (download/react/delete) untuk pesan yang sedang dibalas
- **Auto-reconnect** bawaan dengan *exponential backoff*, plus manajemen sesi lewat `useMultiFileAuthState`
- **Event level-framework** yang jelas: `ready`, `message`, `disconnect`, `unknownCommand`
- **Middleware bawaan** siap pakai: logger, sistem permission (owner/admin), cooldown per-command, dan anti-spam
- **CLI** (`npx botify-wa build <nama-bot>`) untuk membuat proyek bot baru dari template

## Daftar Isi

- [Struktur Proyek](#struktur-proyek)
- [Instalasi](#instalasi)
- [Mulai Cepat](#mulai-cepat)
- [CLI](#cli)
- [Konfigurasi (`config.bt`)](#konfigurasi-configbt)
- [Referensi API](#referensi-api)
  - [`new Bot(options)`](#new-botoptions)
  - [`bot.command()` / `bot.use()` / `bot.on()`](#botcommand--botuse--boton)
  - [`Context`](#context)
  - [`Quoted`](#quoted)
- [Memperbarui Core yang Di-*vendor*](#memperbarui-core-yang-di-vendor)
- [Turun ke Koneksi Mentah](#turun-ke-koneksi-mentah)
- [Lisensi](#lisensi)

## Struktur Proyek

```
botify-wa/
├── vendor/core/       ← core protokol WhatsApp yang di-vendor (enkripsi, socket)
├── src/
│   ├── Bot.js         ← siklus hidup koneksi, dispatch command, event
│   ├── Context.js     ← class tipis — merakit seluruh mixin di bawah ini
│   ├── context/        ← ~40 method Context, dipisah per tanggung jawab
│   │   ├── derive-message-state.js  (pesan mentah → ctx.from/type/text/…)
│   │   ├── command-parsing.js       (teks/id → { command, args })
│   │   ├── jid-utils.js             (helper klasifikasi JID)
│   │   ├── sending/text.js          (reply, send, sendCard)
│   │   ├── sending/media.js         (sendImage, sendVideo, sendAudio, …)
│   │   ├── sending/interactive.js   (sendButtons, sendListMenu)
│   │   ├── sending/rich.js          (sendTable(V2), sendCodeBlock(V2), …)
│   │   ├── sending/other.js         (sendContact, sendPoll, sendPayment, …)
│   │   ├── media-transfer.js        (download, saveMedia)
│   │   ├── message-actions.js       (react, edit, delete, pin, star, …)
│   │   └── group-info.js            (isGroupAdmin, getGroupName, …)
│   ├── PluginManager.js
│   ├── middlewares/    ← logger, permission, cooldown, antiSpam
│   ├── config/         ← parser & schema untuk config.bt
│   └── templates/      ← template yang di-scaffold oleh CLI
├── examples/          ← contoh bot
├── bin/botify.js      ← entry point CLI
└── package.json
```

`Context` sendiri hanya bertanggung jawab atas konstruksi objeknya; seluruh method instance-nya tinggal di `src/context/*.js`, masing-masing file fokus pada satu tanggung jawab, lalu digabungkan ke `Context.prototype` di `src/Context.js`. Dengan begitu setiap file tetap ringkas, dan method pengiriman pesan baru punya "rumah" sendiri alih-alih menumpuk di satu file yang sudah besar. API publik (`ctx.reply()`, `ctx.sendImage()`, dst) tidak berubah — ini murni reorganisasi internal.

API core mentah tetap bisa diakses penuh lewat `bot.sock` kalau kamu perlu turun ke level yang lebih rendah.

## Instalasi

```bash
npm install
```

Core protokolnya sudah ter-*vendor* di `vendor/core/`, jadi tidak ada instalasi tambahan untuk bagian itu.

## Mulai Cepat

```js
import { Bot } from "./src/index.js";

const bot = new Bot({ prefix: "!" });

bot.command("ping", async (ctx) => {
  await ctx.reply("pong 🏓");
});

bot.on("ready", () => console.log("Bot online!"));

await bot.start();
```

Scan QR code yang muncul di terminal menggunakan WhatsApp (menu **Perangkat Tertaut**), dan bot langsung terhubung.

Lihat [`examples/simple-bot.js`](./examples/simple-bot.js) untuk contoh yang lebih lengkap (command, alias, middleware, menu bantuan).

## CLI

```bash
npx botify-wa build <nama-bot>   # scaffold proyek bot baru dari template
npx botify-wa help               # tampilkan bantuan
npx botify-wa version            # tampilkan versi framework
```

Perintah `build` akan menyalin template dari `src/templates/` (termasuk contoh plugin `ping`, `info`, `menu`, `admin`, dan `config.bt`) ke folder proyek baru. Aman dijalankan berulang kali — file yang sudah ada tidak akan ditimpa.

## Konfigurasi (`config.bt`)

Selain lewat opsi di kode (`new Bot({...})`), konfigurasi juga bisa ditaruh di file `config.bt` pada root proyek. Opsi dari kode selalu menang jika keduanya diisi.

```ini
[bot]
prefix       = "!"
session_path = "./session"
log_level    = "error"
print_qr     = true
# Format JID: "628XXXXXXXXXX@s.whatsapp.net"
owners       = []

[reconnect]
base_delay = 1000    # ms — percobaan reconnect pertama
max_delay  = 30000   # ms — batas atas exponential backoff

[cooldown]
default = 0          # ms — default global untuk semua command (0 = nonaktif)
# message = "⏳ Tunggu {remaining}s sebelum pakai command ini lagi."

[anti_spam]
enabled      = false
window_ms    = 5000  # ukuran rolling window (ms)
max_messages = 5     # maksimum command per pengirim per window
# message = "🚫 Kamu terlalu cepat! Tunggu sebentar."

[permission]
# owner_message = "🚫 Command ini khusus owner bot."
# admin_message = "🚫 Command ini khusus admin grup."

[logger]
enabled = true
show_pn = true       # tampilkan nomor telepon di samping LID pada log
```

Semua key bersifat opsional — key yang tidak diisi otomatis memakai nilai default dari Botify.

## Referensi API

### `new Bot(options)`

| Opsi | Default | Deskripsi |
|---|---|---|
| `sessionPath` | `"./session"` | Folder penyimpanan kredensial autentikasi |
| `prefix` | `"!"` | Prefix command |
| `printQR` | `true` | Cetak QR code ke terminal saat login pertama |
| `logLevel` | `"error"` | Level log core (`trace`–`silent`) |
| `socketConfig` | `{}` | Diteruskan langsung ke socket koneksi core |
| `owners` | `[]` | Daftar JID yang dianggap owner bot |
| `defaultCooldown` | `0` | Cooldown default (ms) untuk command yang tidak mengatur cooldown sendiri |
| `cooldownMessage` | – | Pesan saat kena cooldown — string atau `(ctx, remainingMs) => string` |
| `antiSpam` | `{ enabled:false, windowMs:5000, maxMessages:5 }` | Konfigurasi anti-spam |
| `permissionMessages` | – | Pesan khusus untuk penolakan `owner`/`admin` |
| `logger` | `{ enabled:true, showPn:true }` | Konfigurasi logger bawaan |
| `reconnectBaseDelay` / `reconnectMaxDelay` | `1000` / `30000` | Delay awal & batas atas (ms) untuk exponential backoff |
| `configDir` | cwd | Folder pencarian `config.bt` |

### `bot.command()` / `bot.use()` / `bot.on()`

| Method | Deskripsi |
|---|---|
| `bot.command(name, handler, opts?)` | Mendaftarkan command. `handler` menerima sebuah [`Context`](#context). `opts.aliases`, `opts.description`, `opts.category` (grouping untuk `!menu`), `opts.cooldown`, `opts.owner`, `opts.admin` semuanya opsional. Mengembalikan `CommandBuilder` — chain `.sub()` untuk sub-command (lihat di bawah), atau abaikan return value-nya kalau tidak butuh. |
| `bot.use(fn)` | Mendaftarkan middleware yang berjalan sebelum setiap dispatch command. `return false` untuk menghentikan chain. |
| `bot.on(event, handler)` | Event level-framework: `"ready"`, `"message"` (setiap pesan masuk, command maupun bukan), `"disconnect"`, `"unknownCommand"`. |

**Sub-command**

`bot.command()` mengembalikan `CommandBuilder`, yang punya method `.sub(name, handler, opts?)` untuk mendaftarkan sub-command bertingkat (`!admin ban`, `!admin kick`):

```js
bot.command("admin", async (ctx) => {
  await ctx.reply("Gunakan: !admin ban @user atau !admin kick @user");
}, { category: "Admin", admin: true }) // admin: true berlaku juga untuk sub di bawah
  .sub("ban",  async (ctx) => { /* ... */ }, { description: "Ban member" })
  .sub("kick", async (ctx) => { /* ... */ }, { description: "Kick member", cooldown: 10_000 });
```

Sub-command **mewarisi** `owner`/`admin`/`cooldown` dari command induknya, kecuali di-set ulang sendiri di `opts` milik sub tersebut (lihat `kick` yang override cooldown di atas). Di dalam handler, `ctx.args` sudah otomatis dipotong melewati nama sub-command (`!admin ban 628xxx` → `ctx.args` berisi `["628xxx"]`), dan `ctx.subcommand` berisi nama sub yang cocok (`"ban"`) atau `null` kalau tidak ada sub yang match.

> ⚠️ **Breaking change kecil**: sebelumnya `bot.command()` mengembalikan `this` (Bot), sehingga bisa dirangkai `bot.command().command()`. Sekarang ia mengembalikan `CommandBuilder`, jadi pola chaining itu tidak berlaku lagi — panggil `bot.command()` lagi sebagai statement terpisah (semua template bawaan sudah memakai pola ini).

### `Context`

**Properti inti**

| Properti | Deskripsi |
|---|---|
| `ctx.text` | Teks polos terbaik yang bisa diambil (isi pesan atau caption) |
| `ctx.command` / `ctx.args` | Nama command & argumen hasil parsing |
| `ctx.sender` / `ctx.from` | JID pengirim / JID chat |
| `ctx.isGroup` / `ctx.chatType` | Apakah dari grup, dan `"group" \| "channel" \| "broadcast" \| "private"` |
| `ctx.type` | Tipe pesan (lihat di bawah) |
| `ctx.mentions` / `ctx.isMentioned(jid)` | JID yang di-*mention* dalam pesan |
| `ctx.quoted` | Pesan yang sedang dibalas, sebagai [`Quoted`](#quoted) — atau `null` |
| `ctx.repliedToBot` | `true` kalau `ctx.quoted` adalah pesan yang dikirim bot sendiri |
| `ctx.isOwner` / `ctx.pushName` | Apakah pengirim terdaftar di `owners`, dan nama tampilannya |
| `ctx.id` | ID unik pesan ini (`key.id`) — untuk dedup/logging eksternal |
| `ctx.timestamp` | Waktu pesan dikirim, unix timestamp dalam **detik** (`null` kalau tidak ada) |
| `ctx.botJid` | JID bot sendiri (suffix device sudah dibersihkan), `null` sebelum tersambung |
| `ctx.isForwarded` / `ctx.forwardingScore` | Apakah pesan ditandai *forwarded*, dan sudah berapa kali di-forward |
| `ctx.expiration` | Durasi *disappearing message* chat ini dalam detik (`0` = nonaktif) |
| `ctx.raw` | Objek `WebMessageInfo` mentah dari core — *escape hatch* kalau butuh field yang belum dibungkus Botify |

**Tipe pesan** — `ctx.type` salah satu dari: `text`, `image`, `video`, `audio` (`ctx.isPtt` untuk voice note), `sticker`, `document`, `contact`, `contacts`, `location`, `liveLocation`, `poll`, `pollUpdate`, `reaction`, `buttonsResponse`, `listResponse`, `templateButtonReply`, `interactiveResponse`, `groupInvite`, `product`, `event`, `protocol` (edit/hapus — lihat `ctx.protocol.kind`), `unsupported`, `unknown`. Pembungkus *ephemeral* dan *view-once* dibongkar otomatis, jadi `ctx.type` selalu mencerminkan isi pesan yang sesungguhnya.

Field khusus per tipe terisi otomatis: `ctx.mimetype`, `ctx.caption`, `ctx.fileName`, `ctx.isViewOnce`, `ctx.location`, `ctx.contact` / `ctx.contacts`, `ctx.poll`, `ctx.buttonReply`, `ctx.listReply`, `ctx.groupInvite`, `ctx.protocol`.

**Mengirim pesan**

| Method | Deskripsi |
|---|---|
| `ctx.reply(text, opts?)` | Balas, mengutip (*quote*) pesan asal |
| `ctx.send(content, opts?)` | Kirim konten pesan apa pun yang kompatibel dengan core |
| `ctx.sendCard({ text?, title?, description?, thumbnail, url, highQuality? })` | Kartu link-preview ringan — lihat JSDoc di `sending/text.js` untuk detail |
| `ctx.sendImage(source, opts?)` | `source`: Buffer, path file, URL http(s), atau `{url}`/`{stream}` |
| `ctx.sendVideo(source, opts?)` | `opts.gifPlayback: true` untuk diputar seperti GIF |
| `ctx.sendAudio(source, opts?)` | `opts.ptt: true` untuk kirim sebagai voice note |
| `ctx.sendDocument(source, opts?)` | `opts.fileName`, `opts.mimetype` |
| `ctx.sendSticker(source, opts?)` | |
| `ctx.sendStickerPack({ name, publisher, description, stickers, cover }, opts?)` | Kirim sekumpulan stiker sebagai satu paket |
| `ctx.sendAlbum(items, opts?)` | Galeri berisi beberapa gambar/video sekaligus |
| `ctx.sendContact(contacts, opts?)` | Terima satu kontak atau array kontak |
| `ctx.sendLocation({ latitude, longitude, name?, address? })` | |
| `ctx.sendPoll({ name, options, selectableCount? })` | |
| `ctx.sendButtons(content, buttons, opts?)` | Tombol interaktif native (reply/url/copy/list) |
| `ctx.sendListMenu(content, sections, opts?)` | Menu list native (`single_select`) |
| `ctx.sendTable(title, headers, rows, opts?)` / `sendTableV2(table, opts?)` | Tabel kaya (V1/V2) |
| `ctx.sendRichList(title, items, opts?)` | List key/value tanpa judul kolom |
| `ctx.sendCodeBlock(code, opts?)` / `sendCodeBlockV2(code, opts?)` | Code block dengan syntax highlighting |
| `ctx.sendLink(text, links, opts?)` / `sendLinkV2(text, links, opts?)` | Teks dengan tautan inline |
| `ctx.sendRichMessage(submessages, opts?)` | Pesan gabungan dari beberapa submessage |
| `ctx.sendPayment({ amount, currency, note, from }, opts?)` | Permintaan pembayaran |
| `ctx.sendEvent({ name, description, startTime, endTime, location }, opts?)` | Undangan event kalender |
| `ctx.sendPollResult({ name, votes }, opts?)` | Hasil akhir poll |
| `ctx.sendProduct(product, opts?)` | Kartu produk katalog |
| `ctx.sendStatusMention(content, jids)` | Post Status (story) yang me-*mention* kontak tertentu |

**Unduh media**

| Method | Deskripsi |
|---|---|
| `ctx.download(opts?)` | Buffer (atau stream dengan `{asStream:true}`) — melempar error jika `!ctx.isMedia` |
| `ctx.saveMedia(filePath, opts?)` | Stream langsung ke disk, mengembalikan path file |

**Manajemen pesan**

| Method | Deskripsi |
|---|---|
| `ctx.react(emoji)` / `ctx.removeReaction()` | Beri / hapus reaksi bot |
| `ctx.editMessage(target, content)` | Edit pesan bot sendiri yang sudah terkirim — `target` adalah hasil dari `ctx.reply()`/`ctx.send()` |
| `ctx.deleteMessage(target?)` | Hapus untuk semua orang (pesan bot sendiri, atau pesan siapa pun jika bot adalah admin grup). Default: pesan yang memicu command |
| `ctx.edit(text)` / `ctx.delete()` | Shortcut yang langsung menyasar pesan pemicu itu sendiri |
| `ctx.pin(time?)` / `ctx.unpin()` | Pin/unpin pesan pemicu |
| `ctx.star(starred?)` | Star/unstar pesan pemicu |
| `ctx.forward(toJid, opts?)` | Teruskan pesan pemicu ke chat lain |

**Helper grup**: `ctx.isGroupAdmin()`, `ctx.isBotAdmin()` (apakah bot sendiri admin grup ini), `ctx.groupAdmins()` (array JID semua admin grup), `ctx.getGroupName()`, `ctx.describeChat()`.

### `Quoted`

`ctx.quoted` (jika ada) mencerminkan bagian-bagian relevan dari `Context` untuk pesan yang sedang dibalas: `type`, `text`, `mimetype`, `caption`, `isMedia`, `sender`/`senderNumber`, `fromMe` (juga tersedia sebagai `ctx.repliedToBot`), ditambah `.download()`, `.saveMedia(path)`, `.react(emoji)`, dan `.delete()`. Berguna untuk command bergaya "reply gambar dengan `!sticker`":

```js
bot.command("sticker", async (ctx) => {
  const target = ctx.type === "image" ? ctx : ctx.quoted;
  if (target?.type !== "image") return ctx.reply("Reply gambar dengan !sticker");
  await ctx.sendSticker(await target.download());
});
```

## Memperbarui Core yang Di-*vendor*

Karena core-nya di-*vendor* (bukan dependensi npm), ia tidak akan ter-*update* otomatis. Kalau suatu saat ingin menarik perbaikan protokol dari upstream, unduh source-nya, bandingkan (*diff*) dengan `vendor/core/`, lalu gabungkan perubahan secara manual — dengan begitu kamu tetap punya kendali penuh atas perubahan apa saja yang masuk ke framework-mu.

## Turun ke Koneksi Mentah

```js
bot.sock.ev.on("group-participants.update", (update) => {
  // event koneksi mentah dari core
});
```

## Lisensi

MIT — lihat [LICENSE](./LICENSE). Kode pihak ketiga yang di-*vendor* di `vendor/core/` tetap tunduk pada lisensi aslinya — lihat [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

**Catatan:** Gunakan secara bertanggung jawab dan sesuai Syarat & Ketentuan Layanan WhatsApp. Proyek ini tidak berafiliasi dengan WhatsApp Inc. atau Meta Platforms, Inc.