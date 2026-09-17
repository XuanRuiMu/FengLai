const path = require("path");
const fs = require("fs");
const http = require("http");
const { chromium } = require("playwright");

const 端口 = 4551;
const 根目录 = path.join(__dirname, "..", "dist");
const 输出 = path.join(__dirname, "_shots");
const 日志文件 = path.join(输出, "_probe.log");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".glb": "model/gltf-binary",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".woff2": "font/woff2",
};
const 日志行 = [];
function 记(x) { 日志行.push(x); try { fs.writeFileSync(日志文件, 日志行.join("\n") + "\n"); } catch (e) {} }

function 起服务() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, "");
      const f = path.join(根目录, safe);
      if (!f.startsWith(根目录) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        r.writeHead(404).end("404"); return;
      }
      r.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(端口, () => res(s));
  });
}
const 等 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 探测(浏览器, { 名, 视口, 触摸, UA }) {
  const 上下文 = await 浏览器.newContext({
    viewport: 视口, hasTouch: 触摸, isMobile: 触摸,
    deviceScaleFactor: 触摸 ? 2 : 1, userAgent: UA,
  });
  const 页 = await 上下文.newPage();
  const 错 = [], 警 = [];
  页.on("pageerror", (e) => 错.push("PAGEERR: " + e.message));
  页.on("console", (m) => {
    const t = m.type();
    if (t === "error") 错.push("CONSOLE.ERR: " + m.text().slice(0, 160));
    else if (t === "warning") 警.push("WARN: " + m.text().slice(0, 160));
  });
  const cdp = 触摸 ? await 上下文.newCDPSession(页) : null;

  await 页.goto(`http://127.0.0.1:${端口}/?调试=1`, { waitUntil: "load", timeout: 60000 });
  await 页.waitForSelector("#loading.hidden", { timeout: 120000 });
  await 页.click("#nick-skip").catch(() => {});
  await 等(1200);
  await 页.evaluate(() => { window.蜂来.模型.停止动作?.(); try { window.蜂来.舞台.旋转锁定 = 9999; } catch (e) {} });
  await 等(900);

  const 待机 = await 页.evaluate(() => {
    const m = window.蜂来.模型;
    let 贴图 = 0, 顶点色 = 0, 网格 = 0;
    m.模型.traverse((o) => { if (o.isMesh) { 网格++; const ms = [].concat(o.material); for (const x of ms) { if (x && x.map) 贴图++; if (x && x.vertexColors) 顶点色++; } } });
    return { 网格, 贴图, 顶点色, 在动作: m.在动作, 着色可见: m.模型.visible, 部件可见: m.部件模型 && m.部件模型.visible };
  });
  记(`[${名}] 待机: ${JSON.stringify(待机)}`);

  await 页.evaluate(() => window.蜂来.模型.播放动作("跑"));
  await 等(1500);
  const 动作 = await 页.evaluate(() => {
    const m = window.蜂来.模型;
    let 顶点色 = 0, 贴图 = 0, 网格 = 0, 彩色 = false;
    m.部件模型.traverse((o) => {
      if (o.isMesh) {
        网格++;
        const ms = [].concat(o.material);
        for (const x of ms) { if (x && x.vertexColors) 顶点色++; if (x && x.map) 贴图++; }
        const c = o.geometry && o.geometry.attributes && o.geometry.attributes.color;
        if (c) { for (let i = 0; i < Math.min(c.count, 300); i++) { if (Math.abs(c.getX(i) - c.getY(i)) > 0.06 || Math.abs(c.getY(i) - c.getZ(i)) > 0.06) { 彩色 = true; break; } } }
      }
    });
    return { 网格, 顶点色材质数: 顶点色, 贴图数: 贴图, 在动作: m.在动作, 着色可见: m.模型.visible, 部件可见: m.部件模型.visible, 顶点色非灰: 彩色 };
  });
  记(`[${名}] 动作(跑): ${JSON.stringify(动作)}`);

  await 页.evaluate(() => window.蜂来.模型.停止动作());
  await 等(700);

  for (const 选 of ["#dock", "#danmu-input-bar", "#stat-panel", "#controls"]) {
    const r = await 拖面板(页, cdp, 选, 触摸);
    记(`[${名}] 拖动 ${选}: ${JSON.stringify(r)}`);
    // 双击归位（真实双击/双点）
    const g = await 双击归位(页, cdp, 选, 触摸, r);
    记(`[${名}] 归位 ${选}: ${JSON.stringify(g)}`);
  }

  记(`[${名}] 控制台 错误=${错.length} 警告=${警.length}`);
  错.slice(0, 15).forEach((e) => 记("  ✗ " + e));
  警.slice(0, 15).forEach((w) => 记("  ! " + w));
  await 上下文.close();
  return { 错, 警 };
}

