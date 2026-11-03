// Browser E2E for the Creative Studio. Needs the server on :8420. NODE_PATH=$(npm root -g) node tests/e2e_media.js [outdir]
const { chromium } = require("playwright"); const fs = require("fs"); const OUT = process.argv[2] || "/tmp/shots"; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] }); const pg = await b.newPage({ viewport: { width: 1400, height: 1000 } }); const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e)));
  await pg.goto("http://localhost:8420/#/media/video"); await pg.waitForSelector("#sbtn");
  await pg.click("#sbtn"); await pg.waitForSelector("#sbv textarea"); const scenes = await pg.locator("#sbv .panel").count();
  await pg.fill('#sbv textarea[data-i="1"]', "الطباعة ثلاثية الأبعاد تبني المجسم طبقة فوق طبقة."); await pg.selectOption("#q", "draft"); await pg.click("#rbtn");
  await pg.waitForSelector("#out video", { timeout: 120000 }); await pg.waitForTimeout(1500);
  const checks = await pg.locator("#out .chk.ok").count(), bad = await pg.locator("#out .chk.fail").count(); await pg.screenshot({ path: OUT + "/video_page.png" });
  await pg.goto("http://localhost:8420/#/media/image"); await pg.waitForSelector("#go"); await pg.click("#go"); await pg.waitForSelector("#res img", { timeout: 60000 }); await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + "/image_page.png" });
  await pg.goto("http://localhost:8420/#/media/engines"); await pg.waitForSelector("table"); const eng = await pg.locator("table tr").count(); await pg.screenshot({ path: OUT + "/engines_page.png" });
  await pg.goto("http://localhost:8420/#/media/gallery"); await pg.waitForSelector(".card"); const cards = await pg.locator(".card").count();
  await pg.goto("http://localhost:8420/#/"); await pg.waitForSelector(".card"); const home = await pg.locator('a.card[href^="#/media"]').count();
  console.log(JSON.stringify({ storyboard_scenes: scenes, verify_ok: checks, verify_bad: bad, engine_rows: eng, gallery_cards: cards, home_media_cards: home, js_errors: errs })); await b.close();
})().catch((e) => { console.error("E2E FAIL", e.message); process.exit(1); });
