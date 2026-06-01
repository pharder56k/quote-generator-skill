# 多模板报价系统设计方案

## 概述

在现有 quote-generator skill 基础上，增加 3 种视觉模板，用户在对话中指定模板名称即可切换。当前风格保留为默认。

## 模板清单

| 模板名 | 配色 | 表格样式 | 适用场景 |
|--------|------|---------|---------|
| **默认** | 黑白灰（当前） | 带边框线 | 不指定时使用 |
| **商务蓝** | 深蓝主色 #1a3a5c + 白底 | 带边框线 | 正式商务客户 |
| **简约灰** | 黑白灰 | 无边框（仅表头线） | 极简风格 |
| **暖色** | 深棕 #5c2a1a + 米白底 #faf8f5 | 斑马纹奇偶行交替 | 高端/私人客户 |

## 使用方式

```
/报价 [多维表链接]                    → 默认风格
/报价 [多维表链接] 用商务蓝模板        → 商务蓝
/报价 [多维表链接] 用简约灰模板        → 简约灰
/报价 [多维表链接] 用暖色模板          → 暖色
```

## 技术实现

### 核心思路：CSS 变量 + 单模板文件

1 个 HTML 模板，通过 CSS 变量控制颜色和表格样式。每种模板 = 一组 CSS 变量值。

### 改动范围

#### 1. 新增模板配置文件

`references/templates/` 目录下新增 JSON 配置：

```
references/templates/
├── default.html          # 唯一的模板文件
├── default.json          # 默认风格 CSS 变量
├── business-blue.json    # 商务蓝 CSS 变量
├── minimal-gray.json     # 简约灰 CSS 变量
└── warm.json             # 暖色 CSS 变量
```

每个 JSON 结构：

```json
{
  "name": "商务蓝",
  "css": {
    "--primary-color": "#1a3a5c",
    "--bg-color": "#ffffff",
    "--header-bg": "#1a3a5c",
    "--header-text": "#ffffff",
    "--cat-row-bg": "#e8eef5",
    "--cat-row-text": "#1a3a5c",
    "--border-color": "#d0d0d0",
    "--row-stripe-bg": "transparent",
    "--table-style": "border"
  }
}
```

#### 2. 修改 default.html

将硬编码颜色替换为 CSS 变量：

```css
:root {
  --primary-color: #1a1a1a;
  --bg-color: #ffffff;
  /* ... */
}
```

模板中引用变量：

```css
.cat-row td { background-color: var(--cat-row-bg); }
.detail-table td { border-bottom: 1px solid var(--border-color); }
```

表格样式通过 CSS 变量控制：
- `border` — 带边框线
- `borderless` — 无边框
- `zebra` — 斑马纹

#### 3. 修改 render.js

- 新增 `--template` 参数解析
- 读取对应 JSON 配置
- 将 CSS 变量注入到 HTML 的 `<style>` 中

#### 4. 修改 SKILL.md

- 触发条件增加模板名称识别
- 新增模板选择说明

## 实现优先级

1. **P0** — 将现有样式提取为 CSS 变量（默认模板）
2. **P1** — 新增商务蓝模板
3. **P1** — 新增简约灰模板
4. **P1** — 新增暖色模板
5. **P2** — SKILL.md 更新
