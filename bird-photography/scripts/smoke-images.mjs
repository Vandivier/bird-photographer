import { chromium } from "playwright-core";

const port = process.argv[2] ?? "3311";
const tag = process.argv[3] ?? "images";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const failed = [];
page.on("requestfailed", (r) => failed.push(r.url()));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
});
await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Bird Photographer");
await page.waitForTimeout(1500);

const box = await page.locator("div.cursor-crosshair").boundingBox();
await page.mouse.move(box.x + 400, box.y + 250);
await page.getByRole("button", { name: /snap photo/i }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `scripts/shot-${tag}.png`, fullPage: true });

console.log("Images on page:", await page.locator("div.cursor-crosshair img").count());
console.log("Fallback textboxes:", await page.locator("div.cursor-crosshair .rounded-lg").count());
console.log("Gallery captions:", await page.locator("figcaption").allTextContents());
console.log("Failed/404 requests:", failed);
await browser.close();
