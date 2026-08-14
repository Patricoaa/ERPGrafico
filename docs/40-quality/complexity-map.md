---
layer: 40-quality
doc: complexity-map
status: active
owner: platform-team
last_review: 2026-08-13
---

# Mapa de complejidad (Big O)

Auditoría estática exhaustiva de complejidad asintótica por entry point, generada desde la rama `feat--big-o-complexity-audit`. Metodología y convenciones en §1.

**Last verified commit**: `3fb69cfcc` (0.3.1)

**Convenciones**:
- **Dos planos por entry point**: `round-trips` (queries como función de n) y `row-scan` (filas escaneadas por query, peor caso + Σ).
- **Bounded-ness** (espina del mapa): `bounded-por-página` (O(1) efectivo, cap 200) | `bounded-por-dataset-sin-cap` (`COUNT(*)`/`ORDER BY`/filtros sobre dataset completo, Θ(total rows)) | `unbounded real` (sin paginar / recorre todo el dataset). Etiqueta compuesta `page+dataset` para endpoints duales (columna = categoría dominante).
- **Límite duro**: restricción **antes** del trabajo (SQL LIMIT/paginación). Un slice Python posterior al trabajo no cuenta (`contacts/selectors.py:205`).
- **Límite de n**: bucles anidados sobre subconjuntos por nodo son **lineales en la suma** (ej: aging = Θ(C+O), no multiplicativo). Solo es multiplicativo el producto de conjuntos independientes.
- **Umbral de veredicto**: **p95 < 300ms** (decisión del usuario 2026-08-13; tensión con los 400ms de `performance.md` y el baseline search `superseded_by: ADR-0018` documentada en §4).
- **Cap de paginación**: `page_size=50` / `max_page_size=200` (`backend/core/api/pagination.py:19-22`). **Todos los flags bounded asumen cap=200** (nota de sensibilidad; subir el cap = ADR, invariant 12).
- **Premisa 2**: requests interactivas O(1)/O(log n)/O(n paginado) en queries; Θ(n) o peor **solo** en batch (Celery) o con límite duro. Por decisión del usuario, aging y árbol de cuentas se mantienen **por request síncrona** → no exonerados, riesgo alto.

## §0. Censo de superficie (gate de completitud)

Fuente: `wc -l` + conteo de entry points (def/class) por archivo, `grep @action`, rama `master` @ `3fb69cfcc`.

| App | selectors | services | views (ViewSet) | @action | APIView/Generic | tasks | signals | líneas |
|-----|-----------|----------|-----------------|---------|-----------------|-------|---------|--------|
| core | 1 (3) | — | 1 | 2 | 0 | 6 | 1 (63) | 572 |
| accounting | 1 (4) | 1 (30) | 1 (19) | 19 | 1 | 0 | 1 (14) | 2,559 |
| billing | 1 (11) | 1 (17) | 1 (9) | 9 | 0 | 0 | 0 | 2,120 |
| contacts | 1 (18) | 1 (14) | 1 (24) | 24 | 1 | 1 (1) | 1 (21) | 1,472 |
| finances | 0 | 1 (18) | 1 (2) | 2 | 1 | 1 (2) | 0 | 1,084 |
| hr | 0 | 1 (29) | 1 (8) | 8 | 1 | 1 (1) | 0 | 1,481 |
| inventory | 1 (15) | 1 (47) | 1 (20) | 20 | 1 | 1 (1) | 1 (181) | 3,596 |
| production | 1 (4) | 1 (44) | 1 (15) | 15 | 0 | 1 (1) | 1 (23) | 2,877 |
| purchasing | 1 (7) | 1 (32) | 1 (11) | 11 | 1 | 1 (1) | 0 | 2,408 |
| sales | 1 (11) | 1 (28) | 1 (16) | 16 | 0 | 1 (1) | 1 (52) | 2,288 |
| tax | 1 (3) | 1 (26) | 1 (12) | 12 | 0 | 0 | 1 (83) | 1,522 |
| treasury | 1 (26) | 1 (27) | 1 (70) | 70 | 2 | 1 (8) | 1 (232) | 5,291 |
| workflow | 1 (5) | 1 (22) | 1 (5) | 5 | 0 | 1 (2) | 1 (34) | 1,087 |
| **Total** | **11 (107)** | **12 (334)** | **13 (72)** | **211** | **8** | **11 (24)** | **9 (703)** | **28,357** |

