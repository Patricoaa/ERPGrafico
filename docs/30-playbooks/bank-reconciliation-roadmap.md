# Bank Reconciliation — Roadmap LLM-Executable

**Audiencia:** agente LLM (Claude Code u otro) ejecutando tareas atómicas.
**Origen:** análisis exhaustivo de gaps documentado en conversación de 2026-04-28.
**Excluido:** B4 (parsers OFX/MT940/CAMT.053) y B5 (Open Banking Fintoc/Belvo) — no abordables ahora.
**Métrica de dificultad:** S (≤2h) · M (½–1 día) · L (1–3 días) · XL (3–5 días).

---

## Convenciones para el LLM ejecutor

Cada tarea sigue este contrato:

```
ID · Título
  Gaps cubiertos: [B##, F##]
  Dificultad: S|M|L|XL
  Archivos clave: [rutas]
  Precondiciones: [tareas previas requeridas]
  Cambios esperados:
    - bullet describiendo el cambio observable
  DoD (Definition of Done):
    - test backend / frontend pasa
    - type-check pasa (zero-any policy)
    - migración aplicada si aplica
    - sin rompimientos en flujo existente
```

**Reglas obligatorias para el ejecutor:**

1. Lee playbook indicado en `docs/30-playbooks/` antes de tocar código (`add-feature.md`, `add-migration.md`, `modify-schema.md`, `add-endpoint.md`).
2. Respeta GOVERNANCE.md (51 reglas, zero-any, view ≤20 líneas, service/selector layering).
3. Tipografía mínima `text-xs` (12px). No introducir `text-[8/9/10/11px]` nuevos.
4. Usa TanStack Query para data fetching nuevo. No `useState + axios` directo.
5. No tocar `matched_payment` legacy field salvo en Sprint 7 (deprecación controlada).
6. Cada tarea = 1 commit atómico con mensaje conventional (`feat(treasury):`, `fix(reconciliation):`, etc.).
7. Si una tarea descubre gap nuevo, abrir nota al final del archivo bajo `## Hallazgos no planificados`.

---

## SPRINT 0 — Foundation & Quick Wins (1 semana, ~5 tareas, total S+S+S+M+S)

Objetivo: corregir bugs visibles, alinear terminología, preparar terreno técnico.

### S0.1 · Reemplazar `alert()` nativos por toast
- **Gaps:** F6
- **Dificultad:** S
- **Archivos:** `frontend/app/(dashboard)/treasury/reconciliation/[id]/page.tsx:122`, `[id]/workbench/page.tsx:65`
- **Cambios:** sustituir `alert('✅ ...')` por `toast.success(...)` desde `sonner`. Verificar no quedan otros `alert()` en feature.
- **DoD:** grep `alert(` en `features/finance/bank-reconciliation/` y rutas asociadas = 0 hits.

### S0.2 · Renombrar "Sugerencia IA" → "Match Sugerido"
- **Gaps:** F17
- **Dificultad:** S
- **Archivos:** `ReconciliationPanel.tsx` (líneas ~407, ~497)
- **Cambios:** texto + i18n key si existe. Mantener ícono `Sparkles`.
- **DoD:** ningún string `IA` en componentes de reconciliation.

### S0.3 · Agregar `TAX` a `DifferenceService.DIFFERENCE_CHOICES`
- **Gaps:** B21
- **Dificultad:** S
- **Archivos:** `backend/treasury/difference_service.py:32-39`, `backend/treasury/migrations/` (no requiere migración — es enum en código), `backend/accounting/models.py` (`AccountingSettings` agregar `tax_withholding_account` FK).
- **Cambios:**
  - Añadir `TAX = 'TAX'` y label "Retención / Impuesto"
  - Añadir `'TAX': 'tax_withholding_account'` a `ACCOUNT_FIELD_MAP`
  - Migración `accounting`: agregar campo `tax_withholding_account = ForeignKey(Account, null=True, blank=True)`
- **DoD:** POST con `difference_type='TAX'` desde frontend ya no cae a `OTHER`.

### S0.4 · Tipografía mínima legible
- **Gaps:** F34, F35
- **Dificultad:** M
- **Archivos:** `ReconciliationPanel.tsx`, `DashboardKPIs.tsx`, `StatementsList.tsx`, `ReconciliationRules.tsx`, `StatementImportModal.tsx`, páginas en `app/(dashboard)/treasury/reconciliation/**`
- **Cambios:**
  - Replace global: `text-[8px]` → `text-[10px]` mantenido sólo en badges (sigue siendo problema, pero no urgente); `text-[9px]/[10px]/[11px]` → `text-xs` (12px) mínimo en celdas de tabla y labels.
  - Reducir mezcla `tracking-tighter` ↔ `tracking-widest` — usar 1 sólo por bloque.
- **DoD:** type-check + visual smoke test (Storybook/dev) sin regresión.

