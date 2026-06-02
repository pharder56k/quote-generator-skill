---
name: quote-generator
version: 1.0.0
description: "工程量清单报价表生成：从飞书多维表或 Excel 文件读取报价数据，渲染为专业 PDF 报价单，自动发送到飞书对话并上传至飞书文档。当用户说 /报价、/quote 或提到生成报价单、报价表、工程量清单时使用。"
metadata:
  requires:
    bins: ["node"]
  projectPath: "/Volumes/NVME_2TB/quote-generator-skill"
---

# 全案设计报价系统

> 本 skill 将工程量清单数据渲染为专业 PDF 报价单，支持封面、总价表、明细页多页输出。

## 1. 何时使用本 Skill

### 触发条件

以下场景应使用本 skill：

- 用户输入 `/报价` 或 `/quote` — 生成 PDF 报价单
- 用户输入 `/填充` 或 "帮我填充报价" — 查询价格库自动填充
- 用户说"导入历史报价" — 批量导入历史数据到价格库
- 用户说"查看价格库" — 展示价格库统计
- 用户提到要将多维表或 Excel 中的报价数据转为 PDF 报价单

以下场景不应使用本 skill：

- 用户只是在编辑多维表数据（应使用 lark-base skill）
- 用户只是在查看报价历史（不需要重新生成）

### 前置依赖

- `lark-base` skill — 读取飞书多维表数据
- `lark-im` skill — 发送 PDF 到飞书对话
- `lark-drive` skill — 上传 PDF 到飞书文档
- `xlsx` skill — 解析 Excel 文件（当用户提供 Excel 时）
- Node.js 运行环境 + Playwright（已安装于项目目录）

## 2. 工作流程

```
用户触发 → 确认数据源 → 读取数据 → 确认 Logo → 确认税率 → 确认模板 → 渲染 PDF → 询问入库
```

### Step 1: 确认数据源

用户需提供以下之一：

1. **飞书多维表链接** — 如 `https://xxx.feishu.cn/base/XXX`
2. **Excel 文件** — 本地文件路径或通过对话上传

如果用户未提供，询问用户选择数据源。

### Step 2: 读取数据

#### 飞书多维表数据源

1. 从用户提供的链接中提取 `base-token`（URL 中 `/base/` 后的部分）
2. 列出表：`lark-cli base +table-list --base-token <token>`
3. 找到 **项目信息** 和 **报价明细** 两张表的 table_id
4. 读取项目信息：`lark-cli base +record-list --base-token <token> --table-id <项目信息table_id> --format json`
5. 读取报价明细：`lark-cli base +record-list --base-token <token> --table-id <报价明细table_id> --format json --limit 200`
6. 从项目信息中提取：项目名称、工程编号、编制日期、编制人员、联系邮箱、公司Logo、税率
7. 从报价明细中提取：序号、工程分类、项目名称、项目特征、单位、数量、综合单价、合价

#### Excel 数据源

使用 xlsx skill 解析 Excel，提取相同结构的数据。Excel 可能有多 sheet，需找到包含报价明细的 sheet（通常有"序号"、"工程分类"、"综合单价"等列头）。

### Step 3: 数据验证

> **注意：** 以下验证逻辑待实现，当前 render.js 不做数据校验，直接渲染。

读取数据后必须验证：

- `项目名称`、`工程编号`、`编制日期` 不能为空
- `报价明细` 至少有 1 条记录
- 每条记录必须有：`序号`、`工程分类`、`项目名称`、`单位`、`数量`、`综合单价`
- `合价` 如为空，自动计算：`数量 × 综合单价`
- `工程分类` 必须是以下 13 类之一（可扩展）：
  1. 措施项目
  2. 拆除工程
  3. 砌筑工程
  4. 混凝土及钢筋混凝土工程
  5. 门窗工程
  6. 屋面及防水工程
  7. 保温隔热防腐工程
  8. 楼地面装饰工程
  9. 墙柱面装饰工程
  10. 天棚装饰工程
  11. 油漆涂料裱糊工程
  12. 其他装饰工程
  13. 安装工程

验证失败时，列出具体问题并请用户修正数据源。

### Step 4: Logo 处理

> **必须执行，不可跳过。** 无论数据源是多维表还是 Excel，都必须检查并处理 Logo。

