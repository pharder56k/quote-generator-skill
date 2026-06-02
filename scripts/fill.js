/**
 * 价格库智能填充脚本
 *
 * 从飞书多维表读取报价明细和价格库数据，执行三档匹配（精确/模糊/无匹配），
 * 精确匹配直接回写，模糊匹配返回候选让 Agent 请用户确认。
 *
 * 用法：
 *   node scripts/fill.js --base-token <token> --detail-table-id <id> --price-table-id <id>
 *   node scripts/fill.js --base-token <token> --detail-table-id <id> --price-table-id <id> --dry-run
 *
 * 输出（stdout）：JSON 格式的匹配结果，Agent 解析后处理模糊匹配交互
 * 退出码：0=成功, 1=参数错误, 2=数据读取失败, 3=部分回写失败
 */

import { fetchRecords, matchItems, writeExactMatches } from "../references/price-library.js";

// ── CLI 参数解析 ────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      params["dry-run"] = true;
    } else if (args[i].startsWith("--") && i + 1 < args.length) {
      params[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return params;
}

// ── 主流程 ──────────────────────────────────────────────────────────

async function main() {
  const params = parseArgs();

  // 验证必填参数
  const required = ["base-token", "detail-table-id", "price-table-id"];
  const missing = required.filter((k) => !params[k]);
  if (missing.length > 0) {
    console.error(`缺少必填参数: ${missing.map((m) => `--${m}`).join(", ")}`);
    console.error(
      "用法: node scripts/fill.js --base-token <token> --detail-table-id <id> --price-table-id <id> [--dry-run]"
    );
    process.exit(1);
  }

  const { "base-token": baseToken, "detail-table-id": detailTableId, "price-table-id": priceTableId } = params;
  const dryRun = params["dry-run"] === true;

  if (dryRun) {
    console.error("[dry-run] 仅预览匹配结果，不回写数据");
  }

  // Step 1: 读取报价明细
  console.error("读取报价明细...");
  let detailRecords;
  try {
    detailRecords = fetchRecords(baseToken, detailTableId);
  } catch (err) {
    console.error(`读取报价明细失败: ${err.message}`);
    process.exit(2);
  }

  if (!detailRecords || detailRecords.length === 0) {
    console.error("报价明细无数据，无需填充");
    process.exit(0);
  }

  console.error(`报价明细: ${detailRecords.length} 条`);

  // Step 2: 读取价格库
  console.error("读取价格库...");
  let priceRecords;
  try {
    priceRecords = fetchRecords(baseToken, priceTableId);
  } catch (err) {
    console.error(`读取价格库失败: ${err.message}`);
    process.exit(2);
  }

  if (!priceRecords || priceRecords.length === 0) {
    console.error("价格库暂无数据，请先积累报价后再使用填充功能");
    process.exit(0);
  }

  console.error(`价格库: ${priceRecords.length} 条`);

  // Step 3: 匹配
  console.error("执行匹配...");
  const { exact, fuzzy, noMatch } = matchItems(detailRecords, priceRecords);

  console.error(
    `匹配结果: 精确 ${exact.length} 条, 模糊 ${fuzzy.length} 条, 无匹配 ${noMatch.length} 条`
  );

  // Step 4: 回写精确匹配
  let writeResult = { succeeded: [], failed: [] };
  if (!dryRun && exact.length > 0) {
    console.error(`回写精确匹配 ${exact.length} 条...`);
    writeResult = writeExactMatches(baseToken, detailTableId, exact);
    if (writeResult.failed.length > 0) {
      console.error(`回写失败 ${writeResult.failed.length} 条`);
    }
  }

  // Step 5: 输出结果 JSON（stdout 给 Agent 消费）
  const result = {
    summary: {
      total: detailRecords.length,
      exact: exact.length,
      fuzzy: fuzzy.length,
      no_match: noMatch.length,
      written: writeResult.succeeded.length,
      write_failed: writeResult.failed.length,
      dry_run: dryRun,
    },
    exact_matches: exact.map((e) => ({
      seq: e.seq,
      name: e.name,
      filled: e.filled,
    })),
    fuzzy_candidates: fuzzy,
    no_match: noMatch.map((n) => ({
      seq: n.seq,
      name: n.name,
    })),
    write_errors: writeResult.failed.map((f) => ({
      seq: f.seq,
      name: f.name,
      error: f.error,
    })),
  };

  // 控制台输出结果（stderr 是进度，stdout 是结果）
  process.stdout.write(JSON.stringify(result, null, 2));

  // 退出码
  if (writeResult.failed.length > 0) {
    process.exit(3);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`填充失败: ${err.message}`);
  process.exit(2);
});