**Frontend**: 315 archivos en `features/*` + `components/shared` con patrones de iteración (`.find(/.filter(/.map(/.sort(`). Regla de inclusión: iteran datos de API o arrays >10 elementos. Descubrimiento: `grep -rlE "\.find\(|\.filter\(|\.map\(|\.sort\(" features components/shared`.

**Gate de completitud**: toda fila del censo tiene clasificación en §2; ninguna queda "sin revisar". Nota de censo: `core/services/selectors.py` (3 entry points) se audita aparte del conteo de selectors de app.

## §1. Metodología y glosario

Convenciones arriba; el diseño de la auditoría se aprobó previamente y no se conserva en el repo (esta sección es la referencia durable). Trabajo resuelto: el aging de `contacts/selectors.py:146-205` es **Θ(C+O) round-trips / Θ(C+O+P) row-scan** (N+1 en dos niveles, **lineal en la suma**, no Θ(C×O×P)); `results[:limit]` es un slice posterior al trabajo (no límite duro). Para walks de árbol donde cada nodo consulta su subárbol: Σ(tamaños de subárbol) = O(n×depth), peor O(n²) en cadena (`finances`) — resuelto en P1-6 con pase único en memoria (chart 1 query + balances preagregados + agregador memoizado).

## §2. Mapa por entry point

Formato de fila: `clave (archivo:línea) | n | bounded-ness | round-trips | row-scan | clase | riesgo | remediación`.

### 2.1 Unbounded real — riesgo alto (interactivo)

