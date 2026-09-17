const path = require("path");
const fs = require("fs");
const http = require("http");
const { chromium } = require("playwright");

const 端口 = 4560;
const 根目录 = path.join(__dirname, "..", "dist");
const 输出 = path.join(__dirname, "_shots");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".glb": "model/gltf-binary", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg" };
function 起服务() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, "");
      const f = path.join(根目录, safe);
      if (!f.startsWith(根目录) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end("404"); return; }
      r.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(端口, () => res(s));
  });
}
const 等 = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(输出, { recursive: true });
  const 服务 = await 起服务();
  const 浏览器 = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const 页 = await (await 浏览器.newContext({ viewport: { width: 900, height: 1000 } })).newPage();
  页.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await 页.goto(`http://127.0.0.1:${端口}/?调试=1`, { waitUntil: "load", timeout: 60000 });
  await 页.waitForSelector("#loading.hidden", { timeout: 120000 });
  await 页.click("#nick-skip").catch(() => {});
  await 等(1200);
  await 页.evaluate(() => { try { window.蜂来.舞台.旋转锁定 = 9999; } catch (e) {} });

  // 直接切到分割模型 + 静止姿态（不播任何动作）
  await 页.evaluate(() => {
    const m = window.蜂来.模型;
    m.模型.visible = false;
    m.部件模型.visible = true;
    m.动作系统.当前动作 = null;
    m.动作系统.循环 = false;
    for (let i = 0; i < 5; i++) m.动作系统.更新(0.05);
  });
  await 等(1200);
  await 页.screenshot({ path: path.join(输出, "部件-静止.png") });
  console.log("✔ 部件静止截图");

  // 挥手：只动右臂，看头/头发/手臂是否分离
  await 页.evaluate(() => { const m = window.蜂来.模型; m.部件模型.visible = true; m.模型.visible = false; m.动作系统.播放("挥手"); });
  await 等(1400);
  await 页.screenshot({ path: path.join(输出, "部件-挥手.png") });
  console.log("✔ 部件挥手截图");

  // 点头：只动头，看头发跟不跟
  await 页.evaluate(() => window.蜂来.模型.动作系统.播放("点头"));
  await 等(1200);
  await 页.screenshot({ path: path.join(输出, "部件-点头.png") });
  console.log("✔ 部件点头截图");

  const 看门狗 = setTimeout(() => process.exit(0), 3000); 看门狗.unref?.();
  try { await Promise.race([浏览器.close(), 等(2500)]); } catch {}
  try { 服务.close(); } catch {}
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