1. **从多维表读取**：检查项目信息表中的 `公司Logo` 附件字段
   - 如有附件，使用 **media API** 下载（`drive +download` 不支持多维表附件）：
     ```bash
     lark-cli api GET /open-apis/drive/v1/medias/{file_token}/download --output ./logo.png
     ```
   - 将图片转为 base64 data URI，传入渲染数据的 `logo_url` 字段
2. **从 Excel 读取**：检查 Excel 中是否有 logo 图片（通常嵌入在 sheet 中或作为附件）
   - 如有，提取并转为 data URI
3. **Logo 缺失时（必须询问用户）**：
   - 如果多维表或 Excel 中没有找到 Logo 图片，**必须向用户询问**：
     - "未在数据源中找到公司 Logo，请问如何处理？"
     - 选项 A：上传 Logo 图片
     - 选项 B：提供 Logo 图片 URL
     - 选项 C：不使用 Logo（PDF 中显示默认 "R M" 文字标识）
   - **不要默认跳过这一步**，即使用户说"直接生成"也要确认 Logo 处理方式

### Step 5: 确认税率

优先使用多维表项目信息中的 `税率` 字段值。如果多维表中没有该字段，则询问用户。

### Step 5.5: 确认模板风格

> **必须询问，不可跳过。** 即使之前使用过某个模板，也要每次都确认。

**询问用户选择模板：**

```
请选择报价单模板风格：
1. Swiss IKB（默认）— 蓝底满版封面 + 双语分类标题
2. Swiss IKB Zebra — 同上 + 内容明细行斑马纹（白/浅蓝交替）
3. B&W — 白底封面 + 浅灰强调，适合黑白打印
4. B&W Zebra — 同上 + 内容明细行斑马纹（白/浅灰交替）
```

如果用户回复中包含明确的模板名称或编号（如"1"、"Swiss IKB Zebra"、"B&W"），直接使用对应模板：
- `swiss-ikb` — Swiss IKB（默认）
- `swiss-ikb-zebra` — Swiss IKB Zebra
- `bw` — B&W 黑白打印版
- `bw-zebra` — B&W Zebra 黑白打印斑马纹版

### Step 6: 渲染 PDF

在项目目录下执行：

```bash
cd /Volumes/NVME_2TB/quote-generator-skill
node scripts/render.js --input <data.json> --template <模板名> --vat-rate <税率> --output ./output/<项目名称>_<工程编号>.pdf
```

渲染数据 JSON 格式：

```json
{
  "项目名称": "xxx",
  "工程编号": "xxx",
  "编制日期": "xxx",
  "编制人员": "xxx",
  "联系邮箱": "xxx",
  "logo_url": "data:image/png;base64,...",
  "items": [
    {
      "序号": "1.1",
      "工程分类": "措施项目",
      "项目名称": "脚手架",
      "项目特征": "室内脚手架",
      "单位": "项",
      "数量": 1,
      "综合单价": 3200,
      "合价": 3200
    }
  ]
}
```

税率通过 `--vat-rate` 参数传入，默认 3%。

### Step 7: 发送到飞书

> **注意：** 以下飞书集成功能待实现，当前需手动操作。

1. **发送到当前对话**：使用 `lark-cli im +messages-send --type media --file <pdf路径>`
2. **上传到飞书文档**：使用 `lark-cli drive +upload --file <pdf路径>` 获取文件链接
3. 回复用户：PDF 已生成，附上飞书文档链接

## 3. 项目结构

```
/Volumes/NVME_2TB/quote-generator-skill/
├── package.json                # 项目配置
├── scripts/
│   ├── render.js               # HTML → PDF 渲染引擎
│   └── fill.js                 # 价格库智能填充（新增）
├── references/
│   ├── templates/
│   │   ├── default.html        # Handlebars PDF 模板（内容页）
│   │   ├── cover-screen.html   # Swiss IKB 封面独立模板
│   │   ├── cover-bw.html       # B&W 黑白打印封面模板
│   │   ├── swiss-ikb.json      # Swiss IKB 配置
│   │   ├── swiss-ikb-zebra.json # Swiss IKB Zebra 配置
│   │   ├── bw.json             # B&W 黑白打印配置
│   │   └── bw-zebra.json       # B&W Zebra 配置
│   ├── helpers.js              # Handlebars 自定义 helper
│   ├── price-library.js        # 匹配引擎 + lark-cli 封装（新增）
│   └── bitable-config.json     # 多维表字段 ID 配置
├── docs/plans/                 # 设计文档
├── output/                     # 生成的 PDF 输出目录
└── README.md
```