| Entry point | n | bounded-ness | round-trips | row-scan | clase | remediación |
|---|---|---|---|---|---|---|
| `contacts/selectors.py:117` `customer_aging_report` | C+O+P (toda la cartera) | unbounded | Θ(C+O) | Θ(C+O+P) | Θ(n) | ✅ P1-5: prefetch de órdenes+items+payments + bucketización por bucket en Python; `LIMIT 20` tras bucketizar (SaleOrder.effective_total es property Python → slice posterior al trabajo, no límite duro) |
| `contacts/selectors.py:208` `supplier_aging_report` | C+O+P | unbounded | Θ(C+O) | Θ(C+O+P) | Θ(n) | ✅ P1-5: idem customer_aging (prefetch + buckets compartidos) |
| `contacts/selectors.py:318` `get_credit_portfolio_data` | C+ΣO+ΣP | unbounded (cache 120s solo aplaza) | Θ(C+ΣO+ΣP) ×2-3 | Θ(C+O+P) | Θ(n) | ✅ P1-5: annotations Subquery Sum + prefetch + paginación estándar; `credit_balance_used` cuantizado salvo blacklist (compat) |
| `contacts/selectors.py:423` `get_credit_ledger` | O (órdenes del contacto, sin tope) | unbounded | Θ(O) | Θ(O+P) | Θ(n) | annotate paid/pending + Prefetch('payments') + paginar |
| `contacts/selectors.py:512` `get_credit_history` | H×L×B | unbounded | Θ(H×k) | Θ(H×L×B) | Θ(n) | paginar + queryset base con prefetches + serializer ligero |
| `contacts/selectors.py:573` `get_partner_statement` | T | unbounded | Θ(T×2)+~10 | Θ(T) | Θ(n) | select_related('journal_entry','created_by') + annotate summary |
| `contacts/views.py:71,77,149,155,164` `customers/suppliers/partners/partner_statement/partners_summary` | C/S/P | unbounded | Θ(n × 2-20 aggregates) | Θ(n) | Θ(n) | paginar + serializers ligeros con annotations |
| `finances/services.py:72` `_get_aggregated_balance` | nodos×depth | unbounded | Θ(nodos) | O(n×depth) peor O(n²) | Θ(n×depth) | ✅ P1-6: pase único en memoria (`_leaf_balance_map` + `_make_aggregator` memoizado, 0 queries) |
| `finances/services.py:103` `build_account_tree` | nodos×depth, k roots | unbounded | Θ(n×depth) | O(n×depth) | Θ(n×depth) | ✅ P1-6: chart en 1 query + balances preagregados + agregador memoizado; categorías resueltas en memoria (vivo con herencia, fiscal sin herencia) |
| `finances/services.py:211,299,415,675,791` `get_balance_sheet/income_statement/cash_flow/financial_analysis/trial_balance` | árbol×I+E/J | unbounded | 3-6×build_account_tree + Θ(A) | Θ(J) | Θ(n×depth) | ✅ P1-6: reportes comparten chart/balances preagregados (7/9/20/3/18 queries vs 475/416/595/27/893); trial balance con 2 GROUP BY agrupados |
| `finances/bi_analytics.py:13` `get_bi_analytics` | P productos | unbounded | Θ(P) | Θ(StockMove por producto) | Θ(P) | 1 GROUP BY product_id en StockMove |
| `finances/tasks.py:24` `generate_report_task` | árbol/A/P | unbounded (sin cap, sin chunking) | Θ(n×depth) | Θ(J) | Θ(n×depth) | chunking por período o preagregación |
| `tax/selectors.py:18` + `tax/views.py:142` `get_declaration_documents`/`documents` | I_month (4-8k invoices) | unbounded | 1 + Θ(I) (InvoiceSerializer con ~10 SMF con ORM) | Θ(I) + N+1 profundo | Θ(n) const. altísima | ✅ P1-4: paginación estándar + queryset con `select_related`/`prefetch` (fix `closed_by` pre-existente); el export de toda la serie queda paginado |
| `tax/services.py:23` `calculate_f29_for_period` | I_month + J | unbounded | ~6-7 | Θ(I) + 2 scans full-history | Θ(n) | SQL aggregates (values().annotate) + 1 query carryforward SUM(CASE) |
| `accounting/selectors.py:63` + `accounting/views.py:118` `get_account_ledger`/`ledger` | items del account | unbounded | 2+P (partner N+1) | Θ(histórico) | Θ(n) | ✅ P1-7: cap duro SQL (`limit` ≤ 200, default 200) + running balance por window function sobre el rango completo (exacto bajo cap); `select_related('entry','partner')`; saldos/totales por agregados exactos; flag `truncated` |
| `accounting/services.py:1599` `get_variance_report` | J_año + A cuentas | unbounded | 6 + Θ(A) | Θ(J) + scans por cuenta | Θ(J+A) | accounts prefetch en memoria (0 queries por nodo) + mantener agregados SQL |
| `accounting/services.py:1794` `get_execution_report` | B (~50-100) | unbounded | 1+2B | Θ(J por cuenta) | Θ(n) | 1 .values('account').annotate() agrupado |
| `accounting/fiscal_year_service.py:38,96,370,523` `preview_closing/close_fiscal_year/generate_opening_entry/_get_pl_account_balances` | A_pl×J | unbounded | 2×A_pl … ~150-250 | Θ(J) | Θ(n) const. alta | agregados agrupados únicos + balance en 1 query |
| `hr/services.py:355` `generate_proforma_payroll` | C conceptos | unbounded (sync en POST) | Θ(C) por payroll | ≤1 fila/concepto | Θ(C) | 1 filter(employee__in, concept__in) + dict lookup + bulk_create |
| `hr/views.py:177` `PayrollViewSet.perform_create` | C | unbounded (request síncrono) | Θ(C) | Θ(C) | Θ(C) | delegar proforma a Celery o lazy en retrieve |
| `treasury/selectors.py:411` + `views.py:1035` `get_cash_flows`/`Dashboard.list` | movimientos filtrados | unbounded | 1 | Θ(n) completo + sort Python | Θ(n log n) | ORDER BY + LIMIT 50 en el queryset (hoy slice post-materialización) |
| `treasury/selectors.py:25` `BankSelector.get_overview` | cuentas del banco | unbounded | 1 + n(N+1 credit_line) + ~35 | n + ~80 | Θ(n) | prefetch credit_line + SUM/COUNT en DB |
| `treasury/views.py:670` `BankStatementLineViewSet` | 50 líneas × grupos | page+dataset | 1 + 50×(5 + N+1 movimientos) | ~300+ queries/página | Θ(50×g) | prefetch group_data + select_related movements en el queryset |
| `treasury/selectors.py:949` `ReconciliationMatchSelector.get_group_data` | movimientos del grupo | bounded-por-dataset | 5 + N+1 serializer | Θ(n) | Θ(n) | select_related/prefetch movements y batches |
| `inventory/selectors.py:202` `get_stock_report_data` | P (catálogo trackable) | unbounded | 6P+1 | Θ(P×histórico) | Θ(P) | resolver en 1 SQL con subqueries + annotate qty_reserved |
| `inventory/services.py:1697` `check_availability` | L líneas | unbounded (payload) | L×(5+3C) | Θ(L×componentes) | Θ(L) | bulk_annotate_reserved_qty + prefetch BOMs + 1 query |
| `inventory/services.py:1776` `generate_variants` | ∏valores | unbounded **multiplicativo** | Θ(combos) | Θ(combos) | Θ(V1×…×Vk) | bulk_create + cap explícito (combos>500 → error) |
| `inventory/selectors.py:20` `list_products` | página + BOMs globales | page+dataset (memoria unbounded) | ~10 | prefetch TODAS las BOMs del dataset | O(1) q, O(dataset BOMs) memoria | prefetch de BOMs solo en contexto stock planning o filtrar por página |
| `production/selectors.py:20` `get_stock_available` | componentes BOM | bounded-por-dataset | N+1 (get_manufacturable_quantity por componente) | Θ(B×L) | Θ(n) | mover manufacturabilidad a la parte anotada/prefetch |
| `purchasing/services.py:1078` `create_note` | items×receipts | bounded-por-documento (multiplicativo) | O(I×R) | Θ(I×R) | Θ(n²) | prefetch order.receipts + 1 query de líneas por receipt (bulk) |
| `core/services/selectors.py:15` + `views.py:249` `get_global_audit_log` | limit **sin clamp** | unbounded | 10 | Θ(10×limit) | Θ(limit) | clamp server-side ≤200 o union query única |

