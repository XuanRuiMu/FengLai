/**
 * 临时诊断脚本：定位 verify.cjs 中 toast/反应弹幕类检查失败的真实原因。
 * 只读不改业务代码。
 */
const path = require("path");
const fs = require("fs");
const http = require("http");
const { chromium } = require("playwright");

const 端口 = 4599;
const 根目录 = path.join(__dirname, "..", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
};

function 起服务() {
  const 服务 = http.createServer((请求, 响应) => {
    let 路径名 = decodeURIComponent(请求.url.split("?")[0]);
    if (路径名 === "/") 路径名 = "/index.html";
    const 文件 = path.join(根目录, path.normalize(路径名).replace(/^(\.\.[/\\])+/, ""));
    if (!文件.startsWith(根目录) || !fs.existsSync(文件) || fs.statSync(文件).isDirectory()) {
      响应.writeHead(404).end("404");
      return;
    }
    const 类型 = MIME[path.extname(文件).toLowerCase()] || "application/octet-stream";
    响应.writeHead(200, { "Content-Type": 类型, "Content-Length": fs.statSync(文件).size });
    fs.createReadStream(文件).pipe(响应);
  });
  return new Promise((完成) => 服务.listen(端口, () => 完成(服务)));
}

const 等 = (毫秒) => new Promise((r) => setTimeout(r, 毫秒));
const 时间戳 = () => `[${((performance.now() - global.起点) / 1000).toFixed(1)}s]`;

(async () => {
  global.起点 = performance.now();
  const 服务 = await 起服务();
  const 浏览器 = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const 页 = await (await 浏览器.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  页.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(时间戳(), "[console]", m.type(), m.text().slice(0, 160));
  });
  页.on("pageerror", (e) => console.log(时间戳(), "[pageerror]", e.message.slice(0, 200)));

  await 页.goto(`http://127.0.0.1:${端口}/`, { waitUntil: "load", timeout: 60000 });
  await 页.waitForSelector("#loading.hidden", { timeout: 120000 });
  console.log(时间戳(), "页面就绪");
  await 页.click("#nick-skip");
  await 等(500);

  // 1) 帧率 + 步长感知
  const 帧率 = await 页.evaluate(
    () =>
      new Promise((完成) => {
        let 帧数 = 0;
        const t0 = performance.now();
        const 数 = () => {
          帧数++;
          if (performance.now() - t0 < 2000) requestAnimationFrame(数);
          else 完成((帧数 / 2).toFixed(1));
        };
        requestAnimationFrame(数);
      })
  );
  console.log(时间戳(), `rAF 帧率: ${帧率} fps`);

  // 2) 监控 toast 增删
  await 页.evaluate(() => {
    const 层 = document.querySelector("#toast-layer");
    window.__toast日志 = [];
    new MutationObserver((变化) => {
      for (const 变 of 变化) {
        for (const 节点 of 变.addedNodes) window.__toast日志.push(["+", (节点.textContent || "").slice(0, 36), (performance.now() / 1000).toFixed(1)]);
        for (const 节点 of 变.removedNodes) window.__toast日志.push(["-", (节点.textContent || "").slice(0, 36), (performance.now() / 1000).toFixed(1)]);
      }
    }).observe(层, { childList: true });
  });

  // 3) 复现：轰炸 → 等 3.4s → 清洗 → 读 toast
  console.log(时间戳(), ">>> 点击轰炸");
  await 页.click('.ctrl[data-act="bomb"]');
  await 等(3400);
  console.log(时间戳(), ">>> 点击清洗");
  await 页.click('.ctrl[data-act="clean"]');
  await 等(1400);
  let toasts = await 页.evaluate(() => [...document.querySelectorAll(".toast")].map((n) => n.textContent));
  console.log(时间戳(), "清洗后 toast:", JSON.stringify(toasts));

  // 4) 弹幕口令
  await 页.fill("#danmu-input", "蜂来");
  await 页.press("#danmu-input", "Enter");
  await 等(1200);
  toasts = await 页.evaluate(() => [...document.querySelectorAll(".toast")].map((n) => n.textContent));
  const 反应弹幕数 = await 页.evaluate(() => document.querySelectorAll(".danmu").length);
  console.log(时间戳(), "口令后 toast:", JSON.stringify(toasts), `danmu同屏=${反应弹幕数}`);

  // 5) 再等 8 秒，观察轰炸尾流的 toast churn
  await 等(8000);
  toasts = await 页.evaluate(() => [...document.querySelectorAll(".toast")].map((n) => n.textContent));
  console.log(时间戳(), "8秒后 toast:", JSON.stringify(toasts));
  const 日志 = await 页.evaluate(() => window.__toast日志);
  console.log(时间戳(), "toast 增删日志（前 60 条）:");
  for (const 条 of 日志.slice(0, 60)) console.log("   ", 条.join("  "));

  // 6) 愤怒值与暴怒状态
  const 状态 = await 页.evaluate(() => ({
    愤怒: document.querySelector("#anger-value")?.textContent,
  }));
  console.log(时间戳(), "愤怒值:", JSON.stringify(状态));

  await 浏览器.close().catch(() => {});
  try {
    服务.closeAllConnections?.();
    服务.close();
  } catch {}
  process.exit(0);
})().catch((错误) => {
  console.error("诊断脚本崩了：", 错误);
  process.exit(1);
});