### S0.5 · Razón obligatoria al excluir línea
- **Gaps:** F14
- **Dificultad:** S
- **Archivos:** `ReconciliationPanel.tsx` (`actionDialog` exclude), `backend/treasury/views.py` (action `bulk_exclude` y `partial_update` de line)
- **Cambios:**
  - Frontend: `ActionConfirmModal` para exclude → reemplazar por `BaseModal` con `LabeledSelect` (DUPLICATE / BANK_ERROR / NOT_RELEVANT / OTHER) + textarea opcional.
  - Backend: añadir campos `excluded_reason`, `excluded_notes` a `BankStatementLine`. Migración 0019.
  - Endpoint `/bulk_exclude/` y `PATCH` aceptan/almacenan razón.
- **DoD:** PATCH sin `excluded_reason` cuando `reconciliation_state='EXCLUDED'` retorna 400.

---

## SPRINT 1 — Estabilizar matching & differences (1.5 semanas)

Objetivo: corregir bugs lógicos del motor de matching y diferencias.

### S1.1 · Fix `success_rate` en `RuleService.increment_rule_usage`
- **Gaps:** B14
- **Dificultad:** S
- **Archivos:** `backend/treasury/rule_service.py:313-340`
- **Cambios:** reescribir cálculo con `successes` y `attempts` separados (agregar campo `times_succeeded` IntegerField a `ReconciliationRule`, derivar `success_rate` como property). Migración 0020.
- **DoD:** test unitario: 1 success, 1 fail → success_rate = 50%.

### S1.2 · Fix `RuleService.simulate_rule` weights
- **Gaps:** B15
- **Dificultad:** S
- **Archivos:** `backend/treasury/rule_service.py:343-414`
- **Cambios:** asegurar que `_calculate_rule_score` usa `temp_rule.match_config['weights']` (ya hace, pero verificar default fallback usa los del config simulado, no defaults).
- **DoD:** test: simular regla con weights `{amount:80, date:20}` produce score distinto del default.

### S1.3 · `confidence_threshold` configurable en UI auto-match
- **Gaps:** F16
- **Dificultad:** S
- **Archivos:** `ReconciliationPanel.tsx` (`actionDialog.automatch`)
- **Cambios:** modal automatch incluye slider 50–100 (default 90). Pasa al endpoint.
- **DoD:** payload de `/auto_match/` incluye threshold del slider.

### S1.4 · Distribuir `difference_amount` entre líneas del grupo
- **Gaps:** B22
- **Dificultad:** M
- **Archivos:** `backend/treasury/matching_service.py:418-463` (`create_match_group`)
- **Cambios:** repartir diferencia proporcional al `abs(amount)` de cada línea en lugar de asignar todo a `lines[0]`. Documentar reparto en `notes` del grupo.
- **DoD:** test: grupo con líneas $100/$200/$300 y diff $60 → líneas reciben $10/$20/$30.

### S1.5 · `JournalEntry` de diferencia en estado DRAFT, no POSTED
- **Gaps:** B23
- **Dificultad:** S
- **Archivos:** `backend/treasury/difference_service.py:125-126`
- **Cambios:** cambiar `entry.status = 'POSTED'` → permanece `DRAFT`. Agregar setting `AccountingSettings.auto_post_reconciliation_adjustments` (BooleanField default False) que decide. Migración accounting.
- **DoD:** ajuste por defecto queda DRAFT; setting=True restaura comportamiento previo.

### S1.6 · Tracking explícito de JE de transferencia entre cuentas en `confirm_match`
- **Gaps:** B16
- **Dificultad:** M
- **Archivos:** `backend/treasury/matching_service.py:537-585`
- **Cambios:** agregar M2M `ReconciliationMatch.transfer_journal_entries` (o FK on `TreasuryMovement.transfer_journal_entry`). Migración 0021. Reemplazar TODO comment con persistencia real.
- **DoD:** crear match cross-account → consulta `match.transfer_journal_entries.all()` retorna el asiento.

### S1.7 · Cleanup invalidación cache en `BankStatementLine.save()`
- **Gaps:** B17, B19
- **Dificultad:** M
- **Archivos:** `backend/treasury/models.py:874-882`, `reconciliation_service.py` (post bulk_create)
- **Cambios:**
  - Quitar `invalidate_report_cache` de `BankStatementLine.save()` y `delete()`.
  - Invalidar 1 vez al final de operaciones bulk: import, auto_match, confirm.
  - Llamar `invalidate_report_cache('treasury')` explícito post `bulk_create`.
- **DoD:** import de cartola 500 líneas no excede N invalidaciones (medir con counter mock).

---

## SPRINT 2 — Performance del matching (2 semanas)

Objetivo: matar N+1, escalar a cartolas 500–2000 líneas.

### S2.1 · Refactor `auto_match_statement` para batch processing
- **Gaps:** B8
- **Dificultad:** L
- **Archivos:** `backend/treasury/matching_service.py:662-742`
- **Cambios:**
  - Pre-fetch todos los `TreasuryMovement` candidatos del rango de fechas de la cartola en 1 query.
  - Construir índice en memoria (dict por amount o por transaction_id).
  - Aplicar scoring sobre el set en RAM, no querying por línea.
  - Mantener compatibilidad de API.
