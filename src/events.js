const 监听表 = new Map();

export function 订阅(名, 回调) {
  if (!监听表.has(名)) 监听表.set(名, new Set());
  监听表.get(名).add(回调);
  return () => 取消订阅(名, 回调);
}

export function 取消订阅(名, 回调) {
  监听表.get(名)?.delete(回调);
}

export function 发布(名, 负载) {
  const 监听者 = 监听表.get(名);
  if (!监听者) return;
  for (const 回调 of [...监听者]) {
    try {
      回调(负载);
    } catch (错误) {
      console.error(`事件「${名}」监听者抛错`, 错误);
    }
  }
}

export function 清空事件() {
  监听表.clear();
}
