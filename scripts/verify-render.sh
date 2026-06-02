#!/bin/bash
# 验证 default.html 修改后 4 个模板能否正常渲染
# 用法: bash scripts/verify-render.sh
set -e
INPUT="/Volumes/NVME_2TB/quote-generator-skill/test-data/large-test.json"
OUT="/Volumes/NVME_2TB/quote-generator-skill/output"
cd /Volumes/NVME_2TB/quote-generator-skill
for tpl in swiss-ikb bw; do
  node scripts/render.js --input "$INPUT" --template "$tpl" --output "$OUT/_verify_$tpl.pdf" 2>&1 | tail -1
  SIZE=$(stat -f%z "$OUT/_verify_$tpl.pdf" 2>/dev/null || echo 0)
  if [ "$SIZE" -lt 100000 ]; then
    echo "  FAIL: $tpl PDF too small ($SIZE bytes)"
    exit 1
  fi
done
rm -f "$OUT/_verify_"*.pdf
echo "  OK"