- **DoD:** test perf: cartola sintética 500 líneas + 1000 pagos → `auto_match` <10s en CI.

### S2.2 · Fix `confirm_match` N+1 en update de statement counter
- **Gaps:** B9
- **Dificultad:** M
- **Archivos:** `backend/treasury/matching_service.py:480-586`
- **Cambios:**
  - Mover update de `l.statement.reconciled_lines` fuera del loop, recalcular 1 vez al final con aggregate `Count`.
  - Usar `BankStatementLine.objects.bulk_update([...], fields=['reconciliation_status', 'reconciled_at', 'reconciled_by'])`.
  - **Cuidado:** bulk_update no dispara `save()` ni `HistoricalRecords` — registrar history manualmente si auditoría requerida (ver GOVERNANCE).
- **DoD:** confirmar grupo de 50 líneas <2s.

### S2.3 · `BankStatement.reconciled_lines` como property derivada
- **Gaps:** B32
- **Dificultad:** M
- **Archivos:** `backend/treasury/models.py:709-748`
- **Cambios:**
  - Eliminar IntegerField `reconciled_lines`.
  - Reemplazar por `@property` que hace `self.lines.filter(reconciliation_status='RECONCILED').count()` con cache_property si necesario.
  - Migración data: dropear columna. Migración 0022.
  - Actualizar serializers que la exponen como campo plano.
- **DoD:** sin paths que escriban `statement.reconciled_lines = ...`.

### S2.4 · Eliminar cap `[:50]` arbitrario en candidates
- **Gaps:** B10
- **Dificultad:** S
- **Archivos:** `backend/treasury/matching_service.py:122`
- **Cambios:** subir cap a `[:200]` con comentario explicativo. Si performance crítica, indexar por `(treasury_account, date, is_reconciled)`. Verificar índices en `TreasuryMovement.Meta.indexes`.
- **DoD:** migración índice + test no excede latencia.

### S2.5 · Normalización de glosas bancarias
- **Gaps:** B12
- **Dificultad:** L
- **Archivos:** nuevo `backend/treasury/glossa_normalizer.py`, integrar en `MatchingService._calculate_match_score`
- **Cambios:**
  - Función `normalize_description(text, bank_format) -> str` que strippea prefijos comunes ("TEF/", "ABO TR ", "TEF EFEC ", "TRANSFERENCIA DE ", etc.)
  - Diccionario de prefijos por `bank_format`.
  - Tokenizar y devolver bag of words limpio.
- **DoD:** test: `normalize_description("TEF/COMERCIAL ANDES SPA", "BANCO_CHILE_CSV")` → `"COMERCIAL ANDES"`.

### S2.6 · Fuzzy matching para descripción (trigram)
- **Gaps:** B11
- **Dificultad:** L
- **Archivos:** `backend/treasury/matching_service.py:330-344`, requirements add `rapidfuzz`
- **Cambios:**
  - En lugar de `if contact_name in description`, usar `rapidfuzz.fuzz.partial_ratio` con threshold 80.
  - Score escalado: ratio 100 → 10pts, ratio 80 → 5pts, <80 → 0.
- **DoD:** test: "Comercial Andes" vs "COMERCIAL ANDES SPA" → score >0.

---

## SPRINT 3 — Idempotencia y validaciones de import (1.5 semanas)

Objetivo: blindar import contra duplicados y errores.

### S3.1 · Hash SHA-256 del archivo + dedup
- **Gaps:** B1
- **Dificultad:** M
- **Archivos:** `backend/treasury/models.py` (`BankStatement` agregar `file_hash CharField(64, unique=False)`), `reconciliation_service.py:23-116`
- **Cambios:**
  - Calcular SHA-256 del file en `import_statement`.
  - Antes de crear `BankStatement`, verificar existencia previa para misma `treasury_account`.
  - Si existe: levantar `ValueError("Cartola ya importada el {date} por {user}")`.
  - Migración 0023.
- **DoD:** segundo POST con mismo archivo → 400 con mensaje claro.

### S3.2 · Dedup por `transaction_id` natural del banco
- **Gaps:** B31
- **Dificultad:** M
- **Archivos:** `backend/treasury/models.py:863-872`
- **Cambios:**
  - Migración 0024: agregar `UniqueConstraint(fields=['statement', 'transaction_id'], condition=Q(transaction_id__gt=''), name='uniq_stmt_txnid')`.
  - Manejar caso transaction_id vacío sin quebrar.
  - En import, si `transaction_id` repetido en mismo archivo → warning + skip de duplicado.
- **DoD:** test: archivo con 2 filas mismo transaction_id → 1 sola línea creada + 1 warning.

