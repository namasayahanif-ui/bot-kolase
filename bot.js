const express = require("express");
const Jimp = require("jimp");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("🚀 Kolase API Running");
});

// ===== API KOLOSA =====
app.post("/kolase", async (req, res) => {
  try {
    const { fileUrls, caption } = req.body;

    if (!fileUrls || fileUrls.length === 0) {
      return res.status(400).send("No images");
    }

    const images = [];

    for (let url of fileUrls) {
      const img = await Jimp.read(url);
      images.push(img);
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

    // ===== TEXT (SIMPLE) =====
    if (caption) {
      const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
      const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

      const textHeight = Jimp.measureTextHeight(fontWhite, caption, size);
      const centerY = (size / 2) - (textHeight / 2);

      // shadow
      canvas.print(fontBlack, 5, centerY + 5, {
        text: caption,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, size);

      // text
      canvas.print(fontWhite, 0, centerY, {
        text: caption,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, size);
    }

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);

    res.set("Content-Type", "image/jpeg");
    res.send(buffer);

  } catch (err) {
    console.log(err);
    res.status(500).send("ERROR KOLOSA");
  }
});

// ===== PORT =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 API RUNNING ON PORT " + PORT);
});