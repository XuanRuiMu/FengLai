const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { MeshoptDecoder, MeshoptEncoder } = require("meshoptimizer");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});
function mb(n) { return (n / 1048576).toFixed(2); }
async function 主() {
  for (const f of process.argv.slice(2)) {
    const 全 = path.resolve(f);
    const 字节 = fs.statSync(全).size;
    console.log("\n════ " + path.basename(全) + " " + mb(字节) + " MB ════");
    const doc = await io.read(全);
    const root = doc.getRoot();
    console.log("节点 " + root.listNodes().length + " / 网格 " + root.listMeshes().length + " / 材质 " + root.listMaterials().length + " / 贴图 " + root.listTextures().length);
    for (const n of root.listNodes()) {
      const m = n.getMesh();
      console.log("  节点 \"" + n.getName() + "\" T=[" + n.getTranslation().map((v) => v.toFixed(3)) + "] R=[" + n.getRotation().map((v) => v.toFixed(3)) + "] S=[" + n.getScale().map((v) => v.toFixed(3)) + "] mesh=" + (m ? m.getName() : "-"));
    }
    let 顶点 = 0, 三角 = 0;
    for (const mesh of root.listMeshes()) {
      for (const p of mesh.listPrimitives()) {
        const 属性 = p.listSemantics().join(",");
        const c = p.getAttribute("POSITION").getCount();
        const idx = p.getIndices() ? p.getIndices().getCount() : c;
        顶点 += c; 三角 += idx / 3;
        console.log("  · " + mesh.getName() + ": [" + 属性 + "] 顶点=" + c + " 三角=" + (idx / 3));
      }
    }
    console.log("  合计 顶点=" + 顶点 + " 三角=" + 三角);
    for (const t of root.listTextures()) {
      const img = t.getImage();
      console.log("  贴图 " + t.getMimeType() + " " + (img ? mb(img.byteLength) : "0") + "KB");
    }
    for (const m of root.listMaterials()) {
      console.log("  材质 \"" + m.getName() + "\" base=" + !!m.getBaseColorTexture() + " 法线=" + !!m.getNormalTexture() + " MR=" + !!m.getMetallicRoughnessTexture());
    }
    console.log("  扩展: " + (root.listExtensionsUsed().map((e) => e.extensionName).join(", ") || "无"));
  }
}
主().catch((e) => { console.error(e); process.exit(1); });
