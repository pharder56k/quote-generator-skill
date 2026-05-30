# quote-generator-skill

全案设计报价系统 Skill — 从飞书多维表读取数据，生成 HTML 报价单，导出 PDF。

## 快速开始

```bash
# 安装依赖
npm install

# 安装 Playwright 浏览器
npx playwright install chromium

# 测试渲染
npm test
```

## 项目结构

```
quote-generator-skill/
├── SKILL.md                 # Skill 入口定义（待创建）
├── references/
│   ├── templates/
│   │   └── default.html     # 默认报价单模板
│   └── helpers.js           # Handlebars 自定义助手
├── scripts/
│   └── render.js            # Playwright 渲染脚本
├── output/                  # PDF 输出目录（git ignored）
├── package.json
└── README.md
```

## 工作流程

1. 用户在飞书多维表填入报价数据
2. Skill 通过 lark-base 读取数据
3. 数据校验 + 填入 HTML 模板
4. Playwright 渲染 HTML → PDF
5. 输出 PDF 文件
