---
status: active
owner: core-team
last_review: 2026-10-08
---

# Graph · GStack — Playbook de uso

> Cómo leer el knowledge graph de `graphify-out/`, mantenerlo actualizado, y qué skill de la suite GStack usar según el objetivo (salud, arquitectura, bugs, diffs, seguridad). Reglas autoritativas en `AGENTS.md`.

## 1. Qué es el grafo

Build inicial: **2026-10-08** — `graphify` 0.9.80 vía `uv tool graphifyy`.

| Asset (`graphify-out/`) | Qué es |
|---|---|
| `graph.html` | Grafo interactivo (vista agregada: **502 comunidades**; >5000 nodos se agregan automáticamente) |
| `GRAPH_REPORT.md` | Informe: god nodes, *surprising connections*, ciclos de import, cohesión, preguntas sugeridas |
| `graph.json` | Grafo crudo: **14.733 nodos, 51.952 aristas** |
| `manifest.json` | Qué fichero fue extraído (habilitar `update` incremental) |
| `cache/` | Cache AST + semántica por hash de contenido (reducción de coste en re-runs) |
| `cost.json` | Acumulador de coste (este build: 0 tokens facturados — la semántica corrió en-sesión) |
| `.graphify_labels.json` | Nombres de comunidad (25 curados + 477 heurísticos) |

**Limitaciones conocidas (honestas):**
- Health-check al build: **3.984 aristas con endpoint colgante**, 2.771 colapsadas (undirected), 21 self-loops → el grafo puede estar incompleto en esos puntos; no bloquea, pero cómprale con `graphify query` cuando afecte a tu zona.
- Las **17 imágenes** no fueron extraídas (modelo sin visión). Quedaron sin marcar en el manifest → una futura pasada semántica las reintenta. No son relevantes para este proyecto.
- Símbolos extraídos por AST / conceptos por LLM: los IDs deben cuadrar; ante desajustes usa `graphify explain`.

## 2. Reglas base (ver `AGENTS.md`)

1. **Graph-first**: antes de grepear el código para una pregunta, ejecuta `graphify query`.
2. `path` para relaciones entre dos símbolos; `explain` para un concepto focal.
3. Solo se omite graphify si el problema es del propio grafo (obsoleto/incorrecto) o el usuario lo pide.
4. `GRAPH_REPORT.md` solo para contexto arquitectónico amplio; prefieres subgrafos acotados.
5. Tras editar código → `graphify update .` para mantenerlo fresco.
6. `graphify-out/` está en `.gitignore`: no se commitea.

## 3. Comandos y cuándo usarlos