### S3.3 · Detección de solapamiento de rangos
- **Gaps:** B2, B3
- **Dificultad:** L
- **Archivos:** `backend/treasury/models.py` (`BankStatement` agregar `period_start` y `period_end`), `reconciliation_service.py:155-256`
- **Cambios:**
  - Migración 0025: agregar `period_start = DateField()`, `period_end = DateField()`. Backfill desde `min/max(lines.transaction_date)`.
  - En `validate_statement` extraer `period_start`/`period_end` desde lineas parseadas.
  - Bloquear creación si rango se cruza con cartola CONFIRMED previa misma cuenta. Permitir con DRAFT (warning).
  - Validar `previous.closing_balance == this.opening_balance` (warning si discrepancia).
- **DoD:** test: importar Ene+Feb, luego Feb+Mar → 400.

### S3.4 · Import tolerante a errores fila-a-fila
- **Gaps:** B6
- **Dificultad:** L
- **Archivos:** `backend/treasury/reconciliation_service.py:23-256`
- **Cambios:**
  - `validate_statement` clasifica errores como `line_errors` (por línea) en lugar de un solo error global.
  - Crear `BankStatement` aún con discontinuidades, marcando líneas problemáticas con `has_warning=True` (nuevo BoolField + `warning_message TextField`).
  - Migración 0026.
  - Endpoint retorna report estructurado: `{statement_id, errors: [], warnings: [{line, message}]}`.
- **DoD:** archivo con 3 líneas problemáticas crea cartola con esas líneas marcadas, no rechaza todo.

### S3.5 · Validación cuenta ↔ formato
- **Gaps:** F33
- **Dificultad:** S
- **Archivos:** `backend/treasury/models.py` (`TreasuryAccount` agregar `default_bank_format CharField`), `reconciliation_service.py:51-57`
- **Cambios:**
  - Si `treasury_account.default_bank_format` definido y difiere del seleccionado → warning (no bloqueo).
  - UI: pre-seleccionar formato basado en cuenta.
- **DoD:** seleccionar cuenta BCI muestra warning si user elige formato Santander.

### S3.6 · UI: Step "Validación / Preview" en wizard
- **Gaps:** F24, F31
- **Dificultad:** L
- **Archivos:** `frontend/features/treasury/components/StatementImportModal.tsx`, posiblemente nuevo `ImportPreviewStep.tsx`
- **Cambios:**
  - Nuevo step entre "Mapping" y "Submit".
  - Llama nuevo endpoint `/treasury/statements/dry_run/` que parsea sin persistir, retorna: total líneas, period_start, period_end, opening/closing balance detectado, warnings, errores por fila.
  - Tabla de warnings con fila + mensaje. Botón "Continuar de todas formas" o "Volver al mapeo".
- **DoD:** flujo completo: Upload → Map → Preview con totales y warnings → Submit.

### S3.7 · Skip rows configurable + auto-detect delimiter
- **Gaps:** F25, F26
- **Dificultad:** M
- **Archivos:** `StatementImportModal.tsx`, `csv_parser.py`
- **Cambios:**
  - UI agrega controles `skip_rows`, `skip_footer_rows`, `delimiter` (auto/`;`/`,`/`\t`) en step Mapping.
  - Pasa al `custom_config`.
  - Backend: si `delimiter='auto'` usa `csv.Sniffer`.
- **DoD:** importar Banco Estado (5 header rows) sin tocar formats.py.

---

## SPRINT 4 — Workbench UX upgrade (2 semanas)

Objetivo: transformar workbench en herramienta productiva.

### S4.1 · Migrar `useReconciliation` a TanStack Query
- **Gaps:** F21, F22
- **Dificultad:** L
- **Archivos:** `frontend/features/finance/bank-reconciliation/hooks/useReconciliation.ts`, `ReconciliationPanel.tsx`, `ReconciliationDashboard.tsx`, `StatementsList.tsx`, `ReconciliationRules.tsx`
- **Cambios:**
  - Convertir `fetchStatements`, `fetchAccounts`, `fetchRules`, `fetchDashboardData`, `fetchSuggestions`, `fetchUnreconciledLines`, `fetchUnreconciledPayments` en `useQuery` con `queryKey` estructurado.
  - Match/exclude/unmatch como `useMutation` con `onSuccess` que invalida queryKeys puntuales.
  - Optimistic update en match.
  - `AbortController` automático via React Query al cambiar selección.
- **DoD:** seleccionar línea rápido (5 cambios en 1s) no dispara race; UI no parpadea en match (optimistic).

### S4.2 · Suggestions panel real (top-5 con score y razones)
- **Gaps:** F7, F23
- **Dificultad:** L
- **Archivos:** nuevo `frontend/features/finance/bank-reconciliation/components/SuggestionsPanel.tsx`, integrar en `ReconciliationPanel.tsx`
- **Cambios:**
  - Cuando `selectedLines.length === 1` y `suggestions.length > 0`, renderizar panel lateral/inferior con:
    - Cards top-5 con score badge, razones (chips: "Monto exacto", "Fecha exacta", "ID coincide"), monto, diferencia, contraparte, botón "Match con esta sugerencia".
  - Mismo para `selectedPayments.length === 1` con `lineSuggestions`.
