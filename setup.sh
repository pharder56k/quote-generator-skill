#!/bin/bash
# quote-generator-skill 一键安装脚本
# 用法: bash setup.sh

set -e

SKILL_NAME="quote-generator"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="${HOME}/.proma/agent-workspaces/default/skills/${SKILL_NAME}"

echo "==> 室内报价系统 Skill 安装"
echo "    项目目录: ${PROJECT_DIR}"
echo "    Skill 目录: ${SKILL_DIR}"

# 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "请先安装 Node.js (>= 18): https://nodejs.org"
  exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "需要 Node.js >= 18，当前: $(node -v)"
  exit 1
fi
echo "    Node.js: $(node -v) ✓"

# 安装 npm 依赖
echo "==> 安装项目依赖..."
cd "${PROJECT_DIR}"
npm install

# 安装 Playwright Chromium
echo "==> 安装 Playwright Chromium..."
npx playwright install chromium 2>/dev/null || echo "    (如已安装可忽略)"

# 检查 lark-cli
if ! command -v lark-cli &>/dev/null; then
  echo ""
  echo "==> 需要安装 lark-cli（飞书命令行工具）"
  echo "    macOS:  brew install lark-cli"
  echo "    Linux:  参考 https://github.com/xxx/lark-cli"
  echo "    安装后运行: lark-cli auth login"
  echo ""
  echo "    lark-cli 安装完成后，重新运行本脚本: bash setup.sh"
  exit 1
fi
echo "    lark-cli: $(lark-cli --version 2>/dev/null || echo '已安装') ✓"

# 创建 Skill 链接
mkdir -p "${SKILL_DIR}"
SKILL_MD="${SKILL_DIR}/SKILL.md"
if [ -L "${SKILL_MD}" ] || [ -f "${SKILL_MD}" ]; then
  echo "    Skill 文件已存在，跳过链接创建"
else
  ln -s "${PROJECT_DIR}/SKILL.md" "${SKILL_MD}"
  echo "    Skill 链接已创建 ✓"
fi

# 更新 SKILL.md 中的 projectPath
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|projectPath:.*|projectPath: \"${PROJECT_DIR}\"|" "${PROJECT_DIR}/SKILL.md"
else
  sed -i "s|projectPath:.*|projectPath: \"${PROJECT_DIR}\"|" "${PROJECT_DIR}/SKILL.md"
fi

echo ""
echo "==> 安装完成！"
echo ""
echo "    接下来:"
echo "    1. 确保 lark-cli 已登录: lark-cli auth login"
echo "    2. 复制飞书报价模板到你的空间:"
echo "       https://li1fn1sw90.feishu.cn/base/ZARYb5n6gawooesP8qZclTxGnuy?from=from_copylink"
echo "    3. 在模板中填入项目数据和报价明细"
echo "    4. 对 AI 说: /报价 <你的多维表链接>"
echo ""
echo "    快速体验（无需飞书）: npm run demo"
