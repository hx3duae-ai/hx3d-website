// Browser end-to-end check. Needs the server on :8420 and global playwright (NODE_PATH=$(npm root -g)).
// Usage: NODE_PATH=$(npm root -g) node tests/e2e_ui.js [outdir]
const { chromium } = require("playwright"); const fs = require("fs");
const OUT = process.argv[2] || "/tmp/shots"; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e))); pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await pg.goto("http://localhost:8420/"); await pg.waitForSelector(".card"); const cards = await pg.locator(".card").count(); await pg.screenshot({ path: OUT + "/home.png" });
  await pg.goto("http://localhost:8420/#/tool/keyboard"); await pg.waitForSelector("#go");
  await pg.selectOption('[data-k="kb.layout"]', "60"); await pg.click("#go");
  await pg.waitForFunction("document.querySelector('#stage').textContent==='done' && !document.querySelector('#go').disabled", null, { timeout: 240000 }); await pg.waitForTimeout(1500); await pg.screenshot({ path: OUT + "/keyboard.png" });
  await pg.waitForTimeout(500); const km = await pg.locator("#km div").count();
  await pg.locator("#km div").nth(5).click(); await pg.fill("#k1", "Z"); await pg.fill("#k2", "ي"); await pg.evaluate("document.querySelector('#stage').textContent=''"); await pg.click("#ka");
  await pg.waitForFunction("document.querySelector('#stage').textContent==='done' && !document.querySelector('#go').disabled", null, { timeout: 240000 }); await pg.waitForTimeout(1500);
  await pg.click("#exp"); await pg.waitForSelector("#exout a", { timeout: 300000 }); const links = await pg.locator("#exout a").count(); await pg.screenshot({ path: OUT + "/keyboard_export.png" });
  await pg.goto("http://localhost:8420/#/tool/text_to_3d"); await pg.waitForSelector("#go"); await pg.fill('[data-k="text"]', "مرحبا HX"); await pg.click("#go");
  await pg.waitForSelector("#exp", { timeout: 120000 }); await pg.waitForTimeout(1000); await pg.screenshot({ path: OUT + "/text.png" });
  await pg.click("#lang"); await pg.goto("http://localhost:8420/#/"); await pg.waitForTimeout(800); const dir = await pg.evaluate("document.documentElement.dir"); await pg.screenshot({ path: OUT + "/home_ar.png" });
  console.log(JSON.stringify({ cards, keymap_keys: km, export_links: links, dir_after_toggle: dir, js_errors: errs.slice(0, 5) })); await b.close();
})().catch((e) => { console.error("E2E FAIL", e.message); process.exit(1); });
