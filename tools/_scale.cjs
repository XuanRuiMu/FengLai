const path = require("path"), fs = require("fs"), http = require("http");
const { chromium } = require("playwright");
const 端口 = 4217, 根目录 = path.join(__dirname, "..", "dist");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".glb": "model/gltf-binary", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const 起服务 = () => new Promise((完成, 失败) => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(根目录, path.normalize(p).replace(/^(\.\.[/\\])+/, "")); if (!f.startsWith(根目录) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end("404"); return; } r.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream", "Content-Length": fs.statSync(f).size }); fs.createReadStream(f).pipe(r); }); s.once("error", 失败); s.listen(端口, () => 完成(s)); });
const 等 = ms => new Promise(r => setTimeout(r, ms));
const 看门狗 = setTimeout(() => { console.error("看门狗超时：脚本卡住，强制退出"); process.exit(2); }, 150000);
看门狗.unref?.();
(async () => {
  console.error("[1] 起服务…");
  const 服务 = await 起服务();
  console.error("[2] 服务就绪，启动 chromium…");
  const 浏览器 = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  console.error("[3] 打开页面…");
  const 页 = await 浏览器.newPage({ viewport: { width: 1280, height: 800 } });
  const 服务器错误 = [];
  页.on("pageerror", e => 服务器错误.push("pageerror: " + e.message));
  页.on("console", m => { if (m.type() === "error") 服务器错误.push(m.text()); });
  await 页.goto(`http://127.0.0.1:${端口}/?调试=1`, { waitUntil: "load", timeout: 60000 });
  console.error("[4] 等加载完成…");
  try { await 页.waitForSelector("#loading.hidden", { timeout: 120000 }); } catch (e) { console.error("加载超时：", e.message); }
  await 页.waitForTimeout(2500);
  console.error("[5] 量取模型…");
  const 数据 = await 页.evaluate(() => {
    const m = window.蜂来.模型;
    const 世界盒 = (o) => {
      o.updateMatrixWorld(true);
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      o.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
          obj.geometry.computeBoundingBox();
          const lo = obj.geometry.boundingBox.min, hi = obj.geometry.boundingBox.max;
          const M = obj.matrixWorld.elements;
          const 角 = [[lo.x, lo.y, lo.z], [hi.x, lo.y, lo.z], [lo.x, hi.y, lo.z], [hi.x, hi.y, lo.z], [lo.x, lo.y, hi.z], [hi.x, lo.y, hi.z], [lo.x, hi.y, hi.z], [hi.x, hi.y, hi.z]];
          for (const c of 角) {
            const wx = M[0] * c[0] + M[4] * c[1] + M[8] * c[2] + M[12];
            const wy = M[1] * c[0] + M[5] * c[1] + M[9] * c[2] + M[13];
            const wz = M[2] * c[0] + M[6] * c[1] + M[10] * c[2] + M[14];
            if (wx < mn[0]) mn[0] = wx; if (wy < mn[1]) mn[1] = wy; if (wz < mn[2]) mn[2] = wz;
            if (wx > mx[0]) mx[0] = wx; if (wy > mx[1]) mx[1] = wy; if (wz > mx[2]) mx[2] = wz;
          }
        }
      });
      return { 高: +(mx[1] - mn[1]).toFixed(4), 宽: +(mx[0] - mn[0]).toFixed(4), 深: +(mx[2] - mn[2]).toFixed(4) };
    };
    return {
      容器缩放: [m.容器.scale.x, m.容器.scale.y, m.容器.scale.z],
      待机: { scale: [m.模型.scale.x, m.模型.scale.y, m.模型.scale.z], 直接包围盒: 世界盒(m.模型) },
      部件: {
        scale: [m.部件模型.scale.x, m.部件模型.scale.y, m.部件模型.scale.z],
        直接包围盒: 世界盒(m.部件模型),
        子数: m.部件模型.children.length,
        枢轴数: m.部件模型.children.filter(c => c.name && c.name.startsWith("枢轴_")).length,
        可见: m.部件模型.visible,
        动作系统就绪: m.动作系统?.就绪 === true,
      },
    };
  });
  数据.错误 = 服务器错误.slice(0, 5);
  console.log(JSON.stringify(数据, null, 2));
  console.error("[6] 完成");
  await 浏览器.close(); 服务.close();
  clearTimeout(看门狗);
  process.exit(0);
})().catch(e => { console.error("脚本异常：", e); process.exit(1); });
