const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { MeshoptDecoder, MeshoptEncoder } = require("meshoptimizer");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});

function mat4乘(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
  return o;
}
function 平移T(t) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, t[0],t[1],t[2],1]; }
function 缩放S(s) { return [s[0],0,0,0, 0,s[1],0,0, 0,0,s[2],0, 0,0,0,1]; }
function 旋转R(q) {
  const [x,y,z,w] = q; const x2=x+x,y2=y+y,z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2, wx=w*x2, wy=w*y2, wz=w*z2;
  return [1-yy-zz, xy+wz, xz-wy, 0, xy-wz, 1-xx-zz, yz+wx, 0, xz+wy, yz-wx, 1-xx-yy, 0, 0,0,0,1];
}
function 局部矩阵(n) { return mat4乘(mat4乘(平移T(n.getTranslation()), 旋转R(n.getRotation())), 缩放S(n.getScale())); }
function 变换点(m, x, y, z) {
  return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
}

async function 主() {
  for (const f of process.argv.slice(2)) {
    const doc = await io.read(path.resolve(f));
    const root = doc.getRoot();
    let mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity];
    const 入栈 = [[root.listScenes()[0] || root, [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]]];
    const 节点世界 = new Map();
    while (入栈.length) {
      const [n, M] = 入栈.pop();
      节点世界.set(n, M);
      for (const c of n.listChildren()) 入栈.push([c, mat4乘(M, 局部矩阵(c))]);
    }
    for (const mesh of root.listMeshes()) {
      for (const node of root.listNodes()) {
        if (node.getMesh() !== mesh) continue;
        const M = 节点世界.get(node) || [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
        for (const p of mesh.listPrimitives()) {
          const a = p.getAttribute("POSITION");
          const lo = a.getMin(), hi = a.getMax();
          const 角 = [[lo[0],lo[1],lo[2]],[hi[0],lo[1],lo[2]],[lo[0],hi[1],lo[2]],[hi[0],hi[1],lo[2]],[lo[0],lo[1],hi[2]],[hi[0],lo[1],hi[2]],[lo[0],hi[1],hi[2]],[hi[0],hi[1],hi[2]]];
          for (const c of 角) { const w = 变换点(M, c[0],c[1],c[2]); for (let i=0;i<3;i++){ mn[i]=Math.min(mn[i],w[i]); mx[i]=Math.max(mx[i],w[i]); } }
        }
      }
    }
    const 尺寸 = [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
    console.log(path.basename(f) + "  世界AABB 尺寸=[" + 尺寸.map(v=>v.toFixed(3)) + "]  中心=[" + [(mx[0]+mn[0])/2,(mx[1]+mn[1])/2,(mx[2]+mn[2])/2].map(v=>v.toFixed(3)) + "]");
    console.log("    → 直立判定: 高度(Y)=" + 尺寸[1].toFixed(3) + " vs Z=" + 尺寸[2].toFixed(3) + " → " + (尺寸[1] > 尺寸[2] * 1.3 ? "Y 轴直立(正常)" : "Z 轴更长(可能躺平!)"));
  }
}
主().catch(e=>{console.error(e);process.exit(1);});
