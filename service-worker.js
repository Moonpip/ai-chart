self.addEventListener("install", e => {
  console.log("SW install");
});

self.addEventListener("fetch", e => {
  // 何もしなくてOK（最低限）
});