# 室内报价系统 Skill

从飞书多维表或 Excel 文件读取工程量清单数据，一键生成专业 PDF 报价单。支持智能填充和价格库自动积累。

## 功能特性

- **飞书多维表驱动**：复制模板 → 填入数据 → 对 AI 说 `/报价` → 出 PDF
- **双分类方式**：按区域（玄关、客厅、主卧…）或按工程分类（措施、拆除…），每次渲染前询问确认
- **序号自动生成**：飞书无需维护序号列，渲染时按 `分组序号.组内序号` 自动编号，组内顺序 = 飞书记录顺序
- **管理费 + 增值税**：管理费按工程总价计，增值税按（总价 + 管理费）计，费率兼容小数（0.08）与百分数（8）
- **区域名动态翻译**：每个项目的区域不同，Agent 每次渲染前实时翻译区域英文名（中英对照标题）
- **金额整数显示**：所有金额四舍五入为整数，简洁专业
- **4 种模板风格**：Swiss IKB / Swiss IKB Zebra / B&W / B&W Zebra
- **智能价格库**：`/填充` 自动匹配历史价格，越用越聪明
- **专业 PDF 输出**：封面 + 总价表 + 分类明细页，自动分页
- **Logo 支持**：自动从飞书多维表附件读取

## 环境要求

| 组件 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18 | 核心运行时（渲染引擎、价格库填充） |
| lark-cli | 最新（1.0.82+） | 飞书多维表读写、PDF 发送/上传 |
| Playwright Chromium | 随项目安装 | HTML → PDF 渲染 |
| Git | 任意 | 克隆仓库 |

支持 macOS / Linux。Windows 可运行但需自行配置 lark-cli。

## 安装

### 方式一：一键脚本（推荐）

```bash
git clone https://github.com/pharder56k/quote-generator-skill.git
cd quote-generator-skill
bash setup.sh
```

`setup.sh` 自动完成：
- Node.js 版本检查（>= 18）
- `npm install` 依赖安装
- Playwright Chromium 浏览器安装
- lark-cli 安装检测与登录引导
- SKILL.md 路径自动配置（仅 Proma 环境需要）

### 方式二：手动安装

**1. 安装 Node.js (>= 18)**

macOS 推荐用 nvm：
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
node --version   # 确认 >= 18
```

或从官网下载安装包：https://nodejs.org

**2. 克隆并安装依赖**

```bash
git clone https://github.com/pharder56k/quote-generator-skill.git
cd quote-generator-skill
npm install
```

**3. 安装 Playwright Chromium（渲染 PDF 必需）**

```bash
npx playwright install chromium
```

**4. 安装 lark-cli（飞书命令行工具）**

```bash
brew install lark-cli    # macOS（Homebrew）
# 其他平台请参考 lark-cli 官方文档
lark-cli --version       # 确认安装成功
```

## 配置

### 1. 登录飞书

```bash
lark-cli auth login
```

完成后验证登录状态：

```bash
lark-cli base +table-list --base-token <你的多维表token>
```

### 2. 复制飞书模板（只需一次）

- **项目模板**（每次新项目复制一个）：https://li1fn1sw90.feishu.cn/base/LfjJbLrTHacijesHmIjcDtSpnJf?from=from_copylink
  - 含「项目信息」（项目名称、工程编号、税率、管理费等）和「报价明细」两张表
- **价格库模板**（长期使用，跨项目共享）：https://li1fn1sw90.feishu.cn/base/TBklbKKSoa54iHsQxLtcboMVnRb?from=from_copylink

复制后把新表链接发给 Agent 即可自动关联。

### 3. 验证环境（可选）

```bash
npm run demo      # 用内置示例数据渲染全部 4 个模板，验证渲染链路
```

成功后在 `output/` 目录看到 PDF 即环境就绪。

## 常见环境问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `command not found: node` | Node.js 未安装 | 安装 Node.js >= 18，重开终端 |
| `Executable doesn't exist` | Playwright Chromium 未安装 | 在项目目录执行 `npx playwright install chromium` |
| `command not found: lark-cli` | lark-cli 未安装 | `brew install lark-cli`，重开终端 |
| lark-cli 报认证错误 | 未登录或 token 过期 | 执行 `lark-cli auth login` |
| 渲染中文乱码 | 极少数系统字体缺失 | 字体已内嵌为 WOFF2，一般无需处理 |

## 快速开始

**三步上手：**

