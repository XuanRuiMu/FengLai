/**
 * 生成轻量模型 model-lite.glb：给弱网 / 手机自动切换用（见 src/model.js 的 该用低模）。
 * 复用 optimize_glb.cjs 流水线，只是简化更狠、纹理更小。
 *
 * 用法：node tools/make_lite.cjs [输入.glb] [输出.glb]
 * 默认：输入 模型/武哲锋.glb，输出 public/model/model-lite.glb
 * 注意：输入必须用未压缩的原始模型——优化版.glb 是 meshopt 压缩格式，
 *       纹理压缩子进程读不了它；重新跑过 模型:优化 后要再跑一次本脚本。
 */
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const 根目录 = path.join(__dirname, "..");
const 输入 = path.resolve(process.argv[2] || path.join(根目录, "模型", "武哲锋.glb"));
const 输出 = path.resolve(process.argv[3] || path.join(根目录, "public", "model", "model-lite.glb"));

if (!fs.existsSync(输入)) {
  console.error("× 找不到输入模型：", 输入);
  process.exit(1);
}

console.log(`轻量模型：${path.basename(输入)} → ${path.relative(根目录, 输出)}`);
execFileSync(process.execPath, [path.join(__dirname, "optimize_glb.cjs"), 输入, 输出], {
  stdio: "inherit",
  env: { ...process.env, SIMPLIFY_RATIO: process.env.SIMPLIFY_RATIO || "0.12", TEX_SIZE: process.env.TEX_SIZE || "1024" },
});

const 大小 = fs.statSync(输出).size;
console.log(`✔ 轻量模型就位（${(大小 / 1048576).toFixed(2)} MB）`);