- **DoD:** seleccionar 1 línea muestra panel con 5 candidates accionables.

### S4.3 · Pagination + filtros avanzados en workbench
- **Gaps:** F10, F11
- **Dificultad:** M
- **Archivos:** `ReconciliationPanel.tsx` (DataTables), backend `views.py` action `statement-lines/` queryparams
- **Cambios:**
  - Quitar `hidePagination`. Default pageSize 50.
  - Filtros adicionales: `amount_min`, `amount_max`, `date_from`, `date_to`, `direction` (debit/credit/all), `state`.
  - Backend acepta esos query params.
- **DoD:** cartola 300 líneas se navega paginada; filtro "solo abonos" reduce visible.

### S4.4 · Atajos de teclado
- **Gaps:** F9
- **Dificultad:** M
- **Archivos:** `ReconciliationPanel.tsx`, hook nuevo `useReconciliationShortcuts.ts`
- **Cambios:**
  - `j`/`k`: navegar fila banco arriba/abajo
  - `J`/`K`: navegar fila sistema
  - `Enter`: ejecutar match con selección actual (si válida)
  - `x`: excluir fila banco activa
  - `?`: mostrar overlay con shortcuts
- **DoD:** shortcuts funcionan, no se gatillan dentro de inputs.

### S4.5 · Crear pago al vuelo desde workbench
- **Gaps:** F12
- **Dificultad:** L
- **Archivos:** `ReconciliationPanel.tsx`, reutilizar `MovementWizard` existente
- **Cambios:**
  - Botón "Crear pago" sobre fila banco no conciliada.
  - Abre `MovementWizard` pre-cargado con: `amount`, `date`, `treasury_account`, `direction` derivados de la línea.
  - Al guardar, automáticamente intenta `manual_match` de la línea con el nuevo pago.
- **DoD:** desde workbench creo movement de comisión y queda conciliado en 1 flujo.

### S4.6 · Sticky bar muestra totales globales sin selección
- **Gaps:** F20
- **Dificultad:** S
- **Archivos:** `ReconciliationPanel.tsx`
- **Cambios:** cuando no hay selección, sticky bar muestra "Pendientes: X líneas · Cargos $Y · Abonos $Z".
- **DoD:** barra siempre visible, contenido cambia según selección.

### S4.7 · Estado vacío + undo en match
- **Gaps:** F18, F41, F42
- **Dificultad:** M
- **Archivos:** `ReconciliationPanel.tsx`
- **Cambios:**
  - Empty state: cuando 0 líneas y 0 pagos pendientes, mostrar ilustración "Conciliado al 100%" con CTA "Confirmar Cartola".
  - `toast.success("Match creado", { action: { label: "Deshacer", onClick: () => unmatch(lineId) } })`.
  - Loading toast en mutations.
- **DoD:** match disparado muestra toast con undo funcional 5s.

### S4.8 · Auto-match con progreso (server-sent events o polling)
- **Gaps:** F15
- **Dificultad:** L
- **Archivos:** `backend/treasury/views.py` (auto_match action → Celery task), `frontend/features/finance/bank-reconciliation/components/AutoMatchProgressModal.tsx`
- **Cambios:**
  - Mover `auto_match_statement` a Celery task.
  - Endpoint inicia task → retorna `task_id`.
  - Frontend polling `/treasury/statements/auto_match_status/<task_id>/` cada 1s.
  - Modal muestra: procesadas/total, matcheadas hasta el momento.
- **DoD:** auto-match cartola 500 líneas muestra progreso real.

---

## SPRINT 5 — Allocation parcial & Group N:M maduro (2 semanas)

Objetivo: cubrir caso PYME crítico de depósito consolidado.

### S5.1 · Modelo `PaymentAllocation` para split
- **Gaps:** B13
- **Dificultad:** L
- **Archivos:** `backend/treasury/models.py` (nuevo), migración 0027
- **Cambios:**
  - Modelo `PaymentAllocation`:
    - `treasury_movement = ForeignKey(TreasuryMovement, related_name='allocations')`
    - `invoice = ForeignKey(billing.Invoice, null=True)` o `sale_order` o `purchase_order` o `bank_statement_line`
    - `amount = DecimalField`
    - `notes = TextField`
  - Constraint: sum(allocations.amount) == treasury_movement.amount.
  - Migrar pagos existentes (1 allocation por pago a la fecha).
- **DoD:** pago $1M con 3 allocations $400k+$300k+$300k persiste y suma valida.

### S5.2 · Service `AllocationService` + endpoint
- **Gaps:** B13, F13
- **Dificultad:** M
- **Archivos:** `backend/treasury/allocation_service.py` (nuevo), `views.py`
- **Cambios:**
  - `AllocationService.allocate(movement, allocations: List[Dict])` valida + persiste.
  - Endpoint `POST /treasury/payments/<id>/allocate/`.
  - Endpoint `GET /treasury/payments/<id>/allocations/`.
- **DoD:** test crear/leer/editar allocation.