### 2.2 Bounded-por-dataset-sin-cap / page+dataset — riesgo medio

| Entry point | n | bounded-ness | clase | remediación |
|---|---|---|---|---|
| `accounting/selectors.py:10` + `views.py:94` `list_accounts` | JournalItem ~200k | dataset-sin-cap (pagination_class=None + annotate full) | Θ(n) | materializar totales por cuenta o índice cubriente (account_id, status) |
| `accounting/views.py:146` `JournalEntryViewSet.list` | JournalItem + search JOIN | page+dataset | O(1) página + Θ(J) | índice trigram/GIN en partner name para el search |
| `tax/views.py:35` `TaxPeriodViewSet.list` | TaxPeriod + P | page+dataset + 2P (N+1 serializer) | Θ(1)+2P | prefetch declarations__payments en el queryset |
| `contacts/views.py:62` `ContactViewSet.list` | página × k (~8-15 aggregates) | page+dataset | Θ(page×O_c) | annotate todos los campos de ContactListSerializer |
| `sales/views.py:139` `SaleOrderViewSet.list` | página × L × BOM | page+dataset | Θ(page×L×B) | serializer de lista ligero sin manufacturable_quantity/available_stock |
| `sales/services.py:526` `confirm_delivery` | L+ΣB, match T×M | bounded-dataset | Θ(L+ΣB)+Θ(T×M) | prefetch BOMs + resolver match de stock moves con dict por product_id |
| `sales/services.py:691-696` (match cuadrático RAM) | T×M | bounded | Θ(T×M) | dict por product_id |
| `treasury/views.py:216` `TreasuryAccountViewSet.list` | cuentas + reconciliation_settings | unbounded (master data) | Θ(n) + N+1 | batch de ReconciliationSettings por cuenta |
| `hr/views.py:124` `EmployeeViewSet.list` | E empleados | dataset-sin-cap (sin paginar) | Θ(E) filas | activar StandardResultsSetPagination |
| `finances/views.py:38` `_handle_report_request` | reportes completos | dataset (cache 90s / async) | Θ(n×depth) | cache + async ya mitigan |
| `inventory/selectors.py:309` `get_insights` | historial producto sin cap | dataset-sin-cap | Θ(1) q, row-scan unbounded | cap en history |
| `treasury/views.py:985,994` `CheckViewSet.portfolio/in_transit` | cheques por banco | unbounded | Θ(n) | paginar o limitar a N |
| `treasury/views.py:852,867` `POSSession.summary/pdf` | facturas/movimientos sesión | dataset-sin-cap | Θ(n) | prefetch invoice/sale_order/lines |
| `hr/views.py:204` `PayrollViewSet.post_payroll` | C+A | bounded-dataset | Θ(C+A) | bulk_create JournalItems |

