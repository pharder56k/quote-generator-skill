/**
 * 生成所有活跃模板的封面预览图
 * 用法: node scripts/generate-previews.js
 * 输出: docs/previews/
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import Handlebars from "handlebars";
import { registerHelpers } from "../references/helpers.js";

const __dirname = dirname(new URL(import.meta.url).pathname);
const TEMPLATES_DIR = resolve(__dirname, "../references/templates");
const PREVIEWS_DIR = resolve(__dirname, "../docs/previews");
const TEST_DATA_PATH = resolve(__dirname, "../test-data/large-test.json");

registerHelpers(Handlebars);

const templates = [
  { name: "swiss-ikb", label: "Swiss IKB" },
  { name: "swiss-ikb-zebra", label: "Swiss IKB Zebra" },
  { name: "bw", label: "B&W" },
  { name: "bw-zebra", label: "B&W Zebra" },
];

if (!existsSync(PREVIEWS_DIR)) mkdirSync(PREVIEWS_DIR, { recursive: true });

const raw = JSON.parse(readFileSync(TEST_DATA_PATH, "utf-8"));
const browser = await chromium.launch();

for (const tpl of templates) {
  console.error(`生成预览: ${tpl.label}...`);

  const configPath = resolve(TEMPLATES_DIR, `${tpl.name}.json`);
  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  const coverTemplate = config.coverTemplate || "cover-screen.html";
  const coverPath = resolve(TEMPLATES_DIR, coverTemplate);
  const src = readFileSync(coverPath, "utf-8");
  const tplFn = Handlebars.compile(src);
  const html = tplFn(raw);

  const page = await browser.newPage();
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({
    path: resolve(PREVIEWS_DIR, `${tpl.name}.png`),
    fullPage: false,
  });
  await page.close();
  console.error(`  -> docs/previews/${tpl.name}.png`);
}

await browser.close();
console.error("预览图生成完毕");
