/** 临时脚本：专测四个面板的拖动是否还会「跑掉」（桌面鼠标 + 手机触摸） */
const path = require("path");
const fs = require("fs");
const http = require("http");
const { chromium } = require("playwright");

const 端口 = 4188;
const 根目录 = path.join(__dirname, "..", "dist");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".glb": "model/gltf-binary", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

function 起服务() {
  const 服务 = http.createServer((请求, 响应) => {
    let 路径名 = decodeURIComponent(请求.url.split("?")[0]);
    if (路径名 === "/") 路径名 = "/index.html";
    const 文件 = path.join(根目录, path.normalize(路径名).replace(/^(\.\.[/\\])+/, ""));
    if (!文件.startsWith(根目录) || !fs.existsSync(文件) || fs.statSync(文件).isDirectory()) { 响应.writeHead(404).end("404"); return; }
    响应.writeHead(200, { "Content-Type": MIME[path.extname(文件).toLowerCase()] || "application/octet-stream", "Content-Length": fs.statSync(文件).size });
    fs.createReadStream(文件).pipe(响应);
  });
  return new Promise((完成) => 服务.listen(端口, () => 完成(服务)));
}

const 等 = (ms) => new Promise((r) => setTimeout(r, ms));
const 面板 = ["#dock", "#danmu-input-bar", "#stat-panel", "#controls"];
const 网址 = `http://127.0.0.1:${端口}/?调试=1`;

const 找抓取点 = (页, 选择器) =>
  页.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    for (let y = r.top + 2; y < r.bottom - 2; y += 4) {
      for (let x = r.left + 2; x < r.right - 2; x += 4) {
        const t = document.elementFromPoint(x, y);
        if (!t || !el.contains(t)) continue;
        if (t.closest("button, input, textarea, select, a, .ctrl, .prop, .prop-tab, .emoji-btn, .act-chip")) continue;
        return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return null;
  }, 选择器);

const 取矩形 = (页, 选择器) =>
  页.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }, 选择器);

