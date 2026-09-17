const path = require("path"), fs = require("fs"), http = require("http");
const { chromium } = require("playwright");
const 端口 = 4229, 根目录 = path.join(__dirname, "..", "dist");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".glb": "model/gltf-binary", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const 起服务 = () => new Promise((完成, 失败) => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(根目录, path.normalize(p).replace(/^(\.\.[/\\])+/, "")); if (!f.startsWith(根目录) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end("404"); return; } r.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream", "Content-Length": fs.statSync(f).size }); fs.createReadStream(f).pipe(r); }); s.once("error", 失败); s.listen(端口, () => 完成(s)); });
const 等 = ms => new Promise(r => setTimeout(r, ms));
const 看门狗 = setTimeout(() => { console.error("看门狗超时"); process.exit(2); }, 120000); 看门狗.unref?.();
(async () => {
  const 服务 = await 起服务();
  const 浏览器 = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const 页 = await 浏览器.newPage({ viewport: { width: 1280, height: 800 } });
  await 页.goto(`http://127.0.0.1:${端口}/?调试=1`, { waitUntil: "load", timeout: 60000 });
  try { await 页.waitForSelector("#loading.hidden", { timeout: 120000 }); } catch {}
  await 页.waitForTimeout(1500);
  const 选择器 = process.argv[2] || "#stat-panel";
  const 结果 = await 页.evaluate((s) => {
    const el = document.querySelector(s);
    const 读 = () => { const r = el.getBoundingClientRect(); return { cx: +(r.x + r.width/2).toFixed(1), cy: +(r.y + r.height/2).toFixed(1), 偏x: parseFloat(el.style.getPropertyValue("--拖X")) || 0, 偏y: parseFloat(el.style.getPropertyValue("--拖Y")) || 0, 可见: r.x < innerWidth && r.x + r.width > 0 && r.y < innerHeight && r.y + r.height > 0 }; };
    const 初 = 读();
    const dx = -130, dy = -90;
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const 基 = { bubbles: true, cancelable: true, pointerId: 7, pointerType: "mouse", button: 0, isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...基, clientX: cx, clientY: cy, buttons: 1 }));
    for (let i = 1; i <= 12; i++) el.dispatchEvent(new PointerEvent("pointermove", { ...基, clientX: cx + dx * i / 12, clientY: cy + dy * i / 12, buttons: 1 }));
    el.dispatchEvent(new PointerEvent("pointerup", { ...基, clientX: cx + dx, clientY: cy + dy, buttons: 0 }));
    const 拖后 = 读();
    // 双击归位
    el.dispatchEvent(new PointerEvent("pointerdown", { ...基, clientX: cx + dx, clientY: cy + dy, buttons: 1 }));
    el.dispatchEvent(new PointerEvent("pointerdown", { ...基, clientX: cx + dx, clientY: cy + dy, buttons: 1 }));
    return { 初, 拖后 };
  }, 选择器);
  await 页.waitForTimeout(600);
  const 回 = await 页.evaluate((s) => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { cx: +(r.x + r.width/2).toFixed(1), cy: +(r.y + r.height/2).toFixed(1), 偏x: parseFloat(el.style.getPropertyValue("--拖X")) || 0, 偏y: parseFloat(el.style.getPropertyValue("--拖Y")) || 0, 计算transform: cs.transform, 内联: el.getAttribute("style") }; }, 选择器);
  console.log(JSON.stringify({ 选择器, 初: 结果.初, 拖后: 结果.拖后, 回 }, null, 2));
  await 浏览器.close(); 服务.close(); clearTimeout(看门狗); process.exit(0);
})().catch(e => { console.error("异常:", e); process.exit(1); });
