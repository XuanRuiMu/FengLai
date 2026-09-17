// 验证 FBX 与 GLB 分割版是否为同一模型（部件数/结构）
globalThis.self = globalThis;
const fs = require("fs");
(async () => {
  const THREE = await import("three");
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const buf = fs.readFileSync("模型/武哲锋模型分割版.fbx");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new FBXLoader();
  loader.parse(ab, "", (obj) => {
    let meshes = 0; const parts = [];
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        const bb = new THREE.Box3().setFromObject(o);
        const c = bb.getCenter(new THREE.Vector3());
        parts.push(o.name + " x=" + c.x.toFixed(2) + " y=" + c.y.toFixed(2) + " z=" + c.z.toFixed(2));
      }
    });
    console.log("FBX meshes:", meshes);
    console.log(parts.sort().join("\n"));
    process.exit(0);
  }, (e) => { console.error("FBX ERR", e?.message || e); process.exit(2); });
  setTimeout(() => { console.error("FBX timeout"); process.exit(0); }, 30000);
})();
