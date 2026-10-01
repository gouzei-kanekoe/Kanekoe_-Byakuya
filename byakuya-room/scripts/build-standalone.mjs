import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Everything needed to render the room lives inside this file, including Three.js.
export function inlineAssets(html, assets, license) {
  let scriptCount = 0;
  let styleCount = 0;
  html = html.replace(/<html\s+lang=/, "<html data-standalone lang=");
  html = html.replace(
    /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
    (_, path) => {
      const script = assets.get(path);
      if (script == null) throw new Error(`缺少程式：${path}`);
      scriptCount++;
      return `<script type="module">${script.replace(/<\/script/gi, "<\\/script")}</script>`;
    },
  );
  html = html.replace(
    /<link\b(?=[^>]*rel="stylesheet")[^>]*href="([^"]+)"[^>]*>/g,
    (_, path) => {
      const style = assets.get(path);
      if (style == null) throw new Error(`缺少樣式：${path}`);
      styleCount++;
      return `<style>${style.replace(/<\/style/gi, "<\\/style")}</style>`;
    },
  );
  if (scriptCount !== 1 || styleCount !== 1)
    throw new Error("直接開啟版需要一份完整程式和一份樣式。");
  return html.replace("</head>", `<!--\n${license.replace(/--/g, "—")}\n-->\n</head>`);
}

export async function buildStandalone(project) {
  const dist = resolve(project, "dist");
  const html = await readFile(resolve(dist, "room.source.html"), "utf8");
  const assets = new Map();
  for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g))
    assets.set(match[1], await readFile(resolve(dist, match[1]), "utf8"));
  const license = await readFile(resolve(project, "public/THIRD_PARTY_LICENSES.txt"), "utf8");
  const standalone = inlineAssets(html, assets, license);
  const outputs = [resolve(project, "index.html"), resolve(dist, "index.html")];
  // The repository root keeps a double-click copy; refresh it so the two never drift.
  const rootCopy = resolve(project, "..", "直接開啟白夜.html");
  if (await access(rootCopy).then(() => true, () => false)) outputs.push(rootCopy);
  for (const path of outputs) await writeFile(path, standalone, "utf8");
  await writeFile(resolve(project, ".nojekyll"), "", "utf8");
  console.log("index.html 已產生，支援直接雙擊與 GitHub Pages，程式和樣式都已內嵌。");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildStandalone(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
