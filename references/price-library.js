/**
 * 价格库匹配引擎 + lark-cli 调用封装
 *
 * 职责:
 * - 封装 lark-cli 子进程调用（读/写飞书多维表）
 * - Dice Coefficient 字符串相似度算法
 * - 三档匹配：精确 / 模糊 / 无匹配
 */

import { execFileSync } from "child_process";

// ── lark-cli 调用封装 ──────────────────────────────────────────────

const LARK_CLI = "lark-cli";
const MAX_RETRIES = 2;

/** 调用 lark-cli，返回 JSON */
function execLarkCli(args, retries = MAX_RETRIES) {
  const maxAttempts = retries + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const stdout = execFileSync(LARK_CLI, args, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000,
      });
      return JSON.parse(stdout);
    } catch (err) {
      if (attempt < retries) {
        console.error(`lark-cli 调用失败，第 ${attempt + 1} 次重试...`);
        continue;
      }
      throw new Error(`lark-cli 调用失败（已重试 ${retries} 次）: ${err.message}`);
    }
  }
}

/**
 * 读取多维表全部记录（自动分页）
 * 返回: [{ record_id, fields: { ... } }, ...]
 */
export function fetchRecords(baseToken, tableId) {
  const allRecords = [];
  let pageToken = null;
  const pageSize = 200;

  do {
    const args = [
      "base", "+record-list",
      "--base-token", baseToken,
      "--table-id", tableId,
      "--format", "json",
      "--limit", String(pageSize),
    ];
    if (pageToken) args.push("--page-token", pageToken);

    const result = execLarkCli(args);

    // 兼容多种返回格式：{ items: [...] } 或 { records: [...] } 或直接 [...]
    let records;
    if (Array.isArray(result)) {
      records = result;
    } else {
      records = result.items || result.records || result.data || [];
    }

    allRecords.push(...records);
    pageToken = result.page_token || result.has_more ? result.page_token : null;
  } while (pageToken);

  return allRecords;
}

/**
 * 更新单条记录的字段
 * fields 格式: { "项目特征": "xxx", "综合单价": 3200, ... }
 */
export function updateRecord(baseToken, tableId, recordId, fields) {
  // select 字段的值在 lark-cli --json 中需用数组包裹
  const normalizedFields = {};
  for (const [key, val] of Object.entries(fields)) {
    normalizedFields[key] = val;
  }

  execLarkCli([
    "base", "+record-update",
    "--base-token", baseToken,
    "--table-id", tableId,
    "--record-id", recordId,
    "--json", JSON.stringify({ fields: normalizedFields }),
  ]);
}

// ── 字符串归一化 ────────────────────────────────────────────────────

/** 归一化：去空格、去标点符号间隙 */
function normalize(str) {
  return (str || "")
    .replace(/\s+/g, "")
    .replace(/[，。、；：！？（）《》【】""''—…\[\]{}<>]/g, "")
    .toLowerCase();
}

// ── Dice Coefficient ───────────────────────────────────────────────

/**
 * 生成 bigram 集合，用于 Dice 系数计算
 * 对中文和英文均适用
 */
function bigrams(str) {
  const s = normalize(str);
  if (s.length === 0) return new Set();
  if (s.length < 2) return new Set([s]); // 单字直接作为特征
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

/**
 * Dice Coefficient: 2 * |A ∩ B| / (|A| + |B|)
 * 范围 0-1，越高越相似
 */
export function diceCoefficient(str1, str2) {
  const a = bigrams(str1);
  const b = bigrams(str2);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection++;
  }
  return (2 * intersection) / (a.size + b.size);
}

// ── 匹配引擎 ────────────────────────────────────────────────────────

const FUZZY_THRESHOLD = 0.75;
const TOP_CANDIDATES = 3;

/**
 * 从 records 中提取价格库条目
 * 归一化字段类型（select 可能是 ["值"] 或 "值"）
 */
function normalizePriceEntry(record) {
  const f = record.fields || {};
  const getVal = (key) => {
    const v = f[key];
    if (Array.isArray(v)) return v[0] || "";
    return v ?? "";
  };
  return {
    record_id: record.record_id,
    工程分类: getVal("工程分类"),
    项目名称: getVal("项目名称"),
    项目特征: getVal("项目特征") || "",
    单位: getVal("单位"),
    综合单价: typeof f["综合单价"] === "number" ? f["综合单价"] : parseFloat(f["综合单价"]) || 0,
    备注: getVal("备注") || "",
    使用次数: typeof f["使用次数"] === "number" ? f["使用次数"] : parseInt(f["使用次数"]) || 0,
  };
}

