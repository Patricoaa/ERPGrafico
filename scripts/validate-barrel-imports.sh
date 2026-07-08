#!/usr/bin/env bash
# validate-barrel-imports.sh
# Checks that no code imports from a feature sub-path when that feature has a barrel.
# Retorna código de error si hay violaciones.
# Úsalo: bash scripts/validate-barrel-imports.sh

set -o pipefail

cd "$(git rev-parse --show-toplevel)/frontend" || exit 1

VIOLATIONS=0
TARGET_DIRS=(features components/shared hooks app)

for feature_dir in features/*/; do
  feature=$(basename "$feature_dir")
  [ ! -f "features/$feature/index.ts" ] && continue

  count=0
  for dir in "${TARGET_DIRS[@]}"; do
    [ ! -d "$dir" ] && continue
    c=$(grep -rn "from '@/features/$feature/" \
      --include="*.ts*" \
      --exclude-dir=node_modules \
      "$dir" 2>/dev/null | grep -v "^features/$feature/" | wc -l)
    count=$((count + c))
  done

  if [ "$count" -gt 0 ]; then
    echo "❌ $count sub-path imports to $feature/ (barrel exists at features/$feature/index.ts)"
    if [ "${VERBOSE:-0}" = "1" ]; then
      for dir in "${TARGET_DIRS[@]}"; do
        [ ! -d "$dir" ] && continue
        grep -rn "from '@/features/$feature/" \
          --include="*.ts*" \
          --exclude-dir=node_modules \
          "$dir" 2>/dev/null | grep -v "^features/$feature/" | sed 's/^/    /'
      done
    fi
    VIOLATIONS=$((VIOLATIONS + count))
  else
    echo "✅ $feature/ — clean"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total violations: $VIOLATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ FAIL: barrel import violations detected."
  exit 1
fi

echo "✅ PASS: all imports use barrels correctly."
exit 0