## 4. 模板说明

PDF 模板包含三种页面：

1. **封面** — 工程名称、编号、日期、编制人员、logo（右上角）
2. **总价表** — 按工程分类汇总金额 + 合计/增值税/总计
3. **明细页** — 每页约 8 行数据，含分类标题、明细行、小计行、页码

## 5. 价格库（智能填充）

### 价格库表结构

价格库存在飞书多维表的"价格库"表中（table_id: `tblV6sVrIceav2a3`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| 工程分类 | 单选 | 13 类标准分类 |
| 项目名称 | 文本 | 用于匹配 |
| 项目特征 | 文本 | 默认特征 |
| 单位 | 单选 | ㎡/项/m 等 |
| 综合单价 | 货币 | 历史价格 |
| 备注 | 文本 | 默认备注 |
| 最后使用日期 | 日期 | 最近引用时间 |
| 使用次数 | 数字 | 累计引用次数 |
| 来源 | 单选 | 历史导入/手动添加/报价自动入库 |

### /填充 命令 — 自动填充

触发：`/填充 [多维表链接]` 或 "帮我填充报价"

**流程：**

1. 从用户提供的链接中提取 `base-token`
2. 列出表：`lark-cli base +table-list --base-token <token>`，找到 **报价明细** 和 **价格库** 的 table_id
3. **一次调用 fill.js**：
   ```bash
   cd /Volumes/NVME_2TB/quote-generator-skill
   node scripts/fill.js \
     --base-token <token> \
     --detail-table-id <报价明细table_id> \
     --price-table-id <价格库table_id>
   ```
4. fill.js 内部：
   - 读取报价明细全部记录
   - 读取价格库全部记录
   - 执行三档匹配（精确 / 模糊 / 无匹配）
   - 精确匹配直接回写多维表（项目特征 + 综合单价 + 单位 + 备注）
   - 输出 JSON 结果到 stdout
5. Agent 解析 JSON 结果：
   - **精确匹配**：直接告知用户已填充 N 条
   - **模糊匹配**：逐批用 AskUserQuestion 让用户选择（每批最多 4 条）
     - 用户选择后，调 lark-cli base +record-update 逐条回写
   - **无匹配**：列出待填写项
6. 回复用户摘要："已填充 X 条 / 需确认 X 条 / 未匹配 X 条"

**如果用户提供的是 Excel 数据源**（无飞书多维表链接），则退化到 Agent 手动编排模式：读取 Excel → 查询价格库 → 逐条匹配 → 输出填充建议 CSV/表格给用户。

**只填充：** 项目特征、综合单价、备注、单位
**不动：** 工程分类、项目名称、数量
**不动：** 已填有单价的项目（避免覆盖用户手动填写的数据）

### /报价 入库确认

PDF 生成后，**必须询问用户**是否入库：

1. 回复用户：PDF 已生成
2. 询问："是否将本次报价的 X 条数据入库价格库？"
3. 用户确认后，用已读取的数据批量写入价格库
4. 批量导入格式：
   ```json
   {
     "fields": ["工程分类", "项目名称", "项目特征", "单位", "综合单价", "使用次数", "来源"],
     "rows": [
       [["措施项目"], "脚手架", "室内脚手架", ["项"], 3200, 1, ["报价自动入库"]]
     ]
   }
   ```
   - select 字段值为数组：`["措施项目"]`
   - text 字段值为字符串：`"脚手架"`
5. 用户拒绝则跳过入库

### 历史导入

触发："导入历史报价" + 附带 PDF/Excel 文件

**流程：**

1. 解析文件提取条目
2. 标准化处理（统一单位、分类映射、清理格式）
3. 智能去重（名称相似度 > 80% 视为同一项目）
4. 回显确认："提取 X 条，去重后 Y 条，确认导入？"
5. 用户确认后写入价格库

## 6. 注意事项

- 多维表中的 `合价` 是公式字段（=数量×综合单价），读取时已计算好
- `工程分类` 是单选字段，13 个选项对应 13 类工程
- `单位` 是单选字段，支持自定义扩展
- Logo 支持图片（推荐）和文字两种形式
- 增值税税率每次由用户指定，不固定
- 输出 PDF 为 A4 尺寸，适合打印
