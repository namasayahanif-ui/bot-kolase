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
          [{ text: "Sudah?", callback_data: "done" }]
        ]
      }
    }
  );
});

// ===== TOMBOL =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === "done") {
    waitingCaption[chatId] = true;

    bot.sendMessage(chatId,
      "📝 Kirim caption + ukuran font\nContoh:\nTEXT\n|60"
    );
  }
});

// ===== TERIMA CAPTION =====
bot.on("text", async (msg) => {
  const chatId = msg.chat.id;

  if (!waitingCaption[chatId]) return;

  waitingCaption[chatId] = false;

  bot.sendMessage(chatId, "⏳ Wait ya rekan kami kolase dulu...");

  let text = msg.text;

  let fontSize = 50;
  let parts = text.split("|");

  if (parts.length > 1) {
    fontSize = parseInt(parts[1]) || 50;
  }

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

    // ===== TEXT =====
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

    const textBlock = lines.join("\n");

    canvas.print(
      font,
      0,
      size / 2 - 100,
      {
        text: textBlock,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      size,
      200
    );

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);

    await bot.sendPhoto(chatId, buffer);

    userPhotos[chatId] = [];

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "❌ Gagal membuat kolase");
  }
});