async function 找起点(页, 选) {
  return await 页.evaluate((选) => {
    const el = document.querySelector(选);
    const r0 = el.getBoundingClientRect();
    const 点 = (x, y) => {
      const st = document.elementFromPoint(x, y);
      const 可拖 = !(st && st.closest && st.closest("button,input,textarea,a,.ctrl,.prop,.prop-tab,.emoji-btn,.act-chip"));
      return { x: Math.round(x), y: Math.round(y), st: st ? (String(st.className).slice(0, 28) || st.tagName) : "?", 可拖 };
    };
    const cand = [
      点(r0.left + r0.width / 2, r0.top + 8),
      点(r0.left + 16, r0.top + 8),
      点(r0.right - 16, r0.top + 8),
      点(r0.left + r0.width / 2, r0.bottom - 5),
      点(r0.left + 6, r0.top + r0.height / 2),
    ];
    const 起 = cand.find((c) => c.可拖) || cand[0];
    return 起;
  }, 选);
}

async function 拖面板(页, cdp, 选, 触摸) {
  const 起 = await 找起点(页, 选);
  const sx = 起.x, sy = 起.y, dx = -70, dy = -55;
  const 初偏 = await 页.evaluate((选) => {
    const el = document.querySelector(选);
    return { x: parseFloat(el.style.getPropertyValue("--拖X")) || 0, y: parseFloat(el.style.getPropertyValue("--拖Y")) || 0 };
  }, 选);
  if (触摸) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy }] });
    await 等(90);
    for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sx + (dx * i) / 8, y: sy + (dy * i) / 8 }] }); await 等(30); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await 页.mouse.move(sx, sy); await 页.mouse.down();
    for (let i = 1; i <= 8; i++) { await 页.mouse.move(sx + (dx * i) / 8, sy + (dy * i) / 8, { steps: 1 }); await 等(20); }
    await 页.mouse.up();
  }
  await 等(220);
  const 后 = await 页.evaluate((选) => {
    const el = document.querySelector(选);
    return { x: parseFloat(el.style.getPropertyValue("--拖X")) || 0, y: parseFloat(el.style.getPropertyValue("--拖Y")) || 0 };
  }, 选);
  return { 起点: 起.st, 起点可拖: 起.可拖, 偏移变化: { dx: Math.round(后.x - 初偏.x), dy: Math.round(后.y - 初偏.y) }, 期望: { dx, dy }, 最终偏移: { x: Math.round(后.x), y: Math.round(后.y) } };
}

async function 双击归位(页, cdp, 选, 触摸, 拖结果) {
  const 起 = await 找起点(页, 选);
  if (触摸) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 起.x, y: 起.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await 等(120);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 起.x, y: 起.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await 页.mouse.click(起.x, 起.y);
    await 等(120);
    await 页.mouse.click(起.x, 起.y);
  }
  await 等(520);
  const 后 = await 页.evaluate((选) => {
    const el = document.querySelector(选);
    return { x: parseFloat(el.style.getPropertyValue("--拖X")) || 0, y: parseFloat(el.style.getPropertyValue("--拖Y")) || 0 };
  }, 选);
  return { 归位: Math.abs(后.x) < 3 && Math.abs(后.y) < 3, 残留: { x: Math.round(后.x), y: Math.round(后.y) } };
}

(async () => {
  fs.mkdirSync(输出, { recursive: true });
  const 服务 = await 起服务();
  const 浏览器 = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const 桌面 = await 探测(浏览器, { 名: "桌面", 视口: { width: 1280, height: 800 }, 触摸: false });
  const 手机 = await 探测(浏览器, {
    名: "手机", 视口: { width: 390, height: 844 }, 触摸: true,
    UA: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  记("===== 汇总 =====");
  记(`桌面 错误 ${桌面.错.length} 警告 ${桌面.警.length}`);
  记(`手机 错误 ${手机.错.length} 警告 ${手机.警.length}`);
  await 浏览器.close();
  服务.close();
  process.exit(0);
})().catch((e) => { 记("PROBE ERR " + (e && e.stack || e)); process.exit(1); });
