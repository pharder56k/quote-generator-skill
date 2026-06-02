/**
 * 生成所有活跃模板的封面 + 内容页预览图
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

// 构建模板数据（与 render.js buildTemplateData 一致）
function buildTemplateData(raw) {
  const items = raw.items || [];
  const grouped = {};
  for (const item of items) {
    const cat = item.工程分类 || "其他";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const sortSeq = (a, b) => {
    const pa = (a.序号 || "").split(".").map(Number);
    const pb = (b.序号 || "").split(".").map(Number);
    return (pa[0] - pb[0]) || (pa[1] - pb[1]);
  };
  for (const cat in grouped) grouped[cat].sort(sortSeq);

  const catOrder = [...new Set(items.map((i) => i.工程分类))];
  const sortedCats = catOrder.filter(Boolean);

  let total = 0;
  const summary = sortedCats.map((cat, idx) => {
    const catTotal = grouped[cat].reduce((sum, i) => sum + (i.合价 || 0), 0);
    total += catTotal;
    return { 序号: String(idx + 1), 名称: cat, 金额: Math.round(catTotal * 100) / 100 };
  });
  total = Math.round(total * 100) / 100;
  const vat = Math.round(total * 0.03 * 100) / 100;
  const grand = Math.round((total + vat) * 100) / 100;

  const catEnNames = {
    "措施项目": "Measures", "拆除工程": "Demolition", "砌筑工程": "Masonry",
    "混凝土及钢筋混凝土工程": "Concrete", "金属结构工程": "Steel Structure",
    "防水工程": "Waterproofing", "保温隔热工程": "Insulation",
    "楼地面装饰工程": "Floor Finishing", "墙柱面装饰与隔断工程": "Wall Finishing",
    "天棚工程": "Ceiling", "油漆涂料工程": "Painting", "其他装饰工程": "Other Finishing",
    "安装工程": "MEP Installation",
  };

  const detailRows = [];
  for (const cat of sortedCats) {
    const catItems = grouped[cat];
    const catNum = (catItems[0]?.序号?.split(".")[0] || "").padStart(2, "0");
    const catTotal = catItems.reduce((sum, i) => sum + (i.合价 || 0), 0);
    detailRows.push({ isCategory: true, 序号: catNum, 项目名称: cat, 英文名称: catEnNames[cat] || "" });
    let stripeIdx = 0;
    for (const item of catItems) {
      detailRows.push({
        isCategory: false, isSubtotal: false,
        isStripe: stripeIdx % 2 === 1,
        序号: item.序号, 项目名称: item.项目名称, 项目特征: item.项目特征,
        备注: item.备注 || "",
        单位: item.单位, 数量: item.数量, 综合单价: item.综合单价, 合价: item.合价,
      });
      stripeIdx++;
    }
    detailRows.push({ isSubtotal: true, 合价: Math.round(catTotal * 100) / 100 });
  }

  return { ...raw, hasItems: items.length > 0, summary, 合计: total, 增值税: vat, 总计: grand, detailRows };
}

const data = buildTemplateData(raw);
const browser = await chromium.launch();

for (const tpl of templates) {
  console.error(`生成预览: ${tpl.label}...`);

  const configPath = resolve(TEMPLATES_DIR, `${tpl.name}.json`);
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const isScreen = config.screen;
  const tableStyle = config.css["--table-style"] || "swiss";
  const pageMode = isScreen ? "screen" : "print";
  const cssVars = Object.entries(config.css).map(([k, v]) => `${k}: ${v};`).join("\n      ");
  const coverTemplate = config.coverTemplate || "cover-screen.html";

  // ── 封面预览 ──
  const coverPath = resolve(TEMPLATES_DIR, coverTemplate);
  const coverSrc = readFileSync(coverPath, "utf-8");
  const coverHtml = Handlebars.compile(coverSrc)(raw);
  const coverPage = await browser.newPage();
  await coverPage.setViewportSize({ width: 794, height: 1123 });
  await coverPage.setContent(coverHtml, { waitUntil: "networkidle" });
  await coverPage.screenshot({ path: resolve(PREVIEWS_DIR, `${tpl.name}-cover.png`) });
  await coverPage.close();

  // ── 内容页预览（总价表 + 前几个分类明细） ──
  const contentPath = resolve(TEMPLATES_DIR, "default.html");
  let contentSrc = readFileSync(contentPath, "utf-8");
  contentSrc = contentSrc.replace(/:root\s*\{[^}]+\}/, `:root {\n      ${cssVars}\n    }`);
  const pageCSS = config.pageCSS || "@page { size: A4; margin: 15mm 18mm 25mm 18mm; }";
  contentSrc = contentSrc.replace("__PAGE_RULES__", pageCSS);
  const contentHtml = Handlebars.compile(contentSrc)({ ...data, tableStyle, isScreen, pageMode });

  const contentPage = await browser.newPage();
  // 截取内容页第二页（总价表之后的首个分类明细页）
  await contentPage.setViewportSize({ width: 794, height: 2246 });
  await contentPage.setContent(contentHtml, { waitUntil: "networkidle" });
  await contentPage.screenshot({
    path: resolve(PREVIEWS_DIR, `${tpl.name}-content.png`),
    clip: { x: 0, y: 1123, width: 794, height: 1123 },
  });
  await contentPage.close();

  console.error(`  -> ${tpl.name}-cover.png, ${tpl.name}-content.png`);
}

await browser.close();
console.error("预览图生成完毕");