### 2.3 @action sin paginar (listado explícito — el whitelist del test de contrato solo cubre la clase del viewset)

**Unbounded real (riesgo alto):** `accounting: ledger:118, variance:221, preview_closing:313, generate_opening:362, execution:256, previous_year_actuals:269, export_csv:281, close:331` · `tax: documents:142, calculate:109` · `contacts: customers:71, suppliers:77, credit_ledger:88, credit_portfolio:102, credit_history:119, partners:149, partner_statement:155, partners_summary:164` · `inventory: stock_report:138, check_availability:278, generate_variants:197` · `treasury: Dashboard.list:1035, overview:88, CheckViewSet.portfolio:985/in_transit:994, unbilled_charges:1421`.

**Bounded/triviales (sin riesgo):** el resto (todos los @action de billing, workflow, core, production `bulk_transition:300` y `bulk_print:310` bounded-por-payload, etc.).

### 2.4 Tasks Celery (categoría batch — Θ(n) tolerado por premisa 2, pero sin límite duro ni presupuesto documentado)

| Task | n | round-trips | clase | riesgo | remediación |
|---|---|---|---|---|---|
| `contacts/tasks.py:13` `evaluate_credit_portfolio` | C cartera | Θ(C+ΣO×2) | Θ(n) | **alto** (sin lote ni límite) | chunks con .iterator() + 2 queries agregadas por chunk |
| `hr/tasks.py:16` `create_monthly_draft_payrolls` | E×C | Θ(E×C) | Θ(E×C) **multiplicativo** | **alto** | chunks + exists en bulk (employee__in) + batch concept_amounts |
| `treasury/tasks.py:318` `auto_match_statement_task` | líneas×candidatos | Θ(n×m) | Θ(n·m) **multiplicativo** | **alto** | cap de candidatos + batch-scoring |
| `purchasing/tasks.py:20` `generate_subscription_orders` | S suscripciones | Θ(S×~8) + LIKE contains | Θ(n) | medio-alto | 1 query de duplicados IN sub_ids + bulk_create + cap por run |
| `production/tasks.py:18` `notify_overdue_work_orders` | OTs overdue | Θ(n) + exists+create por OT | Θ(n) | medio-alto | bulk_create notifications + 1 query tasks IN ids |
| `inventory/tasks.py:13` `check_product_margin_task` | 1 | O(1) | O(1) | bajo | — |
| `sales/tasks.py:15` `cleanup_old_draft_carts` | stale | 1 DELETE bulk | Θ(n) | bajo | chunk_size si crece |
| `core/tasks.py` (6), `workflow/tasks.py` (2), `finances/tasks.py:24`, `treasury/tasks.py` resto (alertas: exists+insert por ítem) | — | O(1)-Θ(n) | batch | bajo-medio | bulk_create de notificaciones; accrue loan interest con values+annotate |

