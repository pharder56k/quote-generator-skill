# 室内报价系统 Skill

飞书填完工程量清单，对 AI 说 `/报价`，出一套可以交给业主的 PDF：封面、总价表、明细。

MIT 开源。一个室内设计师为自己做的报价 skill。清单还在飞书里改，版式不用再进 Word。

<p align="center">
  <img src="docs/showcase/hero.png" alt="一份报价单的三页：封面、按区域总价表、按区域明细">
</p>

上面是同一份示例数据渲出来的三页，不是效果图。往下每张图都按页面原宽裁过，方便看清字。

---

## 它解决什么

室内项目的报价，数据在表里，拿出去的却是一份文件。Excel 能算，不好看；Word 好看，一改数字就乱。这个 skill 把两件事拆开：

- 飞书多维表管数据：项目信息、报价明细
- 渲染管版式：封面、汇总、明细、序号、税费

每次出单只问两件事，不记住上次：

1. 按区域，还是按工程分类
2. 用哪套模板

其余自动处理：序号、合价、管理费、增值税、中英对照。飞书里不用维护序号列。

需要 Node.js 18+，目前主要支持 macOS / Linux。

---

## 封面

项目名称、工程编号、编制日期、编制人员、联系邮箱，从「项目信息」来。Logo 用你自己的；没有就显示默认字标。

默认是蓝底满版（Swiss IKB）。要黑白打印，换 B&W。结构一样，只是白底。

<p align="center">
  <img src="docs/showcase/covers.png" alt="Swiss IKB 蓝底封面和 B&W 白底封面">
</p>

---

## 总价表

目录页的名称都是中文后面接英文。底下是合计、管理费、增值税、总计。管理费为 0 时不显示这一行。

```
管理费 = 合计 × 管理费率
增值税 = (合计 + 管理费) × 税率
总计   = 合计 + 管理费 + 增值税
```

金额渲染为整数。

### 按区域

业主按房间看钱花在哪。区域英文每次由 Agent 翻译，写入 `region_names`，不套用上一份项目的译名。

<img src="docs/showcase/summary-area.png" alt="按区域汇总的总价表：全屋、玄关、客厅等，中文后接英文，含管理费和增值税">

### 按工程分类

施工和结算按工种看。只给本次出现的分类编号，缺了的不占号。自定义分类的英文当次翻译，写入 `category_names`，不留空副标。

<img src="docs/showcase/summary-category.png" alt="按工程分类汇总的总价表：措施项目、拆除工程、泥瓦工程等">

---

## 明细

分组标题是大号序号、英文、中文。名称下面是项目特征，备注用蓝色。组末有小计。

序号渲染时生成，格式是 `1.1`、`1.2`。行顺序等于飞书视图里的拖拽顺序。读表必须带视图 ID，否则顺序和界面不一致。

### 按工程分类

六列：序号、项目名称及项目特征、单位、数量、综合单价、合价。

<img src="docs/showcase/detail-category.png" alt="工程分类明细：01 措施项目，含项目特征、蓝色备注和组末小计">

### 按区域

七列。序号后面多一列工程分类，同一房间里的拆除、水电、措施可以放在一起。

<img src="docs/showcase/detail-area.png" alt="区域明细：01 全屋，序号后有工程分类列">

---

## 模板

已上线 4 套。出单前会问，不默认沿用上次。

| 模板 | 什么时候用 |
| --- | --- |
| Swiss IKB | 默认。蓝底封面，屏幕上看 |
| Swiss IKB Zebra | 同上，明细行加浅蓝斑马纹 |
| B&W | 白底，适合黑白打印 |
| B&W Zebra | 白底，再加浅灰斑马纹 |

斑马纹不改封面，只改明细行的底色。

<img src="docs/showcase/zebra.png" alt="同一段明细的无斑马纹和 Swiss IKB Zebra 对比">

---

## 快速开始

### 1. 安装

```bash
git clone https://github.com/pharder56k/quote-generator-skill.git
cd quote-generator-skill
bash setup.sh
```

