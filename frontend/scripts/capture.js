/**
 * Hero screenshot grabber. Loads the landing page, waits for the boot
 * animation to finish (~6s), then captures a clean PNG into ../docs/.
 *
 * Usage: node scripts/capture.js [--url=http://localhost:3000] [--out=../docs/hero.png]
 */

const puppeteer = require("puppeteer");
const path = require("path");

const url = (process.argv.find((a) => a.startsWith("--url=")) ?? "").slice(6) || "http://localhost:3000";
const out = (process.argv.find((a) => a.startsWith("--out=")) ?? "").slice(6) || path.join(__dirname, "..", "..", "docs", "hero.png");
const width = Number(process.env.W) || 1600;
const height = Number(process.env.H) || 1000;
const waitMs = Number(process.env.WAIT) || 8500;

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  console.log(`→ navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  console.log(`→ waiting ${waitMs}ms for boot animation`);
  await new Promise((r) => setTimeout(r, waitMs));
  console.log(`→ writing ${out}`);
  await page.screenshot({ path: out, fullPage: false });
  await browser.close();
  console.log(`✓ done (${width}x${height} @2x)`);
})();
