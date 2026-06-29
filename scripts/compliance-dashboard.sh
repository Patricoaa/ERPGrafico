#!/usr/bin/env bash
# compliance-dashboard.sh
# Mide métricas de cumplimiento arquitectónico y muestra un dashboard.
# Úsalo: bash scripts/compliance-dashboard.sh
# Úsalo en CI: bash scripts/compliance-dashboard.sh --ci

set -o pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$(cd "$(dirname "$0")/.." && pwd)")
FRONTEND="$REPO_ROOT/frontend"
BACKEND="$REPO_ROOT/backend"

CI_MODE=0
[ "$1" = "--ci" ] && CI_MODE=1

# ------ Helper functions ------
count() {
  grep -r "$1" --include="*.ts" --include="*.tsx" "$FRONTEND/features" 2>/dev/null | wc -l
}

count_py() {
  grep -r "$1" --include="*.py" "$BACKEND" 2>/dev/null | grep -v "migrations/" | grep -v ".pyc" | grep -v "__pycache__" | wc -l
}

section() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ====== 1. markLocalMutation coverage ======
section "1. markLocalMutation — cobertura en hooks"

TOTAL_HOOK_FILES=$(find "$FRONTEND/features" -name "*.ts" -path "*/hooks/*" ! -path "*/node_modules/*" ! -name "index.ts" | wc -l)
HOOKS_WITH_MLM=$(grep -rl "markLocalMutation(" "$FRONTEND/features" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -E "/hooks/" | wc -l)
MLM_HOOK_FILES=$(grep -rl "markLocalMutation(" "$FRONTEND/features" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -E "/hooks/" | sort | uniq | wc -l)

if [ "$TOTAL_HOOK_FILES" -gt 0 ]; then
  MLM_PCT=$((MLM_HOOK_FILES * 100 / TOTAL_HOOK_FILES))
else
  MLM_PCT=0
fi

echo "  Total hook files:     $TOTAL_HOOK_FILES"
echo "  With markLocalMutation: $MLM_HOOK_FILES"
echo "  Coverage:             ${MLM_PCT}%"
echo "  (blank: pattern known, metric needs refinement)"

# ====== 2. staleTime coverage ======
section "2. staleTime — cobertura en useQuery"

TOTAL_USEQUERY=$(grep -r "useQuery" "$FRONTEND/features" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
TOTAL_STALETIME=$(grep -r "staleTime" "$FRONTEND/features" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)

echo "  useQuery calls:       $TOTAL_USEQUERY"
echo "  With staleTime:       $TOTAL_STALETIME"

# ====== 3. Inline ORM en views ======
section "3. Inline ORM en views.py"

VIEW_FILES=$(find "$BACKEND" -name "views.py" ! -path "*/migrations/*" ! -path "*/venv/*" ! -path "*/__pycache__/*" 2>/dev/null | wc -l)
VIEWS_WITH_ORM=$(find "$BACKEND" -name "views.py" ! -path "*/migrations/*" ! -path "*/venv/*" ! -path "*/__pycache__/*" -exec grep -l "\.objects\." {} + 2>/dev/null | wc -l)
ORM_CALLS_IN_VIEWS=$(count_py "\.objects\.\(create\|get\|filter\|all\|update\|delete\)")

echo "  View files:           $VIEW_FILES"
echo "  Views with ORM calls: $VIEWS_WITH_ORM"
echo "  Total ORM calls:      $ORM_CALLS_IN_VIEWS (warns: puede incluir selectores válidos)"

# ====== 4. product_type sin strategy ======
section "4. product_type — usos sin strategy"

DIRECT_COMPARISONS=$(count_py "product_type\s*\(==\|!=\|in\|not in\)")
echo "  product_type comparisons: $DIRECT_COMPARISONS"
echo "  (target: 0 — usar ProductTypeStrategy)"

# ====== 5. any types restantes ======
section "5. any types — TypeScript"

if command -v npx &>/dev/null && [ -f "$FRONTEND/package.json" ]; then
  cd "$FRONTEND" || exit 1
  ANY_INTERFACE=$(grep -rn "any" "$FRONTEND/features" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -E ":\s*any\b" | wc -l)
  ANY_AS_CAST=$(grep -rn "as any" "$FRONTEND/features" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
  echo "  ': any' occurrences:   $ANY_INTERFACE"
  echo "  'as any' occurrences:  $ANY_AS_CAST"

  ANY_WARNINGS=$(grep -rn "no-explicit-any" "$FRONTEND/features" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "eslint-disable" | wc -l)
  echo "  ESLint no-explicit-any: $ANY_WARNINGS"
else
  echo "  SKIP — no npx or no package.json"
fi

# ====== 6. Cross-feature internal imports ======
section "6. Cross-feature internal imports (bypass barrel)"

cd "$FRONTEND" || exit 1

CROSS_FEATURE_COUNT=0
for feature_dir in features/*/; do
  feature=$(basename "$feature_dir")
  [ ! -f "features/$feature/index.ts" ] && continue

  for dir in features components/hooks app; do
    [ ! -d "$dir" ] && continue
    c=$(grep -rn "from '@/features/$feature/" \
      --include="*.ts" --include="*.tsx" \
      --exclude-dir=node_modules \
      "$dir" 2>/dev/null | grep -v "^features/$feature/" | wc -l || true)
    CROSS_FEATURE_COUNT=$((CROSS_FEATURE_COUNT + c))
  done
done

echo "  Violations: $CROSS_FEATURE_COUNT"

# ====== Summary ======
section "RESUMEN DE CUMPLIMIENTO"

echo "  Métrica                                | Valor     | Target"
echo "  ───────────────────────────────────────┼───────────┼───────"
echo "  1. markLocalMutation en hooks          | ${MLM_PCT}%        | ~100%"
echo "  2. staleTime en useQuery               | ${TOTAL_STALETIME}/${TOTAL_USEQUERY}    | ≥90%"
echo "  3. Views con inline ORM                | ${VIEWS_WITH_ORM}/${VIEW_FILES}    | ≤2"
echo "  4. product_type comparisons directas   | $DIRECT_COMPARISONS        | 0"
echo "  5. any types (interface)               | $ANY_INTERFACE         | 0"
echo "  6. Cross-feature internal imports      | $CROSS_FEATURE_COUNT         | 0"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Dashboard generado: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# En modo CI, fallar si hay incumplimientos graves
if [ "$CI_MODE" -eq 1 ]; then
  FAIL=0
  [ "$ANY_INTERFACE" -gt 0 ] && echo "❌ FAIL: any types" && FAIL=1
  [ "$CROSS_FEATURE_COUNT" -gt 0 ] && echo "❌ FAIL: cross-feature imports" && FAIL=1
  [ "$DIRECT_COMPARISONS" -gt 0 ] && echo "❌ FAIL: product_type comparisons" && FAIL=1

  if [ "$FAIL" -eq 1 ]; then
    exit 1
  fi
  echo "✅ PASS: all compliance checks"
fi

exit 0
