const TelegramBot = require("node-telegram-bot-api");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const fs = require("fs");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let userPhotos = {};

// ===== FUNCTION COVER =====
function drawCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;

  let sx, sy, sw, sh;

  if (imgRatio > canvasRatio) {
    sh = img.height;
    sw = sh * canvasRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / canvasRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ===== FUNCTION DATE =====
function getTodayDate() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");

  const months = [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"
  ];

  const month = months[now.getMonth()];
  const year = now.getFullYear();

  return `${day} ${month} ${year}`;
}

// ===== TERIMA FOTO =====
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  if (!userPhotos[chatId]) userPhotos[chatId] = [];

  userPhotos[chatId].push(fileId);

  bot.sendMessage(chatId, `📸 Foto masuk (${userPhotos[chatId].length}/4)`);

  if (userPhotos[chatId].length === 4) {
    bot.sendMessage(chatId, "📝 Kirim caption + ukuran font\nContoh:\nTEXT\n|60");
  }
});

// ===== TERIMA CAPTION =====
bot.on("text", async (msg) => {
  const chatId = msg.chat.id;

  if (!userPhotos[chatId] || userPhotos[chatId].length < 4) return;

  let text = msg.text;

  // ===== AMBIL SIZE =====
  let fontSize = 50;
  let parts = text.split("|");

  if (parts.length > 1) {
    fontSize = parseInt(parts[1]) || 50;
  }

  let caption = parts[0].trim().toUpperCase();

  // 🔥 TAMBAH TANGGAL OTOMATIS
  const today = getTodayDate();
  caption += `\n${today}`;

  const lines = caption.split("\n");

  const fileIds = userPhotos[chatId];

  try {
    // ===== DOWNLOAD FOTO =====
    const images = [];
    for (let id of fileIds) {
      const file = await bot.getFile(id);
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const response = await axios.get(url, {
        responseType: "arraybuffer",
      });

      images.push(await loadImage(response.data));
    }

    // ===== CANVAS =====
    const width = 1000;
    const height = 1000;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ===== DRAW FOTO =====
    drawCover(ctx, images[0], 0, 0, 500, 500);
    drawCover(ctx, images[1], 500, 0, 500, 500);
    drawCover(ctx, images[2], 0, 500, 500, 500);
    drawCover(ctx, images[3], 500, 500, 500, 500);

    // ===== GARIS =====
    ctx.strokeStyle = "white";
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.moveTo(500, 0);
    ctx.lineTo(500, 1000);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.lineTo(1000, 500);
    ctx.stroke();

    // ===== STYLE TEXT =====
    ctx.font = `bold ${fontSize}px Impact`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "black";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    ctx.lineWidth = 10;
    ctx.strokeStyle = "black";

    ctx.fillStyle = "#ff5c00";

    // ===== POSISI CENTER =====
    const lineHeight = fontSize + 10;
    const totalHeight = lines.length * lineHeight;
    let startY = (height / 2) - (totalHeight / 2) + (lineHeight / 2);

    lines.forEach((line, i) => {
      let y = startY + (i * lineHeight);
      ctx.strokeText(line, width / 2, y);
      ctx.fillText(line, width / 2, y);
    });

    // ===== SAVE =====
    const buffer = canvas.toBuffer("image/jpeg");
    fs.writeFileSync("output.jpg", buffer);

    // ===== KIRIM =====
    await bot.sendPhoto(chatId, "output.jpg");

    userPhotos[chatId] = [];

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "❌ Error saat proses gambar");
  }
});