| Comando | Uso |
|---|---|
| `graphify query "<pregunta>"` | Responder preguntas del codebase (BFS por defecto; `--dfs` para trazar cadenas; `--budget N` para cap; `--context import/call/...`) |
| `graphify path "<A>" "<B>"` | Camino más corto entre dos nodos (cómo se conectan) |
| `graphify explain "<símbolo>"` | Lectura plana de un nodo y sus vecinos |
| `graphify affected "X"` | Traversal inverso: qué se rompe si cambias X (impact analysis) |
| `graphify god-nodes --top N` | Hubs arquitectónicos (sospechosos de acoplamiento excessivo) |
| `graphify query` (vocab) | Ver §4 — expansión obligatoria de vocabulario |
| `graphify update <path>` | Re-extraer solo ficheros de código cambiados (AST, sin LLM, sin coste) |
| `graphify update --force` | Tras refactors que borran código (si el `--force` no se da, el guard #479 rechaza encoger el grafo) |
| `graphify cluster-only <path>` | Re-cluster + regenerar reporte/graphs sin re-extraer (`--no-viz` para CI, `--no-label` para saltar naming) |
| `graphify label <path>` | Renombrar comunidades vía LLM + regenerar reporte |
| `graphify add <url>` | Incorporar una URL al corpus y actualizar |
| `graphify watch <path>` | Rebuild automático al cambiar ficheros |
| `graphify tree` | Vista D3 de árbol colapsable (`GRAPH_TREE.html`) |
| `graphify save-result` / `reflect` | Guardar feedback Q&A y consolidarlo en `graphify-out/reflections/LESSONS.md` |
| `graphify check-update <path>` | Comprobar si hay re-extracción semántica pendiente (cron-safe) |
| `graphify extract <path> --code-only` | Full extraction solo código (CI/cron, sin API key) |
| `graphify hook install` / `status` / `uninstall` | Hook post-commit que reconstruye el grafo (solo AST) |

## 4. Reglas de consulta (innegociables)

La expansión de vocabulario **antes** de `graphify query` estándar se hace contra el vocabulario real del grafo:

1. Extrae vocabulario con `graphify-out/.vocab.txt` (el agente lo genera).
2. Elige **hasta 12 tokens** que estén **literalmente en esa lista** — nunca inventar sinonimos.
3. Traducción cross-lang (es→en, sing→plural) SÍ, pero solo a tokens presentes.
4. Imprime la selección al usuario para que sea auditable: `Query expanded to (from graph vocab, N tokens): [...]`.
5. Si no hay tokens relevantes → para y dilo; no fabriques búsquedas.

## 5. Routing a skills GStack (qué skill para qué objetivo)

> La tabla maestra vive en `~/.config/opencode/AGENTS.md` (routing global). Ante duda entre varias, invoca `gstack`.

| Objetivo | Skill |
|---|---|
| Score de salud global (lint, types, tests, deuda) | `health` |
| Cuestionar arquitectura / mejoras estructurales | `plan-eng-review` |
| Root-cause de un bug que el grafo revele | `investigate` (nunca fixes sin causa raíz) |
| Revisar un PR/diff antes de mergear | `review` |
| Auditoría de seguridad / threat model | `cso` |
| QA funcional de la app (probar + arreglar) | `qa` / `qa-only` (solo informe) |
| Crítica/mejora de UI viva | `impeccable` |
| Estrategia / alcance ambicioso | `plan-ceo-review` |
| Diagrama del hallazgo (arquitectura, flujos) | `archify` / `diagram` |
| Guardar/retomar contexto de sesión | `context-save` / `context-restore` |

## 6. Flujo combinado recomendado (grafo → skill)

1. **Pregunta de conocimiento** → `graphify query` (con expansión de vocab) → si hay símbolo extraño, `graphify explain` → si quieres el "cómo llego", `graphify path`.
2. **Identificar problemas** → `graphify god-nodes` + secciones *Suggested Questions* de `GRAPH_REPORT.md` → ejecuta `health` para score 0-10 → prioriza deuda en comunidades de menor cohesión.
3. **Cuestionar arquitectura** → del grafo saca comunidades + cohesion + *surprising connections* → valida con `plan-eng-review` (modo SCOPE/HOLD) → decisiones en ADR.
4. **Bug reportado** → `investigate` (root cause con evidencia del grafo: qué aristas conectan al símbolo culpable) → fix + `graphify update .`.
5. **Antes de mergear** → `graphify affected "X"` para saber el blast radius → `review` sobre el diff.
6. **QA funcional** → `qa` (test → fix → verify con screenshots antes/después).
7. **Refactor grande** → `graphify update --force` (tras borrar código) + `cluster-only` para ver cómo se reagrupan las comunidades → `plan-eng-review` del plan de refactor.

## 7. Mantenimiento

- Tras cada iteración de código: `graphify update .` (AST, sin coste). Hook opcional: `graphify hook install`.
- Cambios de docs/imágenes requieren pasada semántica (LLM). `graphify extract <path>` la dispara (`--code-only` la salta).
- El coste acumulado se lee en `graphify-out/cost.json`.
- Nunca commitees `graphify-out/` (ignorado); es regenerable desde el manifest y el source.