1. **复制飞书模板** — 打开 [报价模板多维表](https://li1fn1sw90.feishu.cn/base/LfjJbLrTHacijesHmIjcDtSpnJf?from=from_copylink)，点击"复制此多维表"到你的飞书空间
2. **填入数据** — 在「项目信息」表填工程概况（项目名称、工程编号、税率、管理费等），在「报价明细」表填清单条目（区域、工程分类、项目名称、项目特征、单位、数量、综合单价；**无需填序号**）
3. **对 AI 说** — `/报价 <你的多维表链接>`

**离线体验（无需飞书）：**

```bash
npm run demo         # 用内置示例数据渲染全部 4 个模板
node scripts/render.js --input test-data/template-demo.json --group-by area --output output/示例.pdf   # 区域模式渲染
```

## 命令列表

| 命令 | 功能 |
|------|------|
| `/报价 [飞书多维表链接]` | 读取数据 → 确认分类方式/模板/税率管理费 → 渲染 PDF |
| `/填充 [飞书多维表链接]` | 查询价格库 → 自动匹配填充项目特征/单价/备注 |
| `导入历史报价` + 文件 | 批量导入历史数据到价格库 |

## 渲染参数（scripts/render.js）

```bash
node scripts/render.js --input <data.json> --template <模板名> --group-by <area|category> --output <输出路径>
```

- `--group-by area` — 按区域分类（大分类 = 区域，明细含工程分类列）
- `--group-by category`（默认）— 按工程分类
- `--vat-rate <税率>` — 覆盖税率（不传则读数据中的 `税率` 字段，默认 3%）
- 数据中的 `管理费` 字段：按工程总价计管理费；增值税 = (总价 + 管理费) × 税率

渲染数据 JSON 结构（`序号` 字段无需提供）：

```json
{
  "项目名称": "xxx", "工程编号": "xxx", "编制日期": "xxx", "编制人员": "xxx",
  "联系邮箱": "xxx", "logo_url": "data:image/png;base64,...",
  "税率": 0.08, "管理费": 0.1,
  "region_names": { "玄关": "Foyer", "阳光房": "Sunroom" },
  "items": [
    { "区域": "玄关", "工程分类": "泥瓦工程", "项目名称": "地面贴砖",
      "项目特征": "1500×750通体砖；薄贴法", "单位": "㎡", "数量": 5.6, "综合单价": 165 }
  ]
}
```

## 使用示例

```
用户：/报价 https://xxx.feishu.cn/base/ABC123

AI：读取多维表数据... 共 59 条
    请选择分类方式：
    1. 按区域（玄关、客厅、主卧…）
    2. 按工程分类（措施、拆除…）

用户：1

AI：使用模板：Swiss IKB
    税率：8%  管理费：10%
    渲染 PDF...
    PDF 已生成：工程量报价模版项目_RMD20260531.pdf

    是否将本次 59 条数据入库价格库？
```

## 模板风格

### 封面预览

| Swiss IKB（默认） | Swiss IKB Zebra | B&W | B&W Zebra |
|:---:|:---:|:---:|:---:|
| <img src="docs/previews/swiss-ikb-cover-01.png" width="180"> | <img src="docs/previews/swiss-ikb-zebra-cover-01.png" width="180"> | <img src="docs/previews/bw-cover-01.png" width="180"> | <img src="docs/previews/bw-zebra-cover-01.png" width="180"> |
| `swiss-ikb` | `swiss-ikb-zebra` | `bw` | `bw-zebra` |
| 蓝底满版 · 双语分类 | 同上 + 斑马纹 | 白底 · 黑白打印优化 | 同上 + 斑马纹 |

### 内容页预览

| Swiss IKB（默认） | Swiss IKB Zebra | B&W | B&W Zebra |
|:---:|:---:|:---:|:---:|
| <img src="docs/previews/swiss-ikb-content-03.png" width="180"> | <img src="docs/previews/swiss-ikb-zebra-content-03.png" width="180"> | <img src="docs/previews/bw-content-03.png" width="180"> | <img src="docs/previews/bw-zebra-content-03.png" width="180"> |
| 纯色明细行 | 白/浅蓝交替明细行 | 纯色明细行 | 白/浅灰交替明细行 |

**区域分类模式内容页**（`--group-by area`）：

| Swiss IKB（默认模板） |
|:---:|
| <img src="docs/previews/swiss-ikb-content-area-03.png" width="360"> |
| 大分类 = 区域（中英对照标题）· 明细 7 列（序号/工程分类/名称/单位/数量/综合单价/合价）· 序号自动生成 · 金额整数显示 |

## 项目结构

```
quote-generator-skill/
├── setup.sh                     # 一键安装脚本
├── SKILL.md                     # Skill 定义（Agent 工作流）
├── package.json
├── scripts/
│   ├── render.js                # HTML → PDF 渲染引擎
│   ├── fill.js                  # 价格库智能填充
│   ├── demo.js                  # 开箱即用演示
│   └── generate-large-test.js   # 大型测试数据生成器
├── references/
│   ├── templates/
│   │   ├── content.html         # 内容页模板（总价表 + 明细）
│   │   ├── cover-screen.html    # Swiss IKB 封面模板
│   │   ├── cover-bw.html        # B&W 封面模板
│   │   ├── swiss-ikb.json       # Swiss IKB 配置
│   │   ├── swiss-ikb-zebra.json # Swiss IKB Zebra 配置
│   │   ├── bw.json              # B&W 配置
│   │   └── bw-zebra.json        # B&W Zebra 配置
│   ├── helpers.js               # Handlebars 辅助函数
│   ├── price-library.js         # 匹配引擎 + lark-cli 封装
│   └── bitable-config.json      # 多维表模板配置
├── test-data/                   # 测试数据
├── docs/
│   ├── previews/                # 模板预览图
│   └── plans/                   # 设计文档
├── output/                      # PDF 输出目录
└── README.md
```

## 工程分类

模板「报价明细」表的 `工程分类` 为单选字段（可在多维表中扩展），当前 13 类：

措施项目、拆除工程、泥瓦工程、混凝土及钢筋混凝土工程、金属结构工程、防水工程、保温隔热工程、楼地面装饰工程、墙柱面装饰与隔断工程、木作工程、腻子工程、其他装饰工程、水电安装工程

> 工程分类模式的序号前缀按此标准顺序生成（措施 = 1.x、拆除 = 2.x … 水电安装 = 13.x）；不在列表中的自定义分类自动排在后面。

## 区域分类说明

- 明细表的 `区域` 字段建议设为单选（玄关、客厅、餐厅、厨房、主卧、次卧、卫生间、阳台等），可按项目自定义
- 区域模式：大分类 = 区域，明细表在序号后显示工程分类列（7 列）；分组标题显示中英对照（如 `02 FOYER 玄关`）
- 区域英文名由 Agent 每次渲染前动态翻译（写入 `region_names`），无需写死
- 组内顺序 = 飞书记录顺序（多维表里拖拽记录即可调整）

## License

MIT