### 2.5 Signals (ORM en write path)

| Signal | costo | riesgo | remediación |
|---|---|---|---|
| `tax/signals.py:8` `mark_invoices_as_closed` | 1 bulk UPDATE del mes por **cada** post_save de TaxPeriod | medio (write amplification) | solo en transición de status (tracking=True) o mover a close_period |
| `tax/signals.py:48` `mark_journal_entries_as_closed` | 2 bulk UPDATEs del mes por **cada** post_save de AccountingPeriod | medio | guard por cambio de status |
| `inventory/signals.py:61` `handle_stock_move_updates` | ~6-8 queries por StockMove.create | medio-alto (se multiplica en confirmar_documento) | amortizar (bulk_create no dispara signals; auditar create() por línea) |
| `inventory/signals.py:115` `product_subscription_sync` | O(S) por update (S sin cap) | medio | bulk |
| `production/signals.py:10` `auto_create_work_orders` | Θ(líneas) por confirmación de SaleOrder | medio-alto | diferir a Celery o bulk_create |
| `core/signals.py:10` `sync_contact_to_company_settings` | 1 SELECT por save de Contact | bajo | — |
| `treasury/signals.py` (9), `workflow/signals.py:10` (publish Redis por save), `contacts/signals.py:1`, `sales/signals.py` | constantes | bajo | — |

### 2.6 Frontend — escapes del modelo cap-bounded

| Archivo | patrón | riesgo | remediación |
|---|---|---|---|
| `features/pos/hooks/useProducts.ts:49` `page_size:2000` | **bug de correctitud**: el backend capa a 200 → la búsqueda POS solo ve ~200 productos | **alto** | **corregido** — búsqueda server-side (`search`/`category` debounced) + `page_size:200` (2026-08-13) |
| `SalesOrdersView.tsx:67,74`, `ProductClientView.tsx:118`, `TreasuryMovementsClientView.tsx:50`, `DocumentsClientView.tsx:39`, `BankMovementsClientView.tsx:41`, `MovementClientView.tsx:37` `page_size:5000` (grouping) | grouping client-side capado a 200 → conteos de grupo incorrectos entre 201-5000 | medio (correctness) | **corregido** — guard recalibrado a `count>200` (cap real) en las 6 vistas + `useGroupByPagination.ts:4` (2026-08-13); grouping server-side sigue pendiente (P1) |
| `purchasingApi.ts:139` (`getPurchasableProducts`), `contactsApi.ts:19`, `useVariants.ts:41` | consumen list paginado sin page_size → truncado silencioso a página 1 | medio (correctness) | **corregido** — `page_size:200` explícito (2026-08-13) |
| `accountingApi.ts:6` `getAccounts`, `treasuryApi.ts:129` `getAccounts`, `hrApi.ts:68` `getEmployees` | datasets sin paginar, render O(n) | medio (crecen) | paginar o search server-side |
| `useAttributes.ts:38-49` | join `attrs.map(vals.filter)` = O(a·v) sin cap | bajo-medio | Map por attribute |
| `.find`/`.indexOf` en `.map` (PurchaseOrderModal:315, Step4_Receipt:243, BOMDrawer:585, ActionCategory:225, CostCalculatorDrawer:146, PosTerminalDrawer:103, entity-fields:940, DataTable:260, ProductGrid:87) | O(n²) sobre arrays ≤200 | bajo (etiqueta O(1) efectivo) | — |

### 2.7 Agregados O(1) triviales (cobertura del gate)

