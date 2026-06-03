/**
 * 开箱即用演示 — 用内置测试数据渲染全部 4 个模板
 * 用法: npm run demo
 */

import { execFileSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER = resolve(__dirname, "render.js");

const templates = [
  { name: "swiss-ikb", label: "Swiss IKB（默认）" },
  { name: "swiss-ikb-zebra", label: "Swiss IKB Zebra" },
  { name: "bw", label: "B&W 黑白打印" },
  { name: "bw-zebra", label: "B&W Zebra" },
];

console.log("==> 室内报价系统 Skill — 演示渲染");
console.log("    数据来源: 内置测试数据（天河隽悦园办公改造项目）\n");

for (const tpl of templates) {
  process.stdout.write(`    ${tpl.label} ... `);
  try {
    execFileSync("node", [
      RENDER,
      "--test",
      "--template", tpl.name,
      "--output", `./output/demo_${tpl.name}.pdf`,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    console.log("✓");
  } catch (err) {
    console.log("✗ 失败");
    console.error(err.stderr?.toString() || err.message);
  }
}

console.log("\n==> 完成！PDF 在 output/ 目录下：");
for (const tpl of templates) {
  console.log(`    output/demo_${tpl.name}.pdf`);
}
console.log("\n    下一步: 复制飞书模板，填入自己的数据，对 AI 说 /报价");
