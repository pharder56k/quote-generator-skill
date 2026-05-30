/**
 * HTML → PDF 渲染脚本
 * 使用 Playwright + Chromium 将 HTML 模板渲染为 PDF
 *
 * 用法：
 *   node scripts/render.js --input data.json --template default --output ./output/报价单.pdf
 *   node scripts/render.js --test  # 使用测试数据渲染
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import Handlebars from "handlebars";
import { registerHelpers } from "../references/helpers.js";

const __dirname = dirname(new URL(import.meta.url).pathname);
const TEMPLATES_DIR = resolve(__dirname, "../references/templates");

// --- 注册所有自定义助手 ---
registerHelpers(Handlebars);

// --- 参数解析 ---
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--test") {
      params.test = true;
    } else if (args[i].startsWith("--") && i + 1 < args.length) {
      params[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return params;
}

// --- 测试数据 ---
function getTestData() {
  return {
    company_name: "示例设计有限公司",
    project_name: "某商业空间全案设计",
    client_name: "某房地产开发有限公司",
    quote_date: "2026-05-30",
    items: [
      { seq: 1, category: "设计费", name: "空间概念设计", spec: "含平面布局及效果图", qty: 1, unit: "项", price: 30000, subtotal: 30000, note: "" },
      { seq: 2, category: "设计费", name: "深化施工图设计", spec: "全套施工图纸", qty: 1, unit: "项", price: 50000, subtotal: 50000, note: "" },
      { seq: 3, category: "材料费", name: "主材采购", spec: "详见材料清单", qty: 1, unit: "批", price: 120000, subtotal: 120000, note: "含运输" },
      { seq: 4, category: "施工费", name: "基础施工", spec: "拆除/水电/泥工/木工", qty: 200, unit: "m²", price: 800, subtotal: 160000, note: "" },
      { seq: 5, category: "其他", name: "项目管理费", spec: "全程项目管理", qty: 1, unit: "项", price: 20000, subtotal: 20000, note: "" },
    ],
    total_price: 380000,
    notes: "1. 以上报价含税，有效期 30 天\n2. 付款方式：签约付 30%，中期付 40%，验收付 30%\n3. 工期预估：60 个工作日",
  };
}

// --- 主流程 ---
async function main() {
  const params = parseArgs();

  // 1. 加载数据
  let data;
  if (params.test) {
    console.log("📋 使用测试数据...");
    data = getTestData();
  } else if (params.input) {
    const raw = readFileSync(resolve(process.cwd(), params.input), "utf-8");
    data = JSON.parse(raw);
  } else {
    console.error("❌ 请指定 --input <data.json> 或 --test");
    process.exit(1);
  }

  // 2. 加载模板
  const templateName = params.template || "default";
  const templatePath = resolve(TEMPLATES_DIR, `${templateName}.html`);
  if (!existsSync(templatePath)) {
    console.error(`❌ 模板文件不存在: ${templatePath}`);
    process.exit(1);
  }
  const templateSrc = readFileSync(templatePath, "utf-8");
  const template = Handlebars.compile(templateSrc);
  const html = template(data);

  // 3. 渲染 PDF
  console.log("🎨 启动 Playwright 渲染 PDF...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });

  // 4. 输出
  const outputDir = resolve(process.cwd(), params.output ? dirname(params.output) : "output");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = params.output || `output/${data.project_name}_${data.quote_date}.pdf`;
  await page.pdf({
    path: resolve(process.cwd(), outputFile),
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    printBackground: true,
  });

  await browser.close();
  console.log(`✅ PDF 已生成: ${outputFile}`);
}

main().catch((err) => {
  console.error("❌ 渲染失败:", err.message);
  process.exit(1);
});