Todo entry point no listado arriba es **O(1) trivial** (1-3 queries constantes, `select_related`/`prefetch` correctos o catálogos master data pequeños):
- **selectors**: contacts 9/18, inventory 8/15, sales 6/11, billing 8/11, purchasing 5/7, treasury 9/26, accounting 2/4, production 1/4, workflow 4/5, tax 0/3, core 1/3.
- **services**: hr 12/29, workflow 10/22, treasury 20/27, contacts 11/14, billing 10/17, sales 13/28, tax 16/26, accounting 5/30 (+fiscal_year 3), inventory ~20/47, purchasing ~25/32, production ~15/44, finances 2/18.
- **views**: accounting 9, billing 10, contacts 13, core 13, hr 8, inventory ~10, production ~8, purchasing ~8, sales 10, tax 8, treasury ~49 de 68 @actions + ~15 CRUD, workflow 4.
- **tasks**: core 5/6, workflow 1/2, inventory 0/1, treasury 1/8.
- **signals**: treasury 9/9, sales 3/3, contacts 1/1, core 1/2.

## §3. Matriz de riesgo de escala

Ancla de volumen real: `seed_benchmark_data` (50k contactos / 100k movimientos) + baselines 2026-05. Extrapolación por clase: **O(n) → 10x datos ≈ 10x ms; Θ(n²) → 100x ms**. Ruptura = **p95 ≥ 300ms**.

| Área | n hoy (estimado) | clase | 10x datos | Umbral de ruptura |
|---|---|---|---|---|
| Aging / portfolio (contacts) | C=5k-50k contactos, O/P histórico | Θ(n) const. ~3 | 10x ms | **ya en ruptura**: Θ(C+O) queries > 10/request a C>50 |
| Árbol de cuentas (finances) | n=100-300 cuentas, depth 3-5 | Θ(n×depth), peor O(n²) | 10-100x ms | ruptura con cuentas>500 o chains |
| Tax documents (@action) | I_month 4-8k invoices | Θ(n) const. altísima | 10x ms | **ya en ruptura** (meses grandes) |
| Nómina (hr) | E=50-200 × C=15-30 | Θ(E×C) | 100x queries | **ya en ruptura** en batch |
| Ledger / variance / cierre (accounting) | J=200k items | Θ(n) | 10x ms | ledger ya pesado por cuenta de alto volumen |
| Dashboard treasury list | movimientos filtrados | Θ(n log n) | ~11x ms | ya frágil (sort Python post-slice) |
| Stock report (inventory) | P=catálogo trackable | Θ(P) (6P+1 q) | 10x ms | cache-miss = colapso ya |
| generate_variants | ∏valores | Θ(multiplicativo) | 100x | cap 500 combos recomendado |
| create_note (purchasing) | I×R por documento | Θ(n²) | 100x | documentos grandes |
| auto_match_statement | líneas×candidatos | Θ(n·m) | 100x | **ya en ruptura** sin cap |

**Nota de sensibilidad (cap)**: todos los flags `bounded-por-página` asumen cap=200. Subir el cap escala el trabajo de materialización de servidor en consecuencia y **requiere ADR** (invariant 12).

## §4. Veredicto

Matriz 2×2 por endpoint (empírico × asintótico); rollup por app = peor fila. **Plano empírico: PARCIAL** — no se midió en esta iteración; se apoya en baselines históricos (2026-05, search `superseded_by: ADR-0018`) y tests existentes (`test_pagination_contract` solo a nivel clase; `assertNumQueries` es deuda pendiente). Se declara explícitamente para no fingir evidencia que no existe.

