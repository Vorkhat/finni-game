import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const outputDir = resolve("resources/android");
const petPath = resolve(
  "apps/web/public/assets/finni/characters/pet-cat-ginger-baby-idle.webp",
);
const logoPath = resolve("apps/web/public/assets/finni/branding/logo-finni.webp");

await mkdir(outputDir, { recursive: true });

const iconBackdrop = Buffer.from(`
  <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#236AD4"/>
    <circle cx="512" cy="500" r="410" fill="#FFF3C9"/>
    <circle cx="512" cy="500" r="374" fill="#FFCC42"/>
  </svg>
`);
const solidBackdrop = Buffer.from(`
  <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#236AD4"/>
  </svg>
`);
const splashBackdrop = Buffer.from(`
  <svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="70%" cy="20%" r="90%">
        <stop offset="0" stop-color="#FFFFFF"/>
        <stop offset="0.55" stop-color="#EDF7FF"/>
        <stop offset="1" stop-color="#DCEBFF"/>
      </radialGradient>
    </defs>
    <rect width="2732" height="2732" fill="url(#g)"/>
    <circle cx="1366" cy="1200" r="690" fill="#FFF3C9"/>
  </svg>
`);

const petForIcon = await sharp(petPath)
  .resize(710, 710, { fit: "contain", background: "#00000000" })
  .png()
  .toBuffer();
const petForSplash = await sharp(petPath)
  .resize(980, 980, { fit: "contain", background: "#00000000" })
  .png()
  .toBuffer();
const logoForSplash = await sharp(logoPath)
  .resize(1120, 520, { fit: "inside", background: "#00000000" })
  .png()
  .toBuffer();

await sharp(iconBackdrop)
  .composite([{ input: petForIcon, left: 157, top: 185 }])
  .png()
  .toFile(resolve(outputDir, "icon-only.png"));

await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: "#00000000" },
})
  .composite([{ input: petForIcon, left: 157, top: 185 }])
  .png()
  .toFile(resolve(outputDir, "icon-foreground.png"));

await sharp(solidBackdrop)
  .png()
  .toFile(resolve(outputDir, "icon-background.png"));

await sharp(splashBackdrop)
  .composite([
    { input: petForSplash, left: 876, top: 590 },
    { input: logoForSplash, left: 806, top: 1600 },
  ])
  .png()
  .toFile(resolve(outputDir, "splash.png"));

await sharp(resolve(outputDir, "icon-only.png"))
  .resize(512, 512)
  .png()
  .toFile(resolve(outputDir, "icon-source-512.png"));

console.log(`Android source artwork prepared in ${outputDir}`);
