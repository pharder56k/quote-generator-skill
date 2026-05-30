/**
 * HTML → PDF 渲染脚本
 * 使用 Playwright + Chromium 将 HTML 模板渲染为 PDF
 *
 * 用法：
 *   node scripts/render.js --input data.json --template default --output ./output/报价单.pdf
 *   node scripts/render.js --input data.json --vat-rate 0.06  # 指定增值税税率 6%
 *   node scripts/render.js --test  # 使用测试数据渲染
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import Handlebars from "handlebars";
import { registerHelpers } from "../references/helpers.js";

const __dirname = dirname(new URL(import.meta.url).pathname);
const TEMPLATES_DIR = resolve(__dirname, "../references/templates");

registerHelpers(Handlebars);

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

// --- 按工程分类分组，生成总价表和分页数据 ---
function buildTemplateData(raw, vatRate = 0.03) {
  const items = raw.items || [];

  // 按分类分组
  const grouped = {};
  for (const item of items) {
    const cat = item.工程分类 || "其他";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  // 保持分类顺序（按序号前缀排序）
  const catOrder = [...new Set(items.map((i) => i.工程分类))];
  const sortedCats = catOrder.filter(Boolean);

  // 总价表数据
  let 合计 = 0;
  const summary = sortedCats.map((cat, idx) => {
    const catTotal = grouped[cat].reduce((sum, i) => sum + (i.合价 || 0), 0);
    合计 += catTotal;
    return { 序号: String(idx + 1), 名称: cat, 金额: Math.round(catTotal * 100) / 100 };
  });

  合计 = Math.round(合计 * 100) / 100;
  const 增值税 = Math.round(合计 * vatRate * 100) / 100;
  const 总计 = Math.round((合计 + 增值税) * 100) / 100;

  // 明细分页（每页约 8-10 行数据，含分类标题和小计）
  const MAX_ROWS_PER_PAGE = 8;
  const pages = [];
  let currentRows = [];
  let pageNum = 3; // 封面=1, 总价表=2, 明细从3开始

  for (const cat of sortedCats) {
    const catItems = grouped[cat];
    const catNum = catItems[0]?.序号?.split(".")[0] || "";
    const catRows = [];

    // 分类标题行
    catRows.push({ isCategory: true, 序号: catNum, 项目名称: cat });

    // 明细行
    for (const item of catItems) {
      catRows.push({
        isCategory: false,
        isSubtotal: false,
        序号: item.序号,
        项目名称: item.项目名称,
        项目特征: item.项目特征,
        单位: item.单位,
        数量: item.数量,
        综合单价: item.综合单价,
        合价: item.合价,
      });
    }

    // 小计行
    const catTotal = catItems.reduce((sum, i) => sum + (i.合价 || 0), 0);
    catRows.push({ isSubtotal: true, 合价: Math.round(catTotal * 100) / 100 });

    // 分页逻辑
    if (currentRows.length + catRows.length > MAX_ROWS_PER_PAGE && currentRows.length > 0) {
      pages.push({ rows: currentRows, pageNum });
      pageNum++;
      currentRows = [];
    }
    currentRows.push(...catRows);
  }

  if (currentRows.length > 0) {
    pages.push({ rows: currentRows, pageNum });
  }

  return {
    项目名称: raw.项目名称,
    工程编号: raw.工程编号,
    编制日期: raw.编制日期,
    编制人员: raw.编制人员,
    联系邮箱: raw.联系邮箱,
    logo_url: raw.logo_url || "",
    hasItems: items.length > 0,
    summary,
    合计,
    增值税,
    总计,
    pages,
    totalPages: pageNum,
  };
}

// --- 测试数据 ---
function getTestData() {
  return {
    项目名称: "天河隽悦园办公改造项目",
    工程编号: "RMD20260525",
    编制日期: "2026年5月22日",
    编制人员: "RM DESIGN",
    联系邮箱: "87580967@qq.com",
    logo_url: "",
    items: [
      { 序号: "1.1", 工程分类: "措施项目", 项目名称: "脚手架", 项目特征: "室内脚手架", 单位: "项", 数量: 1, 综合单价: 3200, 合价: 3200 },
      { 序号: "1.2", 工程分类: "措施项目", 项目名称: "文明施工", 项目特征: "现场临时便溺设施；现场生活卫生设施；现场工人的防暑降温设备及用电；其他", 单位: "项", 数量: 1, 综合单价: 500, 合价: 500 },
      { 序号: "1.3", 工程分类: "措施项目", 项目名称: "安全生产", 项目特征: "安全防护用品；楼梯、楼板口围边；消防设施；电气保护、安全照明设施；其他", 单位: "项", 数量: 1, 综合单价: 500, 合价: 500 },
      { 序号: "1.4", 工程分类: "措施项目", 项目名称: "二次搬运", 项目特征: "现场材料、成品、半成品等进行二次或多次搬运", 单位: "㎡", 数量: 226.4, 综合单价: 15, 合价: 3396 },
      { 序号: "1.5", 工程分类: "措施项目", 项目名称: "已完工程及设备保护", 项目特征: "对已完成工程及设备采取的覆盖、包裹、封闭、隔离等必要保护措施", 单位: "㎡", 数量: 226.4, 综合单价: 10, 合价: 2264 },
      { 序号: "1.6", 工程分类: "措施项目", 项目名称: "既有建（构）筑物、设施保护", 项目特征: "对已建成的设施和建筑物遮盖、封闭、隔离等必要保护措施", 单位: "㎡", 数量: 32.2, 综合单价: 8, 合价: 257.6 },
      { 序号: "1.7", 工程分类: "措施项目", 项目名称: "建筑垃圾外运", 项目特征: "施工过程中产生的建筑垃圾外运至指定地点", 单位: "㎡", 数量: 226.4, 综合单价: 22, 合价: 4980.8 },
      { 序号: "2.1", 工程分类: "拆除工程", 项目名称: "砖砌体拆除", 项目特征: "室内轻质砖隔墙；涂料饰面", 单位: "㎡", 数量: 65.3, 综合单价: 65, 合价: 4244.5 },
      { 序号: "2.2", 工程分类: "拆除工程", 项目名称: "钢筋混凝土构件拆除", 项目特征: "钢筋混凝土楼板；厚度120mm；抹灰层基层及实木地板饰面", 单位: "项", 数量: 1, 综合单价: 1500, 合价: 1500 },
      { 序号: "2.3", 工程分类: "拆除工程", 项目名称: "平面块料拆除", 项目特征: "半干砂浆基层；瓷砖饰面", 单位: "㎡", 数量: 131.85, 综合单价: 45, 合价: 5933.25 },
      { 序号: "2.4", 工程分类: "拆除工程", 项目名称: "立面块料拆除", 项目特征: "半干砂浆基层；瓷砖饰面", 单位: "㎡", 数量: 36.7, 综合单价: 45, 合价: 1651.5 },
      { 序号: "2.5", 工程分类: "拆除工程", 项目名称: "天棚饰面拆除", 项目特征: "轻钢龙骨；石膏板饰面", 单位: "㎡", 数量: 92.3, 综合单价: 35, 合价: 3230.5 },
      { 序号: "2.6", 工程分类: "拆除工程", 项目名称: "铲除涂料面", 项目特征: "墙面、柱面、天棚的涂料面", 单位: "㎡", 数量: 195, 综合单价: 5, 合价: 975 },
      { 序号: "2.7", 工程分类: "拆除工程", 项目名称: "门窗拆除", 项目特征: "原门窗；高度≤2400mm", 单位: "樘", 数量: 9, 综合单价: 150, 合价: 1350 },
      { 序号: "2.8", 工程分类: "拆除工程", 项目名称: "卫生洁具拆除", 项目特征: "洗手盆；马桶；浴缸", 单位: "套", 数量: 2, 综合单价: 150, 合价: 300 },
      { 序号: "2.9", 工程分类: "拆除工程", 项目名称: "灯具拆除", 项目特征: "高度≤2800mm；射灯、吸顶灯、吊灯等", 单位: "项", 数量: 1, 综合单价: 1000, 合价: 1000 },
      { 序号: "2.10", 工程分类: "拆除工程", 项目名称: "柜体拆除", 项目特征: "人造板材柜体", 单位: "个", 数量: 3, 综合单价: 150, 合价: 450 },
      { 序号: "2.11", 工程分类: "拆除工程", 项目名称: "开孔（打洞）", 项目特征: "墙面；混凝土墙、轻质砖隔墙；洞尺寸见施工图纸", 单位: "个", 数量: 6, 综合单价: 80, 合价: 480 },
      { 序号: "8.1", 工程分类: "楼地面装饰工程", 项目名称: "细石混凝土找平层", 项目特征: "50mm；C20；提浆压光", 单位: "㎡", 数量: 226.4, 综合单价: 60, 合价: 13584 },
      { 序号: "8.2", 工程分类: "楼地面装饰工程", 项目名称: "平面砂浆找平层", 项目特征: "卫生间地面找平找坡；楼梯找平；M20预拌砂浆", 单位: "㎡", 数量: 30.71, 综合单价: 65, 合价: 1996.15 },
      { 序号: "8.3", 工程分类: "楼地面装饰工程", 项目名称: "陶瓷砖楼地面", 项目特征: "C2TE陶瓷砖胶粘剂；薄贴法；1500mm*750mm；2mm砖缝", 单位: "㎡", 数量: 105.2, 综合单价: 145, 合价: 15254 },
      { 序号: "8.4", 工程分类: "楼地面装饰工程", 项目名称: "木（复合）地板", 项目特征: "木地板铺装胶粘剂；满粘法；复合木地板", 单位: "㎡", 数量: 92.42, 综合单价: 120, 合价: 11090.4 },
      { 序号: "13.1", 工程分类: "安装工程", 项目名称: "强电箱", 项目特征: "强电箱安装；漏保、空开配置安装", 单位: "项", 数量: 1, 综合单价: 2100, 合价: 2100 },
      { 序号: "13.2", 工程分类: "安装工程", 项目名称: "强电布线", 项目特征: "PVC电管暗铺设；预埋线盒；照明线BV-2.5mm²（开关加零线）；插座线BV-4mm²", 单位: "㎡", 数量: 226.4, 综合单价: 120, 合价: 27168 },
      { 序号: "13.3", 工程分类: "安装工程", 项目名称: "强电布线（中央空调）", 项目特征: "PVC电管暗铺设；预埋线盒；BV-6mm²", 单位: "项", 数量: 1, 综合单价: 2500, 合价: 2500 },
    ],
  };
}

async function main() {
  const params = parseArgs();

  let raw;
  if (params.test) {
    console.log("使用测试数据...");
    raw = getTestData();
  } else if (params.input) {
    const r = readFileSync(resolve(process.cwd(), params.input), "utf-8");
    raw = JSON.parse(r);
  } else {
    console.error("请指定 --input <data.json> 或 --test");
    process.exit(1);
  }

  const vatRate = params["vat-rate"] ? parseFloat(params["vat-rate"]) : 0.03;
  const data = buildTemplateData(raw, vatRate);

  const templateName = params.template || "default";
  const templatePath = resolve(TEMPLATES_DIR, `${templateName}.html`);
  if (!existsSync(templatePath)) {
    console.error(`模板文件不存在: ${templatePath}`);
    process.exit(1);
  }
  const templateSrc = readFileSync(templatePath, "utf-8");
  const template = Handlebars.compile(templateSrc);
  const html = template(data);

  console.log("渲染 PDF...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });

  const outputDir = resolve(process.cwd(), params.output ? dirname(params.output) : "output");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const outputFile = params.output || `output/${data.项目名称}_${data.工程编号}.pdf`;
  await page.pdf({
    path: resolve(process.cwd(), outputFile),
    format: "A4",
    margin: { top: "15mm", bottom: "20mm", left: "18mm", right: "18mm" },
    printBackground: true,
  });

  await browser.close();
  console.log(`PDF 已生成: ${outputFile}`);
}

main().catch((err) => {
  console.error("渲染失败:", err.message);
  process.exit(1);
});