| App | Empírico | Asintótico | Detalle del peor caso |
|---|---|---|---|
| contacts | parcial | ✗ | aging/portfolio/partners Θ(n) unbounded en request |
| finances | parcial | ✗ | árbol y balance sheets Θ(n×depth) sync (mitigado cache 90s/async) |
| tax | parcial | ✗ | documents Θ(n) const. altísima + signals write-amplification |
| accounting | parcial | ✗ | ledger/variance/cierre Θ(n) unbounded |
| hr | parcial | ✗ | proforma Θ(C) en POST síncrono + batch Θ(E×C) |
| treasury | parcial | ✗ | dashboard list materialización completa + statement lines ~300q |
| inventory | parcial | ✗ | stock_report 6P+1, check_availability N+1, generate_variants multiplicativo |
| production | parcial | ✗ | get_stock_available N+1 + signal auto_create_work_orders |
| purchasing | parcial | ✗ | create_note Θ(I×R) + task subscription LIKE scan |
| sales | parcial | ✗ | confirm_delivery Θ(T×M) RAM + list Θ(page×L×B) |
| billing | parcial | △ | checkout Θ(L+ΣB) medio; list limpio (InvoiceListSerializer) |
| workflow | parcial | ✓ | batch bounded, master data chica |
| core | parcial | △ | audit log limit sin clamp |

**Resumen**: 10/13 apps no cumplen el plano asintótico interactivo. El plano empírico es parcial y no valida (ni desmiente) el cumplimiento; ningún presupuesto interactivo tiene medición nueva. Umbral adoptado: **300ms** (decisión del usuario); `performance.md` mantiene 400ms — tensión documentada, reconciliar en próxima revisión.

## §5. Lista priorizada de remediación

Prioridad = riesgo × radio de impacto (riesgo {bajo,medio,alto} = clase × bounded-ness; impacto 1-5 = endpoints × frecuencia). Fix de una frase; issues aparte.

**P0 — correctitud (frontend):**
1. Bug POS: `useProducts.ts:49` (page_size 2000 → 200). **Implementado 2026-08-13** (búsqueda server-side). 
2. Grouping `page_size:5000` (6 views) → agrupación incompleta 201-5000. **Implementado 2026-08-13** (guard >200).
3. Consumidores sin page_size (getPurchasableProducts, getContacts, useVariants) → truncado silencioso. **Implementado 2026-08-13** (page_size 200).

**P1 — unbounded interactivo de mayor impacto:**
4. Tax `documents`/`get_declaration_documents` (selectors.py:18): serializador ligero + prefetch o export paginado.
5. Aging/portfolio (contacts selectors 117/208/318): SQL aggregates + LIMIT en query.
6. Árbol de cuentas (finances 72/103): CTE recursivo o pase único en memoria; reportes reutilizan balances preagregados.
7. Accounting ledger + fiscal year (preview/close/generate_opening): agregados agrupados + select_related.
8. Treasury Dashboard.list/get_cash_flows: ORDER BY+LIMIT en el queryset.
9. Inventory stock_report (6P+1) + check_availability: resolver en 1 SQL con annotate.
10. HR proforma Θ(C): batch query + delegar POST a Celery.

**P2 — batch/tasks/signals:**
11. Tasks: hr E×C, treasury auto_match n·m, contacts portfolio → chunking + caps + bulk_create.
12. Signals: tax mark_*_as_closed (guard status), production auto_create_work_orders (Celery).
13. N+1 restantes: production get_stock_available, purchasing create_note, sales confirm_delivery match.

**P3 — bounded-dataset / limpieza:**
14. page_size obsoletos (`inventoryApi.ts:130` 9999, `useProducts.ts:76` 500) — iteración vieja confirmada.
15. Accounting list_accounts (materializar totales), audit log clamp.

**Issues a abrir**: 1 por ítem (15 issues, P0-P3). El mapa en sí no cambia contratos; subir el cap 200 o paginar un @action requiere ADR (invariant 12).

## Nota de mantenimiento

El mapa envejece con el código. Cada cambio a un entry point listado debe actualizar su fila (enfoque "toca un archivo listado → actualiza la fila", a reforzar en el checklist de PR). Próxima verificación: baseline empírico con `assertNumQueries` (deuda de `zero-n-plus-one-policy.md:173`) o EXPLAIN ANALYZE sobre la top-10 de §3.
