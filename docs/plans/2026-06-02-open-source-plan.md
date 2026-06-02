# 开源就绪计划

## 目标

将 `quote-generator-skill` 开源为 Proma Skill，让其他用户通过 `npx skills add` 安装后，用斜杠命令（`/报价`、`/填充`）或自然语言触发，AI Agent 自动完成全套报价流程。

## 当前状态

- 4 个模板风格（Swiss IKB / Swiss IKB Zebra / B&W / B&W Zebra）
- 内容页模板已重构为独立的 `content.html`
- 覆盖模板 + 封面模板分离渲染架构
- 价格库智能填充（`fill.js` + `price-library.js`）
- 飞书模板多维表已就绪：`ZARYb5n6gawooesP8qZclTxGnuy`
- 大数据量测试通过（245 条 / 13 分类）

## P0 — 必须做

### P0.1 路径去硬编码

**影响文件：**
- `scripts/render.js` — `TEMPLATES_DIR` 已用 `__dirname`，但需确认所有路径引用是相对的
- `SKILL.md` — 多处 `/Volumes/NVME_2TB/quote-generator-skill` 绝对路径

**改动：**
- `SKILL.md` 中所有项目路径改为使用 `metadata.requires.projectPath` 变量（Proma 自动注入）
- `render.js` 中 `__dirname` 路径经 ESM `import.meta.url` 推导，确认兼容 Windows

### P0.3 SKILL.md 完善

**影响文件：** `SKILL.md`

**新增内容：**

1. **首次使用引导流程**（新增 Step 0）
   - 检查 `node --version`（需 >= 18）
   - 检查 `npx playwright install chromium` 是否已安装
   - 检查 `lark-cli` 是否已安装且已登录
   - 引导用户复制飞书模板多维表
   - 引导用户填入数据

2. **Excel 转多维表引导**
   - 用户提供 Excel 时，引导其导入飞书多维表
   - 流程：Excel → 飞书多维表 → 一键复制模板 → 粘贴数据 → 给链接

3. **错误处理增强**
   - lark-cli 未安装/未登录时的中文提示
   - Playwright 浏览器未安装时的安装指引
   - 数据格式不符时的具体修复建议

### P0.4 README 重写

**影响文件：** `README.md`

**结构：**

```
# 室内报价系统 Skill

## 安装
- 前提依赖（Node 18+, Playwright, lark-cli）
- 安装命令

## 快速开始
- 三步上手：安装 → 复制模板填数据 → /报价

## 模板风格（封面预览 + 内容页预览）

## 命令参考
- /报价 — 生成 PDF
- /填充 — 自动填充价格

## 飞书模板
- 模板链接 + 使用说明

## 项目结构

## 技术栈
```

## P1 — 应该做

### P1.1 示例数据开箱即用

- `npm run demo` 用内置数据渲染 4 个模板
- 数据来源：`test-data/large-test.json`
- 不依赖飞书，安装后立即可见效果

### P1.2 错误提示中文化

- `render.js`、`fill.js`、`price-library.js` 中所有 `console.error` 用中文
- 飞书 API 错误的常见原因翻译

## P2 — 锦上添花

### P2.1 发布到 skills registry

- 通过 `npx skills add` 安装

### P2.2 CI 自动渲染测试

- GitHub Actions 自动 `npm test`

## 实现顺序

```
P0.1 → P0.3 → P0.4 → P1.1 → P1.2 → P2.1 → P2.2
```

## 不做的事情

- 不推出独立 CLI（保持 Skill 形态）
- 不维护 Excel 模板（引导用户转到飞书多维表）
- 不换 `content.html` 架构（已验证稳定）
