import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`file://${join(__dirname, "sprite-forge.html")}`);
await page.waitForTimeout(100);

const ids = await page.evaluate(() => Array.from(document.querySelectorAll("canvas")).map((c) => c.id));
console.log("canvases:", ids, "errors:", errors);

for (const id of ids) {
  const dataUrl = await page.evaluate((cid) => document.getElementById(cid).toDataURL("image/png"), id);
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  writeFileSync(join(__dirname, "sprites", `${id}.png`), Buffer.from(base64, "base64"));
}
console.log("done, wrote", ids.length, "sprites");
await browser.close();
