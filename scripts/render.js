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

// --- 测试数据（字段名与飞书多维表一致）---
function getTestData() {
  return {
    项目名称: "天河隽悦园办公改造项目",
    工程编号: "RMD20260525",
    编制日期: "2026-05-22",
    编制人员: "RM DESIGN",
    items: [
      { 序号: "1.1", 工程分类: "措施项目", 项目名称: "脚手架", 项目特征: "室内脚手架", 单位: "项", 数量: 1, 综合单价: 3200, 合价: 3200, 备注: "" },
      { 序号: "1.2", 工程分类: "措施项目", 项目名称: "文明施工", 项目特征: "现场临时便溺设施；现场生活卫生设施", 单位: "项", 数量: 1, 综合单价: 500, 合价: 500, 备注: "" },
      { 序号: "1.3", 工程分类: "措施项目", 项目名称: "安全生产", 项目特征: "安全防护用品；消防设施", 单位: "项", 数量: 1, 综合单价: 500, 合价: 500, 备注: "" },
      { 序号: "2.1", 工程分类: "拆除工程", 项目名称: "砖砌体拆除", 项目特征: "室内轻质砖隔墙；涂料饰面", 单位: "㎡", 数量: 65.3, 综合单价: 65, 合价: 4244.5, 备注: "" },
      { 序号: "2.2", 工程分类: "拆除工程", 项目名称: "钢筋混凝土构件拆除", 项目特征: "钢筋混凝土楼板；厚度120mm", 单位: "项", 数量: 1, 综合单价: 1500, 合价: 1500, 备注: "" },
      { 序号: "8.1", 工程分类: "楼地面装饰工程", 项目名称: "细石混凝土找平层", 项目特征: "50mm；C20；提浆压光", 单位: "㎡", 数量: 226.4, 综合单价: 60, 合价: 13584, 备注: "" },
      { 序号: "8.3", 工程分类: "楼地面装饰工程", 项目名称: "陶瓷砖楼地面", 项目特征: "C2TE陶瓷砖胶粘剂；薄贴法；1500mm*750mm", 单位: "㎡", 数量: 105.2, 综合单价: 145, 合价: 15254, 备注: "" },
      { 序号: "13.1", 工程分类: "安装工程", 项目名称: "强电箱", 项目特征: "强电箱安装；漏保、空开配置安装", 单位: "项", 数量: 1, 综合单价: 2100, 合价: 2100, 备注: "" },
      { 序号: "13.2", 工程分类: "安装工程", 项目名称: "强电布线", 项目特征: "PVC电管暗铺设；预埋线盒；照明线BV-2.5mm²", 单位: "㎡", 数量: 226.4, 综合单价: 120, 合价: 27168, 备注: "" },
    ],
    total_price: 68550.5,
    notes: "1. 以上报价含税，有效期 30 天\n2. 付款方式：签约付 30%，中期付 40%，验收付 30%",
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

  const outputFile = params.output || `output/${data.项目名称}_${data.编制日期}.pdf`;
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
