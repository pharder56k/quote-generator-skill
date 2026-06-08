# 新增 Editorial + Card 风格模板设计

## 目标

新增 2 种布局风格，每种有屏幕版和黑白打印版，共 4 个新模板。不修改任何现有文件。

## 风格清单

| 风格名 | 命令参数 | 布局特点 | 配色 |
|--------|---------|---------|------|
| Editorial | `editorial` | 左侧窄栏放分类标签，右侧放数据，不对称排版 | 屏幕版：深色侧栏 |
| Editorial B&W | `editorial-bw` | 同上 | 黑白打印：白底黑字 |
| Card | `card` | 每个分类是独立卡片（浅阴影+边框） | 屏幕版：浅灰卡片底色 |
| Card B&W | `card-bw` | 同上 | 黑白打印：纯黑白 |

## 新增文件（不修改现有文件）

```
references/templates/
├── content-editorial.html   # 编辑式内容页
├── content-card.html        # 卡片式内容页
├── cover-editorial.html     # 编辑式封面（屏幕版）
├── cover-card.html          # 卡片式封面（屏幕版）
├── editorial.json           # 编辑式配置（屏幕版）
├── editorial-bw.json        # 编辑式配置（B&W版）
├── card.json                # 卡片式配置（屏幕版）
└── card-bw.json             # 卡片式配置（B&W版）
```

B&W 版的 content-template 共享同一个 HTML（不同 JSON 配置注入不同 CSS 变量）。

## 布局设计

### Editorial（编辑式）

**封面：**
- 左侧 30% 宽度色块，深色背景
- 右侧 70% 宽度白底，放置项目信息
- 不对称构图，信息层级清晰

**内容页：**
- 左侧 30% 栏：分类编号 + 中英文名称（竖排/横排）
- 右侧 70% 栏：明细数据表（序号/项目名称/单位/数量/单价/合价）
- 总价表放在右侧栏，紧凑排版
- 每个分类占据一个完整区域，分页由 CSS 控制

### Card（卡片式）

**封面：**
- 居中排版，大号标题，下方信息网格
- 轻微背景纹理或纯色

**内容页：**
- 每个分类是一个独立卡片（border: 1px solid var(--border) + border-radius: 4px）
- 卡片内包含：分类标题行 + 数据表格 + 小计行
- 卡片之间有 16px 间距
- 分页时卡片不拆开，整张卡片移到下一页

## 渲染管线适配

**render.js 改动：**

- JSON 配置中新增 `contentTemplate` 字段支持（已实现，当前未使用）
- editorial.json 和 card.json 通过 `contentTemplate: "content-editorial.html"` / `content-card.html` 选择独立内容模板

**无需改动：**
- content.html（Swiss IKB/B&W 内容页）
- cover-screen.html / cover-bw.html
- 默认 contentTemplate = "content.html"

## 配色方案

### Editorial（屏幕版）
- 侧栏：深色 #1a1a1a 或主色
- 内容区：白色背景
- 分类标题：侧栏内反白
- 数据行：JetBrains Mono 等宽

### Editorial B&W
- 侧栏：白色（仅边框）
- 所有文字：黑/深灰
- 分类标题：黑底白字或白底黑字

### Card（屏幕版）
- 卡片背景：#f8f8f8
- 卡片边框：1px solid #e0e0e0
- 分类标题：卡片顶部色带
- 数据行：白底

### Card B&W
- 卡片背景：#f0f0f0
- 无彩色，纯黑白灰

## 实现顺序

1. content-editorial.html + editorial.json
2. cover-editorial.html + editorial-bw.json
3. content-card.html + card.json
4. cover-card.html + card-bw.json
5. 测试 8 个模板渲染
6. 更新 SKILL.md / README
