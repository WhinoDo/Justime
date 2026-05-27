const sharp = require('sharp');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

async function generateIcon(size) {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="url(#bg)"/>
  <text x="50%" y="52%" font-family="Arial, sans-serif" font-size="${Math.round(size * 0.5)}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">聚</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
  
  console.log(`Created icon-${size}x${size}.png`);
}

async function main() {
  const fs = require('fs');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const size of sizes) {
    await generateIcon(size);
  }
  
  console.log('All icons generated successfully!');
}

main().catch(console.error);