脚本会装依赖、Playwright，并检查 `lark-cli`。装完可先离线看效果：

```bash
npm run demo
```

PDF 会出现在 `output/`。

### 2. 复制飞书模板

每个新项目复制一份：[打开项目模板](https://li1fn1sw90.feishu.cn/base/LfjJbLrTHacijesHmIjcDtSpnJf?from=from_copylink)

模板里有两张表：

- **项目信息**：名称、工程编号、税率、管理费、Logo
- **报价明细**：区域、工程分类、名称、特征、单位、数量、综合单价（不用填序号）

复制后把新表链接发给 Agent。飞书需先登录：

```bash
lark-cli auth login
```

有 Excel 时，先导入飞书再出单。字段和行顺序比直接解析 Excel 稳。

### 3. 出报价单

```
/报价 https://xxx.feishu.cn/base/你的多维表
```

Agent 会读表、让你选分类方式和模板，然后出 PDF。

```
你：/报价 https://xxx.feishu.cn/base/ABC123

AI：读到 31 条。按区域分，还是按工程分类？
你：按区域
AI：Swiss IKB · 税率 8% · 管理费 10%
    PDF 已生成。
```

---

## 反馈

用过请直接开 [Issue](https://github.com/pharder56k/quote-generator-skill/issues) 或 [Discussion](https://github.com/pharder56k/quote-generator-skill/discussions)。尤其想听：

1. 你出报价更习惯按房间，还是按工程分类？
2. 管理费 / 增值税这么算对不对？
3. 哪一页看起来不专业？
4. 安装卡在哪一步？

截图、真实项目结构、改不动的报错，都比「挺好看」有用。

---

<details>
<summary>安装排障</summary>

| 问题 | 处理 |
|---|---|
| `command not found: node` | 安装 [Node.js](https://nodejs.org) >= 18，重开终端 |
| `Executable doesn't exist` | 在项目目录执行 `npx playwright install chromium` |
| `command not found: lark-cli` | macOS：`brew install lark-cli`，再重开终端 |
| lark-cli 认证错误 | `lark-cli auth login` |
| 中文乱码 | 字体已内嵌 WOFF2，一般不用管 |

手动安装（不用 `setup.sh` 时）：

```bash
npm install
npx playwright install chromium
brew install lark-cli   # macOS
lark-cli auth login
```

</details>

<details>
<summary>CLI、税费、分类规则</summary>

离线渲染，不走飞书：

```bash
node scripts/render.js \
  --input test-data/readme-showcase.json \
  --template swiss-ikb \
  --group-by area \
  --output output/示例.pdf
```

- `--group-by area` 按区域；`category` 按工程分类（默认）
- `--template`：`swiss-ikb` / `swiss-ikb-zebra` / `bw` / `bw-zebra`
- 两种分类的目录页都是中文后面接英文，和明细分组标题用同一套翻译
- 区域英文写入 `region_names`；自定义工程分类英文写入 `category_names`
- `--vat-rate` 可覆盖数据里的税率；不传则读 `税率`，默认 3%
- `管理费` 按工程总价计；增值税 = (总价 + 管理费) × 税率
- 费率兼容 `0.08` 和 `8`
- 金额渲染为整数；组内顺序 = 飞书记录顺序（拖拽即可改）

工程分类按这 13 类排序：措施项目、拆除工程、泥瓦工程、混凝土及钢筋混凝土工程、金属结构工程、防水工程、保温隔热工程、楼地面装饰工程、墙柱面装饰与隔断工程、木作工程、腻子工程、其他装饰工程、水电安装工程。没出现的分类不占号，自定义分类排在后面。

本页展示图用 `test-data/readme-showcase.json` 渲染后裁切，源文件在 `docs/showcase/`。

JSON 结构和 Agent 工作流见 [`SKILL.md`](SKILL.md)。

</details>

---

## License

[MIT](LICENSE)。可以自由使用、修改、分发，包括商用；保留版权和许可声明即可。
