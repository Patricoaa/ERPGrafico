#!/usr/bin/env bash
# Migration progress of the entity-view system (ADR-0087, Phase 7 replan).
# docs/50-audit/Tablascards/07-migration-matrix.md §6.1 — report the output when closing each sub-batch.
# Usage (from frontend/): bash scripts/entity-view-progress.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=(features app components)
EXCLUDE='__tests__|\.stories\.tsx$|\.test\.tsx?$|^components/(shared|entity-view|ui)/'

files() { grep -rlE "$1" --include=*.ts --include=*.tsx "${SRC[@]}" | grep -vE "$EXCLUDE" || true; }
count() { files "$1" | wc -l | tr -d ' '; }

consumers=$(count 'toColumns\(|AutoEntityCard|<DataTable\b|DataTableView|createEntityFields')
screens=$(files 'toColumns\(|AutoEntityCard|<DataTable\b|DataTableView|createEntityFields' | grep -vcE 'Fields\.tsx?$' || true)
fields=$(find features components app -name '*Fields.ts*' -not -path '*/__tests__/*' | wc -l | tr -d ' ')
computed=$(grep -rnE "type: ['\"]computed" --include=*.ts --include=*.tsx features app | wc -l | tr -d ' ')
entities=$(files 'defineEntity<' | grep -cE '\.entity\.tsx?$' || true)
allowlist=$(grep -c '^    "' lib/__tests__/entity-view.legacy-consumers.ts || true)

echo "Entidades con defineEntity ........ $entities"
echo "Pantallas en el sistema antiguo ... $screens"
echo "Archivos *Fields ................... $fields"
echo "Campos computed .................... $computed"
echo "toColumns() ....................... $(count '\.toColumns\(')"
echo "AutoEntityCard .................... $(count 'AutoEntityCard')"
echo "renderCard ........................ $(count 'renderCard')"
echo "Consumidores antiguos (total) ..... $consumers  (ratchet LEGACY_CONSUMERS: $allowlist)"