(async () => {
  const 服务 = await 起服务();
  const 浏览器 = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  let 失败 = 0;
  const 记 = (名, 通过, 说明 = "") => { if (!通过) 失败++; console.log(`${通过 ? "✔" : "×"} ${名}${说明 ? ` — ${说明}` : ""}`); };

  for (const 场景 of [
    { 名: "桌面 1280x800 鼠标", viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
    { 名: "手机 390x844 触摸", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    console.log(`\n══════ ${场景.名} ══════`);
    const 上下文 = await 浏览器.newContext({ viewport: 场景.viewport, isMobile: 场景.isMobile, hasTouch: 场景.hasTouch, deviceScaleFactor: 1 });
    const 页 = await 上下文.newPage();
    页.on("pageerror", (e) => { 失败++; console.log("  ✗ pageerror:", e.message); });
    await 页.goto(网址, { waitUntil: "domcontentloaded" });
    await 页.evaluate(() => localStorage.clear());
    await 页.reload({ waitUntil: "domcontentloaded" });
    await 页.waitForSelector("#dock .prop", { timeout: 30000 });
    await 页.evaluate(() => { const b = document.querySelector("#nick-skip"); if (b) b.click(); }).catch(() => {});
    await 页.waitForTimeout(300);

    const 客户端 = 场景.hasTouch ? await 上下文.newCDPSession(页) : null;
    const 触摸 = async (类型, x, y) => {
      if (!客户端) return;
      await 客户端.send("Input.dispatchTouchEvent", { type: 类型, touchPoints: 类型 === "touchEnd" ? [] : [{ x, y, radiusX: 4, radiusY: 4, force: 1 }] });
    };

    // 统一往左上拖 60px：四个面板在这个方向都有足够余量，不会被夹取逻辑干扰
    const 差X = -60, 差Y = -60;
    for (const 选择器 of 面板) {
      const 点 = await 找抓取点(页, 选择器);
      if (!点) { 记(`${选择器} 找得到抓取点`, false); continue; }
      const 前 = await 取矩形(页, 选择器);

      if (客户端) await 触摸("touchStart", 点.x, 点.y); else { await 页.mouse.move(点.x, 点.y); await 页.mouse.down(); }
      const 按下后 = await 取矩形(页, 选择器);
      记(
        `${选择器} 按下不跳位`,
        Math.abs(按下后.left - 前.left) < 1.5 && Math.abs(按下后.top - 前.top) < 1.5,
        `Δ=(${(按下后.left - 前.left).toFixed(1)}, ${(按下后.top - 前.top).toFixed(1)})`
      );

      for (let i = 1; i <= 6; i++) {
        const x = 点.x + (差X * i) / 6, y = 点.y + (差Y * i) / 6;
        if (客户端) await 触摸("touchMove", x, y); else await 页.mouse.move(x, y);
      }
      if (客户端) await 触摸("touchEnd", 点.x + 差X, 点.y + 差Y); else await 页.mouse.up();
      // 抬起后再等两帧结算，避免 rAF 还没落地就读数
      await 页.waitForTimeout(500);

      const 后 = await 取矩形(页, 选择器);
      const 实差X = 后.left - 前.left, 实差Y = 后.top - 前.top;
      记(
        `${选择器} 位移跟手`,
        Math.abs(实差X - 差X) < 3 && Math.abs(实差Y - 差Y) < 3,
        `期望(${差X},${差Y}) 实际(${实差X.toFixed(1)},${实差Y.toFixed(1)})`
      );

      const 露宽 = Math.min(后.left + 后.width, 场景.viewport.width) - Math.max(后.left, 0);
      const 露高 = Math.min(后.top + 后.height, 场景.viewport.height) - Math.max(后.top, 0);
      记(`${选择器} 拖完仍可见`, 露宽 > 40 && 露高 > 20, `露出 ${露宽.toFixed(0)}×${露高.toFixed(0)}`);
    }

    // 往屏幕外狠拖：必须被夹住，不能消失
    {
      const 选择器 = "#stat-panel";
      const 点 = await 找抓取点(页, 选择器);
      if (点) {
        if (客户端) { await 触摸("touchStart", 点.x, 点.y); for (const [x, y] of [[-500, 400], [-900, 1200], [-900, 1600]]) await 触摸("touchMove", x, y); await 触摸("touchEnd", -900, 1600); }
        else { await 页.mouse.move(点.x, 点.y); await 页.mouse.down(); await 页.mouse.move(-500, 400); await 页.mouse.move(-900, 1200); await 页.mouse.up(); }
        await 页.waitForTimeout(500);
        const 后 = await 取矩形(页, 选择器);
        const 露宽 = Math.min(后.left + 后.width, 场景.viewport.width) - Math.max(后.left, 0);
        记(`${选择器} 拖出屏幕被夹住`, 露宽 >= 100, `仍露出 ${露宽.toFixed(0)}px`);
      }
    }

    // 刷新后位置记住
    {
      const 前 = await 取矩形(页, "#dock");
      await 页.reload({ waitUntil: "domcontentloaded" });
      await 页.waitForSelector("#dock .prop", { timeout: 30000 });
      await 页.waitForTimeout(600);
      const 后 = await 取矩形(页, "#dock");
      记("刷新后位置保留", Math.abs(后.left - 前.left) < 4 && Math.abs(后.top - 前.top) < 4, `Δ=(${(后.left - 前.left).toFixed(1)}, ${(后.top - 前.top).toFixed(1)})`);
    }

    // 双击归位
    {
      const 点 = await 找抓取点(页, "#dock");
      if (点) {
        if (客户端) {
          await 触摸("touchStart", 点.x, 点.y); await 触摸("touchEnd", 点.x, 点.y);
          await 触摸("touchStart", 点.x, 点.y); await 触摸("touchEnd", 点.x, 点.y);
        } else {
          await 页.mouse.dblclick(点.x, 点.y);
        }
        await 页.waitForTimeout(900);
        const 后 = await 取矩形(页, "#dock");
        const 居中偏差 = Math.abs(后.left + 后.width / 2 - 场景.viewport.width / 2);
        记("双击归位回到底部居中", 居中偏差 < 3 && 后.top + 后.height > 场景.viewport.height - 40, `居中偏差 ${居中偏差.toFixed(1)}，底距 ${(场景.viewport.height - 后.top - 后.height).toFixed(0)}`);
      }
    }

    await 上下文.close();
  }

  const 看门狗 = setTimeout(() => process.exit(失败 === 0 ? 0 : 1), 5000);
  看门狗.unref?.();
  try { await Promise.race([浏览器.close(), 等(4000)]); } catch {}
  服务.close();
  console.log(`\n${失败 === 0 ? "✔ 拖动测试全部通过" : `× 有 ${失败} 项失败`}`);
  process.exit(失败 === 0 ? 0 : 1);
})().catch((e) => { console.error("崩了：", e); process.exit(1); });
