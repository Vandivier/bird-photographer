import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto("http://localhost:3311", { waitUntil: "networkidle" });
await page.waitForSelector("text=Bird Photographer");
await page.waitForTimeout(1500);
await page.screenshot({ path: "scripts/shot-1-initial.png" });

// Aim the lens at the middle-left of the scene, then snap two photos.
const viewport = page.locator("div.cursor-crosshair");
const box = await viewport.boundingBox();
await page.mouse.move(box.x + 250, box.y + 200);
await page.mouse.click(box.x + 250, box.y + 200);
await page.waitForTimeout(800);
await page.mouse.move(box.x + 550, box.y + 300);
await page.getByRole("button", { name: /snap photo/i }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "scripts/shot-2-after-snaps.png", fullPage: true });

// New scene button
await page.getByRole("button", { name: /new scene/i }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: "scripts/shot-3-new-scene.png" });

const gallery = await page.locator("figcaption").allTextContents();
console.log("Gallery captions:", JSON.stringify(gallery, null, 2));
await browser.close();
