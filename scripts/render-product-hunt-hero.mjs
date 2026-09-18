import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const brandDir = path.join(root, "assets", "brand");
const screenshotPath = path.join(
  root,
  "assets",
  "screenshots",
  process.env.KAVRANTA_HERO_SCREENSHOT ?? "kavranta-overview.png",
);
const outputPath = path.join(
  brandDir,
  process.env.KAVRANTA_HERO_OUTPUT ?? "kavranta-product-hunt-hero.png",
);
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const width = Number(process.env.KAVRANTA_HERO_WIDTH ?? 1270);
const height = Number(process.env.KAVRANTA_HERO_HEIGHT ?? 760);

await mkdir(brandDir, { recursive: true });

const appImage = (await readFile(screenshotPath)).toString("base64");
const logoImage = (await readFile(path.join(brandDir, "kavranta-logo.svg"))).toString(
  "base64",
);

const browser = await chromium.launch({ executablePath: chromePath });
try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; }
          body {
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            background:
              radial-gradient(circle at 16% 8%, rgba(60, 213, 166, .20), transparent 38%),
              radial-gradient(circle at 92% 96%, rgba(53, 160, 208, .14), transparent 42%),
              #0b1713;
            color: #f5f8f6;
            font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .canvas { position: relative; width: 100%; height: 100%; padding: 58px 60px; }
          .brand { display: flex; align-items: center; gap: 14px; }
          .logo { width: 58px; height: 58px; object-fit: contain; filter: drop-shadow(0 10px 22px rgba(0,0,0,.28)); }
          .name { font-size: 23px; font-weight: 760; letter-spacing: -.02em; }
          .copy { position: relative; z-index: 2; width: 500px; margin-top: 62px; }
          h1 { font-size: 58px; line-height: 1.03; letter-spacing: -.055em; }
          h1 .accent { color: #4fe0b0; }
          p { margin-top: 22px; width: 468px; color: #bccbc4; font-size: 21px; line-height: 1.4; }
          .chips { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 30px; }
          .chip {
            border: 1px solid rgba(117, 233, 195, .25); border-radius: 999px;
            padding: 8px 13px; color: #b9f5df; background: rgba(53, 208, 160, .08);
            font-size: 14px; font-weight: 650;
          }
          .app {
            position: absolute; right: -86px; top: 130px; width: 800px; height: 520px;
            overflow: hidden; border-radius: 18px; border: 1px solid rgba(255,255,255,.16);
            background: #eef2ef; box-shadow: 0 40px 90px rgba(0,0,0,.52);
            transform: rotate(-1.5deg);
          }
          .bar { height: 32px; background: #20211f; display: flex; align-items: center; gap: 8px; padding-left: 14px; }
          .dot { width: 10px; height: 10px; border-radius: 50%; background: #ff5f57; }
          .dot:nth-child(2) { background: #ffbd2e; }
          .dot:nth-child(3) { background: #28c840; }
          .app img { width: 800px; display: block; }
        </style>
      </head>
      <body>
        <main class="canvas">
          <div class="brand">
            <img class="logo" src="data:image/svg+xml;base64,${logoImage}" />
            <span class="name">Kavranta</span>
          </div>
          <section class="copy">
            <h1>Every env var<br />in one place.<br /><span class="accent">Secrets stay secret.</span></h1>
            <p>Link local .env files, push to Cloudflare Workers, and let AI agents read names — never values.</p>
            <div class="chips">
              <span class="chip">Local-first</span>
              <span class="chip">Cloudflare push</span>
              <span class="chip">AI-safe broker</span>
            </div>
          </section>
          <section class="app">
            <div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i></div>
            <img src="data:image/png;base64,${appImage}" />
          </section>
        </main>
      </body>
    </html>
  `);
  await page.screenshot({ path: outputPath });
  await context.close();
} finally {
  await browser.close();
}

console.log(`Rendered ${path.relative(root, outputPath)} (${width}x${height} @2x)`);
