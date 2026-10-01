import test from "node:test";
import assert from "node:assert/strict";
import { inlineAssets } from "../scripts/build-standalone.mjs";

test("直接開啟版不再依賴外部樣式或模組檔案，並保留授權", () => {
  const html = '<html lang="zh-Hant"><head><script type="module" crossorigin src="./assets/room.js"></script><link rel="stylesheet" crossorigin href="./assets/room.css"></head><body>白夜</body></html>';
  const result = inlineAssets(html, new Map([
    ["./assets/room.js", 'console.log("白夜 </script>");'],
    ["./assets/room.css", "body{margin:0}"],
  ]), "Three.js MIT license");
  assert.ok(result.includes("data-standalone"));
  assert.ok(result.includes("<style>body{margin:0}</style>"));
  assert.ok(result.includes('<script type="module">'));
  assert.ok(result.includes("<\\/script>"));
  assert.ok(result.includes("Three.js MIT license"));
  assert.ok(!result.includes('src="./assets/') && !result.includes('href="./assets/'));
});

test("缺少資源時不產生會顯示空白的直接開啟版", () => {
  assert.throws(() => inlineAssets('<html lang="zh-Hant"><head><script src="./assets/missing.js"></script></head></html>', new Map(), "license"), /缺少程式/);
});
