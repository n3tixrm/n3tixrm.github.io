// Renders the social preview and touch icon from scripts/*.html.
// Usage: npm run og   (set CHROME=/path/to/chrome if Playwright can't find a browser)
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, channel: process.env.CHROME ? undefined : "chrome" });

for (const [source, width, height, out] of [
  ["scripts/og.html", 1200, 630, "public/og.png"],
  ["scripts/icon.html", 180, 180, "public/apple-touch-icon.png"],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(new URL(source, root).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL(out, root)) });
  await page.close();
  console.log(`wrote ${out}`);
}

await browser.close();