### S5.3 · UI Split dialog en workbench
- **Gaps:** F13
- **Dificultad:** L
- **Archivos:** nuevo `frontend/features/finance/bank-reconciliation/components/SplitAllocationDialog.tsx`
- **Cambios:**
  - Botón "Distribuir" sobre línea banco con monto > suma de pagos seleccionados.
  - Dialog: lista de invoices/orders abiertos del contacto, input amount por cada uno, suma debe coincidir.
  - Crea allocations + match grupo.
- **DoD:** depósito $1M conciliado contra 3 facturas con montos diferentes.

### S5.4 · Reportería: ver allocations en factura
- **Gaps:** B13
- **Dificultad:** M
- **Archivos:** `frontend/features/billing/components/InvoiceDetail.tsx`, `backend/billing/serializers.py`
- **Cambios:** sección "Pagos aplicados" lista allocations con monto + fecha + cartola origen.
- **DoD:** factura $400k cobrada vía split muestra "Aplicado: $400k de DEP-000123".

---

## SPRINT 6 — Reportes formales y compliance (2 semanas)

Objetivo: entregables PDF y workflows formales para contador.

### S6.1 · Reporte PDF Conciliación Bancaria
- **Gaps:** B26, F45
- **Dificultad:** XL
- **Archivos:** nuevo `backend/treasury/reports/bank_reconciliation_pdf.py`, lib `reportlab` o `weasyprint`
- **Cambios:**
  - Endpoint `GET /treasury/statements/<id>/reconciliation_report.pdf`
  - Contenido:
    - Encabezado: empresa, RUT, cuenta, periodo, responsable
    - Saldo banco apertura / cierre
    - Movimientos no registrados en libros (líneas RECONCILED con diferencia)
    - Cheques girados pendientes (movements is_pending_registration outbound)
    - Depósitos en tránsito (movements is_pending_registration inbound)
    - Saldo libros = saldo banco - dep en tránsito + cheques pendientes ± ajustes
    - Firma electrónica + timestamp
- **DoD:** descargar PDF formato bancario clásico.

### S6.2 · Concepto "Cheques pendientes" y "Depósitos en tránsito"
- **Gaps:** B27
- **Dificultad:** M
- **Archivos:** `backend/treasury/reports_service.py` (nuevos métodos `pending_checks_report`, `deposits_in_transit_report`), `views.py` actions
- **Cambios:**
  - Queries que filtran `TreasuryMovement.is_pending_registration=True` por cuenta y período.
  - Frontend: tab nueva en `/treasury/reconciliation` "Pendientes en tránsito".
- **DoD:** vista lista cheques + depósitos no procesados por banco.

### S6.3 · Workflow cierre mensual conciliación
- **Gaps:** F45, F48
- **Dificultad:** L
- **Archivos:** nuevo modelo `MonthlyReconciliationClosure`, migración 0028
- **Cambios:**
  - `MonthlyReconciliationClosure(treasury_account, period_year, period_month, closed_at, closed_by, signed_at, signed_by, notes, pdf_file)`
  - Solo se puede cerrar mes si todas las cartolas del mes están CONFIRMED.
  - Cerrar bloquea modificaciones (validation en `BankStatement.save()` y `BankStatementLine.save()`).
  - UI: pestaña "Cierres mensuales" con tabla por mes/cuenta.
- **DoD:** cerrar mes Marzo cuenta BCI bloquea ediciones; reapertura requiere superuser.

### S6.4 · Vista Libros vs Cartola lado a lado
- **Gaps:** F43, F44
- **Dificultad:** L
- **Archivos:** nueva ruta `frontend/app/(dashboard)/treasury/reconciliation/[id]/ledger-vs-bank/page.tsx`, endpoint backend
- **Cambios:**
  - Backend: action `/statements/<id>/ledger_vs_bank/` retorna lista combinada de movements del sistema y lines de cartola alineados por fecha.
  - Frontend: 2 columnas, fila por fecha, indicadores de match/no-match. Resumen al pie con cuadre clásico.
- **DoD:** vista navegable mes completo.

### S6.5 · Export Excel líneas no conciliadas
- **Gaps:** F52, B30
- **Dificultad:** S
- **Archivos:** `backend/treasury/views.py` action `statement-lines/export_unreconciled/`, lib `openpyxl`
- **Cambios:** endpoint retorna .xlsx con columnas estándar. Botón en workbench "Exportar pendientes".
- **DoD:** descarga genera xlsx abrible en Excel.

### S6.6 · Stale items: Celery beat alert
- **Gaps:** B28
- **Dificultad:** M
- **Archivos:** `backend/treasury/tasks.py`, `config/celery.py` schedule, settings notification
- **Cambios:**
  - Task `check_stale_reconciliations` corre diario.
  - Identifica líneas UNRECONCILED con `transaction_date < today - 30 days`.
  - Envía email a usuarios con permiso `treasury.confirm_statement`.
  - In-app notification badge en menú.
