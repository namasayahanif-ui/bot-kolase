const TelegramBot = require("node-telegram-bot-api");
const Jimp = require("jimp");
const axios = require("axios");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let userPhotos = {};
let waitingCaption = {};
let photoTimeout = {};

// ===== DATE =====
function getTodayDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");

  const months = [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"
  ];

  return `${day} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ===== FOTO (AUTO COUNT, NO SPAM) =====
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  const fileId = msg.photo[msg.photo.length - 1].file_id;

  if (!userPhotos[chatId]) userPhotos[chatId] = [];

  userPhotos[chatId].push(fileId);

  // debounce biar ga spam
  if (photoTimeout[chatId]) clearTimeout(photoTimeout[chatId]);

  photoTimeout[chatId] = setTimeout(() => {
    const total = userPhotos[chatId].length;

    bot.sendMessage(
      chatId,
      `📸 Foto masuk (${total}), ada lagi yang mau di upload?\n${user}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Sudah?", callback_data: "done" },
              { text: "Reset", callback_data: "reset" }
            ]
          ]
        }
      }
    );
  }, 1000); // tunggu 1 detik biar kumpulin foto
});

// ===== BUTTON =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === "done") {
    if (!userPhotos[chatId] || userPhotos[chatId].length === 0) {
      bot.sendMessage(chatId, "❌ Belum ada foto");
      return;
    }

    waitingCaption[chatId] = true;

    bot.sendMessage(chatId,
      "📝 Kirim caption + ukuran font\nContoh:\nTEXT\n|60"
    );
  }

  if (query.data === "reset") {
    userPhotos[chatId] = [];
    waitingCaption[chatId] = false;

    bot.sendMessage(chatId,
      "Woke shaapp, silakan upload ulang dari awal rekan"
    );
  }
});

// ===== CAPTION =====
bot.on("text", async (msg) => {
  const chatId = msg.chat.id;

  if (!waitingCaption[chatId]) return;

  waitingCaption[chatId] = false;

  bot.sendMessage(chatId, "⏳ Wait ya rekan kami kolase dulu...");

  let parts = msg.text.split("|");
  let caption = parts[0].trim().toUpperCase();

  caption += `\n${getTodayDate()}`;
  const lines = caption.split("\n");

  const fileIds = userPhotos[chatId];

  try {
    const images = [];

    for (let id of fileIds) {
      const file = await bot.getFile(id);
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const res = await axios.get(url, { responseType: "arraybuffer" });
      images.push(await Jimp.read(res.data));
    }

    // ===== GRID =====
    const count = images.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const size = 1000;
    const cellW = size / cols;
    const cellH = size / rows;

    const canvas = new Jimp(size, size, 0xffffffff);

    images.forEach((img, i) => {
      img.cover(cellW, cellH);
      const x = (i % cols) * cellW;
      const y = Math.floor(i / cols) * cellH;
      canvas.composite(img, x, y);
    });

    // ===== FONT =====
    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

    const textBlock = lines.join("\n");

    // ===== HITUNG TENGAH PRESISI =====
    const textHeight = Jimp.measureTextHeight(fontWhite, textBlock, size);
    const centerY = (size / 2) - (textHeight / 2);

    // ===== SHADOW =====
    canvas.print(fontBlack, 6, centerY + 6, {
      text: textBlock,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, size);

    // ===== OUTLINE TEBAL =====
    const offsets = [
      [-4,0],[4,0],[0,-4],[0,4],
      [-4,-4],[4,4],[-4,4],[4,-4],
      [-2,0],[2,0],[0,-2],[0,2]
    ];

    offsets.forEach(([ox, oy]) => {
      canvas.print(fontBlack, ox, centerY + oy, {
        text: textBlock,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, size);
    });

    // ===== TEXT PUTIH =====
    canvas.print(fontWhite, 0, centerY, {
      text: textBlock,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, size);

    // ===== UBAH JADI ORANGE (TEXT ONLY) =====
    canvas.scan(0, 0, size, size, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];

      if (r > 200 && g > 200 && b > 200) {
        this.bitmap.data[idx + 0] = 255;
        this.bitmap.data[idx + 1] = 100;
        this.bitmap.data[idx + 2] = 0;
      }
    });

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);

    await bot.sendPhoto(chatId, buffer);

    userPhotos[chatId] = [];

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "❌ Gagal membuat kolase");
  }
});