/**
 * 核心匹配：逐条匹配报价明细 vs 价格库
 *
 * @param {Array} detailRecords - 报价明细记录 [{ record_id, fields: {...} }]
 * @param {Array} priceRecords - 价格库记录 [{ record_id, fields: {...} }]
 * @returns {Object} { exact, fuzzy, noMatch }
 */
export function matchItems(detailRecords, priceRecords) {
  const priceLib = priceRecords.map(normalizePriceEntry).filter((p) => p.项目名称);

  const exact = [];
  const fuzzy = [];
  const noMatch = [];

  for (const record of detailRecords) {
    const f = record.fields || {};
    const itemName = (typeof f["项目名称"] === "string" ? f["项目名称"] : (Array.isArray(f["项目名称"]) ? f["项目名称"][0] : "")) || "";

    if (!itemName) {
      noMatch.push({ record_id: record.record_id, seq: f["序号"] || "", name: itemName, reason: "项目名称为空" });
      continue;
    }

    // 检查是否已有数据（避免覆盖已填内容）
    const existingPrice = f["综合单价"];
    if (existingPrice !== undefined && existingPrice !== null && existingPrice !== "" && existingPrice !== 0) {
      // 已有单价，跳过（用户可能已手动填写）
      continue;
    }

    // Step 1: 精确匹配
    const exactMatch = priceLib.find((p) => normalize(p.项目名称) === normalize(itemName));
    if (exactMatch) {
      exact.push({
        record_id: record.record_id,
        seq: f["序号"] || "",
        name: itemName,
        filled: {
          项目特征: exactMatch.项目特征,
          综合单价: exactMatch.综合单价,
          单位: exactMatch.单位,
          备注: exactMatch.备注,
        },
      });
      continue;
    }

    // Step 2: 模糊匹配
    const scored = priceLib
      .map((p) => ({ ...p, similarity: diceCoefficient(itemName, p.项目名称) }))
      .filter((p) => p.similarity >= FUZZY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TOP_CANDIDATES);

    if (scored.length > 0) {
      fuzzy.push({
        record_id: record.record_id,
        seq: f["序号"] || "",
        name: itemName,
        candidates: scored.map((p) => ({
          name: p.项目名称,
          similarity: Math.round(p.similarity * 100) / 100,
          项目特征: p.项目特征,
          综合单价: p.综合单价,
          单位: p.单位,
          备注: p.备注,
        })),
      });
      continue;
    }

    // Step 3: 无匹配
    noMatch.push({
      record_id: record.record_id,
      seq: f["序号"] || "",
      name: itemName,
    });
  }

  return { exact, fuzzy, noMatch };
}

// ── 回写 ────────────────────────────────────────────────────────────

/**
 * 批量回写精确匹配的条目到报价明细
 * 逐条更新，失败不中断
 */
export function writeExactMatches(baseToken, detailTableId, exactMatches) {
  const succeeded = [];
  const failed = [];

  for (const item of exactMatches) {
    try {
      updateRecord(baseToken, detailTableId, item.record_id, {
        项目特征: item.filled.项目特征,
        综合单价: item.filled.综合单价,
        单位: item.filled.单位,
        备注: item.filled.备注,
      });
      succeeded.push(item);
    } catch (err) {
      failed.push({ ...item, error: err.message });
    }
  }

  return { succeeded, failed };
}

/**
 * 根据用户选择回写模糊匹配的条目
 * choices: { "<record_id>": { name, features, unitPrice, unit, remark }, ... }
 */
export function writeFuzzyChoices(baseToken, detailTableId, choices) {
  const succeeded = [];
  const failed = [];

  for (const [recordId, choice] of Object.entries(choices)) {
    try {
      updateRecord(baseToken, detailTableId, recordId, {
        项目特征: choice.项目特征 || choice.features || "",
        综合单价: choice.综合单价 || choice.unitPrice || 0,
        单位: choice.单位 || choice.unit || "",
        备注: choice.备注 || choice.remark || "",
      });
      succeeded.push({ record_id: recordId, name: choice.name });
    } catch (err) {
      failed.push({ record_id: recordId, name: choice.name, error: err.message });
    }
  }

  return { succeeded, failed };
}