- **DoD:** simular líneas viejas, ejecutar task manualmente, recibir email.

---

## SPRINT 7 — Navegación, deuda técnica, refinamiento (1.5 semanas)

Objetivo: limpiar deuda y consolidar.

### S7.1 · Consolidar rutas duplicadas `/[id]/{process,match,workbench}`
- **Gaps:** F1, F4
- **Dificultad:** M
- **Archivos:** eliminar `frontend/app/(dashboard)/treasury/reconciliation/[id]/{process,match}/page.tsx` si zombi (verificar incoming links primero); mantener `/[id]` como summary y `/[id]/workbench` como matching.
- **Cambios:**
  - Inventariar referencias `router.push(...)` y `<Link>` apuntando a esas rutas.
  - Decidir consolidación: `/[id]` como detalle + tab interna, o `/[id]/workbench` separado. Documentar decisión en ADR `docs/10-architecture/`.
  - Eliminar el state `view='matching'` interno en `[id]/page.tsx` si se opta por ruta separada.
- **DoD:** una sola ruta por concepto; sin enlaces rotos (test e2e mínimo).

### S7.2 · Breadcrumbs en todas las rutas de reconciliation
- **Gaps:** F3
- **Dificultad:** S
- **Archivos:** rutas en `app/(dashboard)/treasury/reconciliation/**`, componente `Breadcrumbs` shared
- **Cambios:** breadcrumb "Tesorería › Conciliación › EXT-000123 › Workbench" en cada nivel.
- **DoD:** todas las páginas con breadcrumb funcional.

### S7.3 · Deprecación `BankStatementLine.matched_payment` legacy
- **Gaps:** B18
- **Dificultad:** L
- **Archivos:** `models.py`, `matching_service.py` (eliminar fallback legacy), data migration
- **Cambios:**
  - Data migration 0029: para cada line con `matched_payment_id` y sin `reconciliation_match`, crear `ReconciliationMatch` 1:1.
  - Migración 0030: eliminar field `matched_payment` y `bank_statement_line` (FK en TreasuryMovement legacy).
  - Limpiar code paths "if not group and line.matched_payment".
- **DoD:** schema limpio; no hay refs a `matched_payment` en código.

### S7.4 · `ReconciliationMatch.created_by` nullable para auto-match
- **Gaps:** B33
- **Dificultad:** S
- **Archivos:** `models.py:43-48`, migración 0031
- **Cambios:** `created_by = ForeignKey(..., null=True, blank=True, on_delete=SET_NULL)` con etiqueta "Sistema" en UI cuando null.
- **DoD:** auto_match ejecutado por Celery (sin user) crea match exitosamente.

### S7.5 · Renombrar "Banco de Trabajo" → "Mesa de Conciliación"
- **Gaps:** F36
- **Dificultad:** S
- **Archivos:** páginas y componentes con string "Banco de Trabajo"
- **DoD:** grep "Banco de Trabajo" = 0 hits.

### S7.6 · Unificar terminología "Pendiente / Sin Conciliar / UNRECONCILED"
- **Gaps:** F37
- **Dificultad:** S
- **Archivos:** todos los componentes UI y `i18n` keys si existen
- **Cambios:** estandar visible "Sin Conciliar". Estado backend permanece UNRECONCILED.
- **DoD:** no hay 2 strings distintos para el mismo estado en UI.

### S7.7 · Permisos granulares de reconciliation
- **Gaps:** F48
- **Dificultad:** M
- **Archivos:** `backend/treasury/permissions.py` (nuevo), `views.py` (DRF permission_classes)
- **Cambios:**
  - Permisos: `treasury.import_statement`, `treasury.match_lines`, `treasury.confirm_statement`, `treasury.reopen_closure`.
  - Asignar a roles default vía `setup_demo_data` o command `assign_period_permissions.py`.
- **DoD:** usuario sin `confirm_statement` ve botón deshabilitado y backend retorna 403.

### S7.8 · Drilldown desde KPI Dashboard a workbench
- **Gaps:** F5
- **Dificultad:** S
- **Archivos:** `DashboardKPIs.tsx`
- **Cambios:** KPI "Pendiente Conciliar" linkeable a `/treasury/reconciliation?tab=statements&filter=in_progress`.
- **DoD:** click en KPI navega filtrado.

### S7.9 · Onboarding tour primer uso
- **Gaps:** F49
- **Dificultad:** L
- **Archivos:** lib `intro.js` o `react-joyride`, hook `useFirstTimeTour`
- **Cambios:**
  - Tour 5 pasos: importar cartola, ver workbench, seleccionar línea, ver sugerencias, confirmar match.
  - Persistir "tour completado" en `UserProfile` o localStorage.
- **DoD:** primer login post-deploy lanza tour; rerun via menú ayuda.

### S7.10 · Plantillas de mapping (banco custom)
- **Gaps:** F27, F28
- **Dificultad:** L
- **Archivos:** nuevo modelo `BankFormatTemplate`, migración 0032, UI
- **Cambios:**
  - `BankFormatTemplate(name, treasury_account, mapping_json, delimiter, skip_rows, ..., created_by)`.
  - Botón "Guardar como plantilla" en step Mapping del wizard.
  - Selector de plantillas guardadas en step Upload.
