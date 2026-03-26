const TelegramBot = require("node-telegram-bot-api");
const Jimp = require("jimp");
const axios = require("axios");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let userPhotos = {};
let waitingCaption = {};

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

// ===== TERIMA FOTO =====
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  const fileId = msg.photo[msg.photo.length - 1].file_id;

  if (!userPhotos[chatId]) userPhotos[chatId] = [];

  userPhotos[chatId].push(fileId);

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

  let text = msg.text;

  let parts = text.split("|");
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

    // ===== GARIS TENGAH =====
    const white = 0xffffffff;

    const lineThickness = 5;

    canvas.scan(0, 0, size, size, function (x, y, idx) {
      if (x === size / 2 || y === size / 2) {
        this.bitmap.data.writeUInt32BE(white, idx);
      }
    });

    // ===== FONT =====
    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

    const textBlock = lines.join("\n");

    const centerY = size / 2 - 100;

    // ===== SHADOW =====
    canvas.print(fontBlack, 5, centerY + 5, {
      text: textBlock,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, size);

    // ===== OUTLINE (FAKE STROKE) =====
    const offsets = [
      [-3,0],[3,0],[0,-3],[0,3],
      [-3,-3],[3,3],[-3,3],[3,-3]
    ];

    offsets.forEach(([ox, oy]) => {
      canvas.print(fontBlack, ox, centerY + oy, {
        text: textBlock,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, size);
    });

    // ===== TEXT UTAMA (ORANGE) =====
    canvas.print(fontWhite, 0, centerY, {
      text: textBlock,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, size);

    // 🔥 TINT ORANGE
    canvas.color([
      { apply: "mix", params: ["#ff5c00", 30] }
    ]);

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);

    await bot.sendPhoto(chatId, buffer);

    userPhotos[chatId] = [];

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "❌ Gagal membuat kolase");
  }
});