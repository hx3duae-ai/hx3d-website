// Makes sure today's 3 ideas exist. Run it from cron / Task Scheduler at 7am Dubai time:
//   macOS/Linux:  0 7 * * *  cd /path/to/hx-os && npm run daily
//   Windows:      schtasks /create /sc daily /st 07:00 /tn "HX daily" /tr "cmd /c cd /d C:\path\hx-os && npm run daily"
// The app also creates them automatically on the first visit of the day.
const base = process.env.HX_URL || "http://localhost:3100";
try {
  const r = await fetch(`${base}/api/content/ideas`, { method: "POST", body: "{}" });
  const j = await r.json();
  console.log(j.created ? `✓ ${j.created} new ideas for today` : "✓ today's ideas already exist", j.note ?? "");
} catch (e) {
  console.error(`HX OS is not running at ${base} — start it with npm run dev`, e.message);
  process.exit(1);
}
