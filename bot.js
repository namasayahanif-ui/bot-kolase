const express = require("express");
const Jimp = require("jimp");

const app = express();
app.use(express.json({ limit: "10mb" }));

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("🚀 Kolase API Running");
});

// ===== KOLOSA =====
app.post("/kolase", async (req, res) => {
  try {
    const { fileUrls, caption, fontSize } = req.body;

    if (!fileUrls || fileUrls.length === 0) {
      return res.status(400).send("No images");
    }

    const images = [];

    for (let url of fileUrls) {
      const img = await Jimp.read(url);
      images.push(img);
    }

    // ===== GRID DINAMIS =====
    const count = images.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const size = 1200;
    const cellW = size / cols;
    const cellH = size / rows;

    const canvas = new Jimp(size, size, 0xffffffff);

    images.forEach((img, i) => {
      img.cover(cellW, cellH);

      const x = (i % cols) * cellW;
      const y = Math.floor(i / cols) * cellH;

      canvas.composite(img, x, y);
    });

    // ===== TEXT STYLE PRO =====
    if (caption) {

      // pakai font besar default
      const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
      const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);

      const text = caption.toUpperCase();

      const textWidth = Jimp.measureText(fontBlack, text);
      const textHeight = Jimp.measureTextHeight(fontBlack, text, size);

      const centerX = (size / 2) - (textWidth / 2);
      const centerY = (size / 2) - (textHeight / 2);

      // ===== OUTLINE HITAM (REAL TEBAL) =====
      const outlineSize = 6;

      for (let dx = -outlineSize; dx <= outlineSize; dx++) {
        for (let dy = -outlineSize; dy <= outlineSize; dy++) {
          if (dx !== 0 || dy !== 0) {
            canvas.print(fontBlack, centerX + dx, centerY + dy, text);
          }
        }
      }

      // ===== TEXT ORANGE =====
      // trik: kita render putih lalu tint jadi orange
      const textLayer = new Jimp(size, size, 0x00000000);

      textLayer.print(fontWhite, centerX, centerY, text);

      // warna orange terang
      textLayer.color([
        { apply: "mix", params: ["#ff7a00", 100] }
      ]);

      canvas.composite(textLayer, 0, 0);
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