- **DoD:** importar 2da cartola del mismo banco custom solo requiere seleccionar plantilla.

### S7.11 · Multi-file drop en import
- **Gaps:** F29
- **Dificultad:** M
- **Archivos:** `StatementImportModal.tsx`, dropzone component
- **Cambios:** aceptar N archivos, procesarlos secuencialmente con barra de progreso. Para genéricos pedir mapping una sola vez si headers iguales.
- **DoD:** drag de 3 cartolas mensuales crea 3 BankStatement.

---

## SPRINT 8 — Pulido final, accesibilidad, modos (1 semana)

### S8.1 · Modo Simple vs Avanzado
- **Gaps:** F51
- **Dificultad:** M
- **Archivos:** `UserProfile` add `interface_mode = CharField(choices=[SIMPLE, ADVANCED])`, gates en componentes
- **Cambios:** modo simple oculta tabs Reglas y configuraciones de score; auto-match es 1 botón sin threshold.
- **DoD:** toggle en perfil cambia UX visible.

### S8.2 · Plantillas predefinidas siempre visibles
- **Gaps:** F50
- **Dificultad:** S
- **Archivos:** `ReconciliationRules.tsx`
- **Cambios:** botón "Generar reglas predeterminadas" siempre visible (no solo cuando 0 reglas).
- **DoD:** UI accesible siempre.

### S8.3 · Indicar split / pago vinculado en summary
- **Gaps:** F19 (color), navegación pago
- **Dificultad:** S
- **Archivos:** `[id]/page.tsx` columna `matched_payment`
- **Cambios:** convertir display_id en `<Link>` al pago. Ajustar color sugerencia a `text-info` o `text-primary` (no warning).
- **DoD:** click en display_id navega al pago.

### S8.4 · Drag & drop pago → línea (opcional avanzado)
- **Gaps:** F8
- **Dificultad:** L
- **Archivos:** `ReconciliationPanel.tsx`, lib `@dnd-kit/core`
- **Cambios:** habilitar drag de fila pago hacia fila banco → dispara match. Solo modo avanzado.
- **DoD:** drag exitoso crea match.

### S8.5 · Auditoría histórica de unmatch / exclude
- **Gaps:** B20, B29
- **Dificultad:** M
- **Archivos:** `backend/treasury/views.py` action `statements/<id>/audit_log/`, frontend timeline tab
- **Cambios:**
  - Action retorna eventos derivados de `HistoricalRecords` (import, match, unmatch, exclude, confirm).
  - UI tab "Historial" en detalle de cartola.
- **DoD:** acciones quedan visibles cronológicamente.

### S8.6 · Sticky bar responsive en mobile
- **Gaps:** F40
- **Dificultad:** S
- **Archivos:** `ReconciliationPanel.tsx`
- **Cambios:** colapsar a botón flotante en `<md`. Expandir on tap.
- **DoD:** en 375px no tapa contenido.

---

## Resumen total

| Sprint | Tareas | Dificultad acumulada | Duración estimada |
|--------|--------|----------------------|-------------------|
| 0 | 5 | 4S+1M | 1 semana |
| 1 | 7 | 4S+3M | 1.5 semanas |
| 2 | 6 | 1S+2M+3L | 2 semanas |
| 3 | 7 | 1S+2M+4L | 1.5–2 semanas |
| 4 | 8 | 1S+3M+4L | 2 semanas |
| 5 | 4 | 0S+2M+2L | 2 semanas |
| 6 | 6 | 1S+2M+2L+1XL | 2 semanas |
| 7 | 11 | 5S+3M+3L | 1.5 semanas |
| 8 | 6 | 3S+2M+1L | 1 semana |
| **Total** | **60 tareas** | — | **~14–15 semanas (≈3.5 meses con 1 dev)** |

Cobertura de gaps: B1, B2, B3, B6, B7 (parcial), B8–B33 + F1, F3–F52 (B4/B5 excluidos).

---

## Notas para LLM ejecutor

- Antes de cada Sprint, lee `docs/30-playbooks/refactor-workflow.md` si aplica refactor, `add-migration.md` si tocas modelos.
- Cada migración debe ir con data backfill cuando elimina campo.
- Tests obligatorios para servicios críticos: matching, allocation, import idempotency.
- Sprint 5 (allocation) modifica `TreasuryMovement` flow → requiere coord con sales/purchasing/billing payment endpoints.
- Sprint 7 deprecation legacy field `matched_payment` requiere ventana de migración: deploy 7.3a (data migrate) → wait 1 release → deploy 7.3b (drop column).
- Si tarea bloqueada por gap nuevo, anotar abajo y continuar con siguiente.

## Hallazgos no planificados

(Vacío — el ejecutor agrega aquí gaps descubiertos durante implementación.)
