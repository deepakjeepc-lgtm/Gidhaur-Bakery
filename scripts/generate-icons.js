import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve(process.cwd(), 'public');

// 1. Generate 192x192 PNG
const svg192 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" fill="#ffffff"/>
  <text 
    x="96" 
    y="118" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="64" 
    font-weight="bold" 
    text-anchor="middle" 
    letter-spacing="-1.5"
  >
    <tspan fill="#ff502b">d</tspan><tspan fill="#0a0a0a">ee</tspan><tspan fill="#ff502b">p</tspan>
  </text>
</svg>
`;

// 2. Generate 512x512 PNG
const svg512 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#ffffff"/>
  <text 
    x="256" 
    y="314" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="172" 
    font-weight="bold" 
    text-anchor="middle" 
    letter-spacing="-4"
  >
    <tspan fill="#ff502b">d</tspan><tspan fill="#0a0a0a">ee</tspan><tspan fill="#ff502b">p</tspan>
  </text>
</svg>
`;

// 3. Generate 512x512 Maskable PNG (with 15% safe padding)
const svgMaskable512 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#ffffff"/>
  <text 
    x="256" 
    y="295" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="130" 
    font-weight="bold" 
    text-anchor="middle" 
    letter-spacing="-3"
  >
    <tspan fill="#ff502b">d</tspan><tspan fill="#0a0a0a">ee</tspan><tspan fill="#ff502b">p</tspan>
  </text>
  <text 
    x="256" 
    y="355" 
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
    font-size="28" 
    font-weight="800" 
    text-anchor="middle" 
    fill="#64748b" 
    letter-spacing="4"
  >
    BAKERY
  </text>
</svg>
`;

// 4. Generate 180x180 Apple Touch Icon
const svgApple = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <rect width="180" height="180" fill="#ffffff"/>
  <text 
    x="90" 
    y="110" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="60" 
    font-weight="bold" 
    text-anchor="middle" 
    letter-spacing="-1.5"
  >
    <tspan fill="#ff502b">d</tspan><tspan fill="#0a0a0a">ee</tspan><tspan fill="#ff502b">p</tspan>
  </text>
</svg>
`;

// 5. Generate mobile screenshot
const svgScreenshotMobile = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 960" width="540" height="960">
  <rect width="540" height="960" fill="#ffffff"/>
  <!-- Top Bar -->
  <rect width="540" height="70" fill="#0f172a"/>
  <text x="30" y="44" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">Gidhaur Bakery</text>
  <circle cx="500" cy="35" r="16" fill="#ff502b"/>
  <!-- Hero Banner -->
  <rect x="24" y="90" width="492" height="160" rx="24" fill="#fff7ed"/>
  <text x="50" y="150" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#9a3412">Fresh Artisanal Bakes</text>
  <text x="50" y="190" font-family="-apple-system, sans-serif" font-size="16" fill="#c2410c">Order online for fast local delivery</text>
  <!-- Menu Cards -->
  <rect x="24" y="275" width="234" height="240" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="282" y="275" width="234" height="240" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="24" y="535" width="234" height="240" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="282" y="535" width="234" height="240" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <!-- Bottom Bar -->
  <rect y="880" width="540" height="80" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <text x="270" y="930" font-family="-apple-system, sans-serif" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="middle">🍽️ Menu  •  🛵 Track Order  •  👤 Account</text>
</svg>
`;

async function generate() {
  console.log('Generating PNG assets for PWABuilder & Android APK compliance...');
  
  await sharp(Buffer.from(svg192)).png().toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Created icon-192.png');
  
  await sharp(Buffer.from(svg512)).png().toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  await sharp(Buffer.from(svgMaskable512)).png().toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('Created icon-maskable-512.png');

  await sharp(Buffer.from(svgApple)).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  await sharp(Buffer.from(svgScreenshotMobile)).png().toFile(path.join(publicDir, 'screenshot-mobile.png'));
  console.log('Created screenshot-mobile.png');

  console.log('All PNG assets generated successfully!');
}

generate().catch(console.error);
