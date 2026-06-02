# fill.js — 价格库智能填充独立脚本设计方案

## 决策背景

原先 `/填充` 通过 SKILL.md 编排层执行：Agent 逐条读取数据、逐条匹配、逐条回写。核心问题：
- 数据量不可预测（小项目 20 条到大项目 100+ 条），逐条回写延迟线性增长
- Agent 上下文被大量 JSON 污染，token 消耗大
- 匹配逻辑依赖 Agent 推理，不够确定和可测

## 架构决策

**选择：独立 Node.js 脚本（方案 B）**，而非继续 SKILL.md 编排层（方案 A）。

关键决策点：
| 维度 | 决策 |
|------|------|
| 实现形式 | 独立 Node.js 脚本 `scripts/fill.js` |
| 飞书 API 调用 | `lark-cli` 子进程（复用已有配置，零额外认证） |
| 匹配算法 | Dice Coefficient + 三档分类（精确 / 模糊 / 无匹配） |
| 模糊匹配阈值 | 0.75，Top 3 候选 |
| 回写方式 | 逐条 update（后续按需升级 batch） |
| 合价字段 | 公式字段，飞书自动计算，无需脚本处理 |
| 交互模式 | 精确匹配静默填充，模糊匹配 Agent 用 AskUserQuestion 让用户选 |

## 文件结构

```
scripts/fill.js                    # CLI 入口 + 流程编排
references/price-library.js        # 匹配引擎 + lark-cli 封装
```

职责分离：
- `price-library.js` — 纯函数库：lark-cli 子进程调用、Dice Coefficient 算法、匹配逻辑、回写操作
- `fill.js` — CLI 参数解析、流程编排（读明细→读价格库→匹配→回写→输出 JSON）

## 调用链

```
用户: /填充 https://xxx.feishu.cn/base/TOKEN

Agent:
  1. 提取 base-token，lark-cli base +table-list 获取 table_id
  2. 一次调用:
     node scripts/fill.js \
       --base-token TOKEN \
       --detail-table-id tblXXX \
       --price-table-id tblV6sVrIceav2a3
  3. fill.js 内部:
     ├── execFileSync("lark-cli", ["base", "+record-list", ...])  → 读明细
     ├── execFileSync("lark-cli", ["base", "+record-list", ...])  → 读价格库
     ├── matchItems() 逐条三档匹配
     ├── writeExactMatches() 精确匹配逐条回写
     └── stdout → JSON 结果
  4. Agent 解析 JSON:
     - 精确匹配 → 直接告知用户
     - 模糊匹配 → AskUserQuestion 逐批确认
     - 无匹配 → 列出待填写项
```

## 匹配算法

### Dice Coefficient

```
bigrams("脚手架") = {"脚手", "手架"}
bigrams("室内脚手架") = {"室内", "内脚", "脚手", "手架"}

Dice = 2 * |intersection| / (|A| + |B|) = 2 * 2 / (2 + 4) = 0.67
```

选用 Dice 而非 Levenshtein 的理由：Dice 对中文短文本（2-10 字）的 bigram 重合度更敏感，区分度更好。Levenshtein 编辑距离在短文本上容易高估相似度。

### 三档分类

| 档位 | 条件 | 行为 |
|------|------|------|
| 精确匹配 | `normalize(a) === normalize(b)` | 直接回写 |
| 模糊匹配 | `dice >= 0.75` | 返回 Top 3 候选，Agent 让用户选 |
| 无匹配 | `dice < 0.75` | 跳过，标记待填写 |

## 错误处理

| 场景 | 处理 |
|------|------|
| lark-cli 网络超时 | 重试 2 次（共 3 次尝试） |
| 价格库为空 | 提示"请先积累报价"，退出码 0 |
| 报价明细为空 | 退出，退出码 0 |
| 部分回写失败 | 继续处理，结果标注失败项，退出码 3 |
| 单条字段缺失 | 跳过该条，归入 no_match |

## CLI 接口

```bash
# 正常填充
node scripts/fill.js \
  --base-token <token> \
  --detail-table-id <table_id> \
  --price-table-id <table_id>

# 预览模式（只匹配不回写）
node scripts/fill.js \
  --base-token <token> \
  --detail-table-id <table_id> \
  --price-table-id <table_id> \
  --dry-run
```

退出码：0=成功, 1=参数错误, 2=数据读取失败, 3=部分回写失败
stderr=进度日志，stdout=JSON 结果

## 输出 JSON 格式

```json
{
  "summary": { "total": 45, "exact": 38, "fuzzy": 5, "no_match": 2, "written": 38, "write_failed": 0 },
  "exact_matches": [{ "seq": "1.1", "name": "脚手架", "filled": {...} }],
  "fuzzy_candidates": [{ "seq": "3.2", "name": "...", "candidates": [...] }],
  "no_match": [{ "seq": "5.1", "name": "..." }],
  "write_errors": []
}
```
