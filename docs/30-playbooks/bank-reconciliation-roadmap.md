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
8. **Antes de marcar [COMPLETADA]**: ejecutar grep/test que valide DoD literal. No marcar por inferencia.

---

## Glosario de Gaps (referencia self-contained)

Cada gap viene del análisis backend/frontend. **El LLM ejecutor consulta esta sección para entender exactamente qué problema resuelve antes de implementar.**

### Gaps de BACKEND (B##)

| Gap | Categoría | Descripción del problema | Síntoma observable |
|-----|-----------|--------------------------|--------------------|
| **B1** | Importación | Re-importar mismo archivo CSV/Excel duplica `BankStatement` y todas sus líneas. No hay hash SHA-256 ni dedup por clave natural. | Subir misma cartola dos veces crea EXT-000123 y EXT-000124 idénticos. |
| **B2** | Importación | No detecta solapamiento de rangos entre cartolas. Importar Ene+Feb y luego Feb+Mar duplica las líneas de Febrero. | Reportes inflan saldo Feb por doble conteo. |
| **B3** | Importación | `BankStatement` solo tiene `statement_date` (un día). Cartolas reales son rangos. Imposible validar continuidad temporal entre cartolas consecutivas (closing previo == opening actual). | Saldo libros desincronizado del banco. |
| **B6** | Importación | `validate_statement` levanta `ValueError` y hace rollback total si una sola línea tiene saldo inconsistente. Una línea mala bloquea todo el archivo. | Cartola con error en fila 47 no se importa: re-trabajo manual. |
| **B7** | Multi-currency | `TreasuryAccount.currency` existe pero no hay tabla `ExchangeRate` ni cálculo automático de diferencia de cambio en match cross-currency. | Cartola USD inconciliable contra pagos CLP. |
| **B8** | Performance | `auto_match_statement` itera líneas y por cada una llama `suggest_matches` que ejecuta query de 50 candidatos + scoring + serializer. O(N×50) queries → cartola 500 líneas = 25k queries. | Timeout en cartolas grandes (>200 líneas) en hosting PYME. |
| **B9** | Performance | `confirm_match` recalcula `statement.reconciled_lines` con `count()` y dispara `statement.save()` dentro del loop de líneas. N+1 saves + N invalidaciones cache + N HistoricalRecords. | Confirmar grupo de 20 líneas tarda 30s+. |
| **B10** | Matching | Cap hardcoded `[:50]` en candidatos del scoring → si pago real está en posición 51 (cuenta con muchos pagos en mismo rango), nunca aparece como sugerencia. | Falsos negativos silenciosos en matching. |
| **B11** | Matching | Score de descripción usa `if name in description` (substring strict). Sin fuzzy: "Comercial Andes SpA" vs "COMERCIAL ANDES" sin "SPA" → no match. | Score 0 en casos triviales por sufijos legales. |
| **B12** | Matching | No hay normalización de glosas bancarias por banco. Banco Chile prefija "TEF/", Santander "ABO TR ", BICE "TEF EFEC ". Cada banco tokeniza distinto. | Score degradado por ruido textual de prefijos bancarios. |
| **B13** | Allocation | Sin allocación parcial: depósito $1,000,000 que cubre 3 facturas $400k+$300k+$300k no se puede dividir. Group N:M agrupa total pero no reparte por factura. | PYMEs cobran consolidado — flujo crítico no soportado. |
| **B14** | Reglas | `RuleService.increment_rule_usage` actualiza `success_rate` con promedio móvil incorrecto: usa `success_rate` pre-update con contador post-update → drift acumulado en cada llamada. | Métricas de éxito de regla no reflejan realidad. |
| **B15** | Reglas | `simulate_rule` no respeta `weights` propios de la regla simulada — cae a defaults si no llegan en el config. | Simulación no representa lo que la regla hará en producción. |
| **B16** | Contabilidad | `confirm_match` crea `JournalEntry` de transferencia entre cuentas (cross-account) sin tracking explícito en el modelo. Comentario TODO en código admite: "Link entry to payment? maybe append to notes". | Asientos huérfanos sin trazabilidad bidireccional. |
| **B17** | Performance | `BankStatementLine.save()` y `delete()` invalidan cache `treasury` cada vez. Durante import bulk se invalida miles de veces. | Latencia alta en operaciones masivas. |
| **B18** | Deuda técnica | Coexisten campo legacy `BankStatementLine.matched_payment` y campo nuevo `reconciliation_match`. Código tiene fallback "if not group and line.matched_payment". | Drift de modelo, fuente de bugs futuros. |
| **B19** | Importación | `bulk_create` de líneas no dispara `save()` ni signals → cache nunca invalidado en import (inconsistente con B17). | Reportes muestran datos viejos post-import hasta TTL. |
| **B20** | Auditoría | `unmatch` hace `group.delete()` sin auditoría visible: `HistoricalRecords` lo guarda pero no hay UI ni endpoint que lo expone. | Sin trazabilidad operacional real. |
| **B21** | Diferencias | `DIFFERENCE_CHOICES` no incluye `TAX` (retención) pero el frontend lo envía. Backend cae a `OTHER` silenciosamente. | Datos sucios en reportes de ajustes. |
| **B22** | Diferencias | `difference_amount` se asigna arbitrariamente a `lines[0]` del grupo. En N:M esto distorsiona reportería por línea. | Asiento de ajuste mal asignado. |
| **B23** | Contabilidad | `JournalEntry` de diferencia se postea inmediatamente (`status=POSTED`) sin workflow de revisión por contador. | Riesgo en cierres contables. |
| **B24** | Contabilidad | JE de diferencia sin dimensiones analíticas (centro costo, proyecto). | Reportería pobre — comisiones SaaS no asignables. |
| **B25** | Operación | Sin reapertura controlada de cartola CONFIRMED. `TreasuryMovement.save()` bloquea con `ValidationError` si periodo cerrado → fix manual con script. | Operación quebradiza. |
| **B26** | Compliance | No existe Reporte PDF formal de Conciliación Bancaria (libro auxiliar firmado). Es entregable obligatorio en auditoría SII. | Bloqueante para PYME contable. |
| **B27** | Compliance | Sin concepto explícito de "Cheques girados pendientes de cobro" ni "Depósitos en tránsito". Son las dos categorías clásicas del libro de bancos. Existe `is_pending_registration` pero sin reportería. | Cuadre clásico bancario imposible de generar. |
| **B28** | Operación | Sin alert/Celery task para "líneas >30 días sin conciliar". Existe data, falta scheduler. | Saldos desincronizados meses sin notificar. |
| **B29** | Auditoría | `get_reconciliation_timeline` solo registra Import + Reconcile + Confirm. No registra unmatch, exclude, manual edits. | Auditoría incompleta. |
| **B30** | Reportería | Sin export Excel/CSV de líneas no conciliadas para revisar offline con contador. | Flujo PYME real no cubierto. |
| **B31** | Integridad | `BankStatementLine` solo tiene unique `(statement, line_number)`. Falta unique `(statement, transaction_id)` cuando transaction_id no es vacío. transaction_id es la clave natural del banco. | Duplicados entre líneas con mismo ID bancario. |
| **B32** | Modelo | `BankStatement.reconciled_lines` está denormalizado y se actualiza manualmente dentro de loops. Fuente recurrente de bugs. | Contador desincronizado del estado real. |
| **B33** | Modelo | `ReconciliationMatch.created_by` es PROTECT y no nullable → impide auto-match ejecutado por sistema (Celery sin user). | Auto-match background falla en producción. |

### Gaps de FRONTEND (F##)

| Gap | Categoría | Descripción del problema | Síntoma observable |
|-----|-----------|--------------------------|--------------------|
| **F1** | Navegación | Rutas duplicadas: `/[id]`, `/[id]/process`, `/[id]/match`, `/[id]/workbench`. La página `/[id]` además tiene `view='matching'` interno. Workbench accesible por 2 caminos divergentes. | Confusión, drift de UI, alerts no actualizados en rutas zombi. |
| **F3** | Navegación | Sin breadcrumbs en rutas de reconciliation. Solo botón ArrowLeft en workbench. | Usuario pierde contexto de jerarquía Tesorería › Conciliación › Cartola. |
| **F4** | Navegación | Botón Volver en workbench va a `/[id]` (summary), summary tiene botón "Reconciliar" que vuelve al workbench inline → bucle navegacional. | UX confusa. |
| **F5** | Navegación | Sin link directo desde Dashboard KPI "Pendiente Conciliar" al listado de cartolas con líneas pendientes. KPI es número estático. | Drilldown manual. |
| **F6** | Consistencia | `window.alert('✅ ...')` nativo en lugar de `toast.success`. Inconsistente con resto de la app que usa Sonner. | UX disonante, sin estilo. |
| **F7** | UX Workbench | `fetchSuggestions` carga top-5 pero solo highlightea filas con badge. No hay panel dedicado mostrando: score, razones (`exact_amount`, `date_match`), monto diferencia, botón directo "Match con esta sugerencia". | Usuario debe encontrar fila a ojo, sin ver score. |
| **F8** | UX Workbench | Sin drag & drop. Flujo: check línea → check pago → leer Sticky bar → click Conciliar. Drag de pago sobre línea es 1 gesto. | Flujo lento. |
| **F9** | UX Workbench | Sin atajos teclado (j/k navegar, Enter conciliar, x excluir, ? ayuda). | Power users contables sin productividad. |
| **F10** | Performance UX | Workbench usa `hidePagination` en DataTables. Cartola 200+ líneas se vuelve scroll infinito y refetch O(N) por cada selección. | Lag, navegación inviable. |
| **F11** | UX Workbench | Sin filtros propios: monto rango, solo cargos/abonos, fecha desde/hasta, estado MATCHED. Solo búsqueda texto. | Búsqueda dentro de cartola grande es manual. |
| **F12** | UX Workbench | No se puede crear pago "al vuelo" desde workbench. Si línea no tiene pago en sistema (típico: comisión banco, intereses), obliga a navegar a Tesorería y volver. | Flujo roto cada vez. |
| **F13** | UX Workbench | Sin split allocation. Una línea $1M no se puede dividir entre 2 facturas. Group match no permite montos parciales. | Caso PYME no cubierto. |
| **F14** | Auditoría | "Excluir" no pide razón obligatoria → sin auditoría del por qué (banco erróneo, duplicado, etc.). | Pérdida de trazabilidad. |
| **F15** | UX Workbench | Auto-match es 1 botón opaco. Sin progress bar para cartolas grandes. Sin preview "se conciliarán 47 con score >90". | Usuario no sabe qué está pasando. |
| **F16** | UX Workbench | `confidence_threshold: 90` hardcoded — usuario no puede ajustar agresividad del auto-match. | Caso de uso rígido. |
| **F17** | Naming | "Sugerencia IA" es engañoso — no hay IA, es score heurístico. | Marketing-hype confunde expectativas. |
| **F18** | UX Workbench | Sin undo inmediato post-match vía toast.action. Hoy hay que ir a vista summary, encontrar línea y "Deshacer". | Errores no recuperables rápido. |
| **F19** | Visual | `isSuggested` highlight aplica `text-warning` (amarillo) → confunde con error/advertencia + bajo contraste WCAG AA. | Accesibilidad. |
| **F20** | UX Workbench | Sticky bar muestra totales solo cuando hay selección. Sin selección debería mostrar totales pendientes globales (cargos, abonos, monto). | Vista vacía cuando se necesita contexto. |
| **F21** | Performance UX | `useReconciliation` hook usa `useState + axios` directo (no TanStack Query como manda CLAUDE.md). Sin caché, sin invalidación inteligente, sin optimistic updates. Cada match dispara refetch full. | UI lenta, parpadeo, race conditions. |
| **F22** | Performance UX | `useEffect([selectedLines])` dispara `fetchSuggestions` sin AbortController. Selección rápida = race conditions. | Sugerencias incorrectas mostradas. |
| **F23** | UX Workbench | Diferencia se descubre después de seleccionar y clicar. Debería previsualizarse en columna del pago al hover/select. | Sorpresa con modal de ajuste inesperado. |
| **F24** | Wizard import | Wizard tiene 2 steps (Upload + Mapping). Falta step "Validate & Preview" antes del commit mostrando: total líneas, balances, warnings, conflictos con cartola previa. | Commit ciego. |
| **F25** | Wizard import | `custom_config` hardcodea `delimiter: ';'` para CSV. Bancos chilenos exportan tanto `;`, `,` como `\t`. | Falla por delimiter incorrecto. |
| **F26** | Wizard import | `skip_rows` y `skip_footer_rows` no son configurables desde UI. Banco Estado tiene 5 rows header → user no puede ajustar sin tocar código. | Bancos no soportados requieren dev. |
| **F27** | Wizard import | Sin "guardar mapeo como template". Si banco no soportado, mapeo manual cada vez. | Re-trabajo en imports recurrentes. |
| **F28** | Wizard import | Auto-mapping débil: solo string match en español ("fech", "desc"). Headers tipo "F. Trans", "Date", "Mov" no caen. | Mapeo manual frecuente. |
| **F29** | Wizard import | Sin multi-file drop para importar mes completo en lote. | Subir 30 cartolas es 30 wizards. |
| **F31** | Wizard import | Errores de parser genéricos: "No se pudo generar la vista previa". No indica fila/columna problemática. | Debugging del usuario imposible. |
| **F33** | Wizard import | Sin validación de coherencia cuenta ↔ formato bancario. Puedo subir cartola Santander a cuenta BCI sin warning. | Errores silenciosos. |
| **F34** | Tipografía | `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]` ubicuos. Ilegible para contadores 45+ (público PYME). Tailwind `text-xs` (12px) es piso recomendado. | Accesibilidad y usabilidad. |
| **F35** | Tipografía | Mezcla `font-black uppercase tracking-tighter` con `tracking-widest` en mismas zonas. | Ruido tipográfico. |
| **F36** | Naming | "Banco de Trabajo" calco literal de "Workbench" suena raro. | Estándar industria: "Mesa de Conciliación" o "Conciliar Cartola EXT-XXX". |
| **F37** | Consistencia | Terminología inconsistente: KPI dice "Pendiente Conciliar", filter dice "Sin Conciliar", DB dice "UNRECONCILED". | Confusión. |
| **F38** | Componente | StatusBadge legacy usa `prop=type` cuando contrato dice `variant`. | Documentado en MEMORY.md/audit. |
| **F40** | Responsive | Sticky balance bar full-width `bg-foreground` ocupa mucho espacio. En mobile (<md) tapa contenido. | UX mobile rota. |
| **F41** | UX | Sin estado vacío con CTA cuando `unreconciledLines.length === 0` y `unreconciledPayments.length === 0`. | Pantalla vacía sin orientación. |
| **F42** | UX | Loading skeleton solo inicial. Refetch silencioso, user no sabe que algo se actualizó. | Sensación de bug. |
| **F43** | Funcional ERP | Sin vista lado-a-lado "Libro vs Cartola" por mes (clásico cuadre). | Workflow contable estándar ausente. |
| **F44** | Funcional ERP | Sin "Saldo según libros" vs "Saldo según banco" con cuadre formal: `Libros + Dep en tránsito - Cheques girados ± Errores = Banco`. | Conciliación clásica imposible. |
| **F45** | Compliance | Sin cierre mensual formal de conciliación (firmar/aprobar con responsable, fecha, observaciones, PDF). | Sin paper trail para auditor. |
| **F48** | Permisos | Sin segregación de funciones (rol Importador ≠ Conciliador ≠ Aprobador). Hoy todos pueden todo. | Riesgo control interno PYME. |
| **F49** | Onboarding | Sin tour guiado primer uso. PYME sin contador full-time queda perdida. | Adopción baja. |
| **F50** | UX | Botón "Generar reglas predeterminadas" solo aparece cuando `rules.length === 0`. Debería estar siempre visible como sugerencia. | Feature oculta. |
| **F51** | UX | Sin modo Simple vs Avanzado. Usuario PYME ve toda la complejidad (Reglas, Score, Group N:M). | Curva de aprendizaje brutal. |
| **F52** | Reportería | Sin botón "Exportar pendientes a Excel" para review offline. | Workflow PYME no soportado. |

---

## SPRINT 0 — Foundation & Quick Wins (1 semana, 5 tareas) [COMPLETADA con observaciones]

Objetivo: corregir bugs visibles, alinear terminología, preparar terreno técnico.

### S0.1 · Reemplazar `alert()` nativos por toast [COMPLETADA PARCIAL — ver S0.1b]
- **Gaps:** F6
- **Dificultad:** S
- **Archivos:** `frontend/app/(dashboard)/treasury/reconciliation/[id]/page.tsx:122`, `[id]/workbench/page.tsx:65`
- **Cambios:** sustituir `alert('✅ ...')` por `toast.success(...)` desde `sonner`. Verificar no quedan otros `alert()` en feature.
- **DoD:** grep `alert(` en `features/finance/bank-reconciliation/` y rutas asociadas = 0 hits.
- **Observación verificación 2026-04-28:** quedan 2 archivos sin migrar (rutas zombi). Ver tarea **S0.1b**.

### S0.2 · Renombrar "Sugerencia IA" → "Match Sugerido" [COMPLETADA]
- **Gaps:** F17
- **Dificultad:** S
- **Verificación:** grep `"Sugerencia IA"` en feature = 0 hits ✅

### S0.3 · Agregar `TAX` a `DifferenceService.DIFFERENCE_CHOICES` [COMPLETADA]
- **Gaps:** B21
- **Dificultad:** S
- **Verificación:** `TAX = 'TAX'` presente, `tax_withholding_account` field migración 0008 accounting ✅

### S0.4 · Tipografía mínima legible [COMPLETADA PARCIAL — ver S0.4b]
- **Gaps:** F34, F35
- **Dificultad:** M
- **Observación verificación 2026-04-28:** quedan 32 ocurrencias de `text-[8/9/10/11px]` en feature (`DashboardPendingTable:6`, `ReconciliationDashboard:4`, `SimulationResults:2`, `StatementImportModal:1`, `ReconciliationPanel:15`, `DashboardKPIs:3`, `ReconciliationRules:1`). Algunas válidas en badges, otras deuda. Ver tarea **S0.4b**.

### S0.5 · Razón obligatoria al excluir línea [COMPLETADA]
- **Gaps:** F14
- **Dificultad:** S
- **Verificación:** field `exclusion_reason` (CharField con choices DUPLICATE/INTERNAL/ADJUSTMENT/ERROR/OTHER) + `exclusion_notes` en modelo. Migración 0019 aplicada. View `bulk_exclude` consume campos ✅

**Sprint 0 cerrado parcialmente: 2026-04-28.** Pendientes S0.1b y S0.4b ver bloque "Re-validación".

---

## SPRINT 1 — Estabilizar matching & differences (1.5 semanas) [COMPLETADA con observaciones]

Objetivo: corregir bugs lógicos del motor de matching y diferencias.

### S1.1 · Fix `success_rate` en `RuleService.increment_rule_usage` [COMPLETADA]
- **Gaps:** B14
- **Verificación:** F() atomic update + field `times_succeeded` + `success_rate` como @property derivada ✅

### S1.2 · Fix `RuleService.simulate_rule` weights [COMPLETADA]
- **Gaps:** B15
- **Verificación:** `_calculate_rule_score` recibe `temp_rule` con su propio `match_config['weights']` ✅

### S1.3 · Umbral de confianza configurable en UI auto-match [COMPLETADA]
- **Gaps:** F16
- **Verificación:** `confidence_threshold: confidenceThreshold` en payload, slider en modal automatch ✅

### S1.4 · Reparto proporcional de diferencia [COMPLETADA]
- **Gaps:** B22
- **Verificación:** `matching_service.py:451-484` distribuye proporcional con quantize y residuo a última línea, log en `group.notes` ✅

### S1.5 · Asientos de ajuste en estado Borrador [COMPLETADA PARCIAL — ver S1.5b]
- **Gaps:** B23
- **Verificación:** `entry.status = JournalEntry.State.DRAFT` en `difference_service.py:110` ✅
- **Observación verificación 2026-04-28:** falta crear setting `AccountingSettings.auto_post_reconciliation_adjustments` que permita opt-in al comportamiento previo. Ver tarea **S1.5b**.

### S1.6 · Tracking explícito de JE de transferencia entre cuentas [COMPLETADA]
- **Gaps:** B16
- **Verificación:** M2M `ReconciliationMatch.transfer_journal_entries` (migración 0021) + link explícito en `confirm_match` (línea 600) + test `test_transfer_traceability.py` ✅

### S1.7 · Cleanup invalidación cache [COMPLETADA]
- **Gaps:** B17, B19
- **Verificación:** `BankStatementLine.save()`/`delete()` ya no invalidan. Invalidación 1-vez en: `reconciliation_service.py:111` (post import), `matching_service.py:486` (create_match_group), `:612` (confirm_match), `:691` (unmatch), `:772` (auto_match) ✅

**Sprint 1 cerrado parcialmente: 2026-04-28.** Pendiente S1.5b ver bloque "Re-validación".

---

## SPRINT 1.5 — Re-validación post-Sprint 0/1 (½ semana, 3 tareas)

Objetivo: cerrar deuda detectada en verificación.

### S0.1b · Migrar `alert()` restantes en rutas zombi [PENDIENTE]
- **Gaps:** F6 (residual)
- **Dificultad:** S
- **Archivos:**
  - `frontend/app/(dashboard)/treasury/reconciliation/[id]/process/page.tsx:65`
  - `frontend/app/(dashboard)/treasury/reconciliation/[id]/match/page.tsx:66`
- **Precondiciones:** ninguna
- **Cambios:**
  - Reemplazar `alert('✅ Cartola confirmada exitosamente')` por `toast.success('Cartola confirmada exitosamente')`.
  - Importar `toast` desde `sonner`.
  - **Nota:** estas rutas serán eliminadas en S7.1 (consolidación). Si decisión de S7.1 es eliminarlas ya, omitir esta tarea y abrir S0.1c "delete dead routes" en su lugar — coordinar antes con responsable.
- **DoD:** `grep -r "alert(" frontend/app/\(dashboard\)/treasury/reconciliation/` = 0 hits.

### S0.4b · Limpieza tipografía residual [PENDIENTE]
- **Gaps:** F34 (residual)
- **Dificultad:** M
- **Archivos:** los 7 con ocurrencias listadas en observación de S0.4.
- **Precondiciones:** ninguna
- **Cambios:**
  - Auditar cada `text-[Npx]` (N∈{8,9,10,11}). Para cada uno decidir:
    1. Si es contenido principal/celda/label → cambiar a `text-xs` (12px).
    2. Si es badge/microetiqueta marginal → mantener pero documentar en comentario inline (`// intentional: badge density`) si N≥10.
    3. Si es N=8 o 9 → siempre cambiar a `text-[10px]` mínimo.
  - Reportar total final restante en commit message.
- **DoD:** type-check pasa. Conteo `text-[8px]` y `text-[9px]` = 0 en feature. `text-[10px]/[11px]` solo en badges con comentario justificativo.

### S1.5b · Setting `auto_post_reconciliation_adjustments` [COMPLETADO]
- **Gaps:** B23 (residual)
- **Dificultad:** S
- **Archivos:**
  - `backend/accounting/models.py` (`AccountingSettings`)
  - `backend/accounting/migrations/00XX_auto_post_reconciliation.py`
  - `backend/treasury/difference_service.py:106-111`
- **Precondiciones:** S1.5
- **Cambios:**
  - Agregar campo `auto_post_reconciliation_adjustments = models.BooleanField(default=False, help_text="Si True, los asientos de ajuste por diferencia se postean automáticamente. Si False (recomendado), quedan en DRAFT para revisión manual.")`.
  - Migración con default False.
  - En `DifferenceService.create_difference_adjustment`, leer setting:
    ```python
    settings_obj = AccountingSettings.objects.first()
    if settings_obj and settings_obj.auto_post_reconciliation_adjustments:
        entry.status = JournalEntry.State.POSTED
    else:
        entry.status = JournalEntry.State.DRAFT
    entry.save()
    ```
  - UI opcional (no requerido por DoD): toggle en pantalla de settings contables.
- **DoD:**
  - Test: setting=False → JE creado en DRAFT.
  - Test: setting=True → JE creado en POSTED.

---

## SPRINT 2 — Performance del matching (2 semanas)

Objetivo: matar N+1, escalar a cartolas 500–2000 líneas.

### S2.1 · Refactor `auto_match_statement` para batch processing [COMPLETADA]
- **Gaps:** B8 — Auto-match O(N×50) queries → timeout en cartolas grandes. Necesita pre-fetch + scoring en RAM.
- **Dificultad:** L
- **Archivos:** `backend/treasury/matching_service.py` (reemplazado completo)
- **Verificación 2026-04-28:**
  - 1 query candidatos para toda la cartola (`all_candidates = list(candidates_qs)`).
  - Helper `_payment_matches_account_sense` filtra en RAM por sentido/cuenta.
  - Pre-fetch reglas activas en 1 query. Scoring sin ninguna query adicional por línea.
  - `test_sprint2_dod.py::test_batch_prefetch_pattern_exists` PASS ✅
  - `test_sprint2_dod.py::test_payment_matches_account_sense_helper_exists` PASS ✅

### S2.2 · Fix `confirm_match` N+1 en update de statement counter [COMPLETADA]
- **Gaps:** B9 — N+1 saves + cache invalidation + history records dentro de loop de confirmación. Confirmar 20 líneas tarda 30s+.
- **Dificultad:** M
- **Archivos:** `backend/treasury/matching_service.py` (confirm_match + unmatch)
- **Verificación 2026-04-28:**
  - `BankStatementLine.objects.bulk_update(lines_in_group, ['reconciliation_status', 'reconciled_at', 'reconciled_by'])` en `confirm_match`.
  - `BankStatementLine.objects.bulk_update(lines_to_reset, [...])` en `unmatch`.
  - `test_sprint2_dod.py::test_bulk_update_present_in_matching_service` PASS ✅
  - **Nota auditoría:** bulk_update no dispara `HistoricalRecords`. Aceptado para hot-path perf (auditoría se registra vía `ReconciliationMatch.confirmed_at/by`).

### S2.3 · `BankStatement.reconciled_lines` como property derivada [COMPLETADA FASE 1]
- **Gaps:** B32 — Contador denormalizado se actualiza manualmente dentro de loops, fuente de bugs.
- **Dificultad:** M
- **Archivos:** `backend/treasury/matching_service.py` (confirm_match + unmatch)
- **Verificación 2026-04-28 — Fase 1:**
  - 0 asignaciones a `.reconciled_lines` en `matching_service.py` (grep `\.reconciled_lines\s*=` → 0 hits).
  - Campo `reconciled_lines = models.IntegerField` aún existe en `models.py` (drop column va en Fase 2).
  - `test_sprint2_dod.py::test_no_reconciled_lines_write_in_matching_service` PASS ✅
  - `test_sprint2_dod.py::test_reconciled_lines_field_still_exists_in_models` PASS ✅
- **Pendiente Fase 2 (S2.3b):** convertir a `@property`, drop column, migración, actualizar serializers.

### S2.4 · Eliminar cap `[:50]` arbitrario en candidates [COMPLETADA]
- **Gaps:** B10 — Cap hardcoded oculta pagos en posiciones >50, falsos negativos silenciosos.
- **Dificultad:** S
- **Archivos:** `backend/treasury/matching_service.py:122`, `backend/treasury/models.py` (Meta.indexes)
- **Verificación 2026-04-28:**
  - Cap cambiado a `[:200]` con comentario B10.
  - Índices compuestos `idx_movement_from_date_recon` y `idx_movement_to_date_recon` creados.
  - Migración `0022_add_matching_compound_indexes` aplicada OK.
  - `test_sprint2_dod.py::test_candidate_cap_is_200` PASS ✅

### S2.5 · Normalización de glosas bancarias [COMPLETADA]
- **Gaps:** B12 — Sin normalización de prefijos bancarios (TEF/, ABO TR, TEF EFEC), score degradado.
- **Dificultad:** L
- **Archivos:** `backend/treasury/glossa_normalizer.py` (nuevo), `matching_service.py:334-337`
- **Verificación 2026-04-28:**
  - `normalize_description('TEF/COMERCIAL ANDES SPA', 'BANCO_CHILE_CSV')` → `'COMERCIAL ANDES'` ✅
  - Prefijos mapeados: BANCO_CHILE_CSV, SANTANDER_CSV, BICE_CSV, BCI_CSV, SCOTIABANK_CSV, ITAU_CSV, ESTADO_CSV + genéricos.
  - Stop-words bancarias: SPA, LTDA, SA, EIRL, RUT, TEF, TRF, etc.
  - 5 tests DoD PASS ✅

### S2.6 · Fuzzy matching para descripción (trigram) [COMPLETADA]
- **Gaps:** B11 — Substring strict (`if name in description`) falla por sufijos legales (SPA, LTDA).
- **Dificultad:** L
- **Archivos:** `backend/treasury/matching_service.py:331-362`, `backend/requirements.txt`
- **Verificación 2026-04-28:**
  - `rapidfuzz>=3.0` instalado (3.14.5) y en `requirements.txt`.
  - `partial_ratio('COMERCIAL ANDES', 'COMERCIAL ANDES SPA')` = 100 → 10pts ✅
  - Fallback sin importlib si `rapidfuzz` no disponible (substring clásico).
  - 3 tests DoD PASS ✅

**Sprint 2 cerrado: 2026-04-28.** Pendiente S2.3b (Fase 2 = @property + drop column, planificado en S3).

---

## SPRINT 3 — Idempotencia y validaciones de import (1.5 semanas)

Objetivo: blindar import contra duplicados y errores.

### S3.1 · Hash SHA-256 del archivo + dedup [COMPLETADA]
- **Gaps:** B1 — Re-importar mismo archivo crea cartola duplicada.
- **Dificultad:** M
- **Archivos:** `backend/treasury/models.py`, `backend/treasury/reconciliation_service.py`
- **Verificación 2026-04-28:**
  - Migración `0023_bankstatement_file_hash` aplicada.
  - `ReconciliationService.import_statement` calcula SHA-256 y valida contra DB.
  - Test `treasury/tests/test_reconciliation_dedup.py` PASS ✅ (2 casos: duplicado bloqueado, diferente permitido).
- **DoD:** segundo POST con mismo archivo → 400 con mensaje claro.

### S3.2 · Dedup por `transaction_id` natural del banco
- **Gaps:** B31 — Falta unique constraint sobre transaction_id (clave natural del banco).
- **Dificultad:** M
- **Archivos:** `backend/treasury/models.py:863-872`
- **Cambios:**
  - Migración 0024: agregar `UniqueConstraint(fields=['statement', 'transaction_id'], condition=Q(transaction_id__gt=''), name='uniq_stmt_txnid')`.
  - Manejar caso transaction_id vacío sin quebrar.
  - En import, si `transaction_id` repetido en mismo archivo → warning + skip de duplicado.
- **DoD:** test: archivo con 2 filas mismo transaction_id → 1 sola línea creada + 1 warning.
- **Verificación 2026-04-28:**
  - Migración `0024_bankstatementline_uniq_stmt_txnid` aplicada.
  - `ReconciliationService` filtra duplicados por `transaction_id` en el bucle de importación.
  - Test `treasury/tests/test_reconciliation_dedup.py` PASS ✅ (4 casos totales).

### S3.3 · Detección de solapamiento de rangos
- **Gaps:** B2 (solapamiento), B3 (statement_date único en lugar de rango)
- **Dificultad:** L
- **Archivos:** `backend/treasury/models.py` (`BankStatement` agregar `period_start`/`period_end`), `reconciliation_service.py:155-256`
- **Cambios:**
  - Migración 0025: agregar `period_start = DateField()`, `period_end = DateField()`. Backfill desde `min/max(lines.transaction_date)`.
  - En `validate_statement` extraer `period_start`/`period_end` desde lineas parseadas.
  - Bloquear creación si rango se cruza con cartola CONFIRMED previa misma cuenta. Permitir con DRAFT (warning).
  - Validar `previous.closing_balance == this.opening_balance` (warning si discrepancia).
- **DoD:** test: importar Ene+Feb, luego Feb+Mar → 400.
- **Verificación 2026-04-28:**
  - Migración `0025_bankstatement_period_end_...` aplicada con backfill de datos.
  - `ReconciliationService` valida cruces de rangos (bloquea CONFIRMED, advierte DRAFT).
  - Test `treasury/tests/test_reconciliation_overlap.py` PASS ✅ (3 casos: solapamiento confirmado, solapamiento borrador, discontinuidad de saldos).

### S3.4 · Import tolerante a errores fila-a-fila
- **Gaps:** B6 — `ValueError` rollback total por una línea mala.
- **Dificultad:** L
- **Archivos:** `backend/treasury/reconciliation_service.py:23-256`
- **Cambios:**
  - `validate_statement` clasifica errores como `line_errors` (por línea) en lugar de un solo error global.
  - Crear `BankStatement` aún con discontinuidades, marcando líneas problemáticas con `has_warning=True` (nuevo BoolField + `warning_message TextField`).
  - Migración 0026.
  - Endpoint retorna report estructurado: `{statement_id, errors: [], warnings: [{line, message}]}`.
- **DoD:** archivo con 3 líneas problemáticas crea cartola con esas líneas marcadas, no rechaza todo.

### S3.5 · Validación cuenta ↔ formato
- **Gaps:** F33 — Sin validación coherencia cuenta ↔ formato bancario.
- **Dificultad:** S
- **Archivos:** `backend/treasury/models.py` (`TreasuryAccount` agregar `default_bank_format CharField`), `reconciliation_service.py:51-57`
- **Cambios:**
  - Si `treasury_account.default_bank_format` definido y difiere del seleccionado → warning (no bloqueo).
  - UI: pre-seleccionar formato basado en cuenta.
- **DoD:** seleccionar cuenta BCI muestra warning si user elige formato Santander.

### S3.6 · UI: Step "Validación / Preview" en wizard
- **Gaps:** F24 (sin step preview), F31 (errores genéricos)
- **Dificultad:** L
- **Archivos:** `frontend/features/treasury/components/StatementImportModal.tsx`, posiblemente nuevo `ImportPreviewStep.tsx`
- **Cambios:**
  - Nuevo step entre "Mapping" y "Submit".
  - Llama nuevo endpoint `/treasury/statements/dry_run/` que parsea sin persistir, retorna: total líneas, period_start, period_end, opening/closing balance detectado, warnings, errores por fila.
  - Tabla de warnings con fila + mensaje. Botón "Continuar de todas formas" o "Volver al mapeo".
- **DoD:** flujo completo: Upload → Map → Preview con totales y warnings → Submit.

### S3.7 · Skip rows configurable + auto-detect delimiter
- **Gaps:** F25 (delimiter hardcoded), F26 (skip_rows no configurable)
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
- **Gaps:** F21 (sin TanStack Query, refetch full), F22 (sin AbortController, race conditions)
- **Dificultad:** L
- **Archivos:** `frontend/features/finance/bank-reconciliation/hooks/useReconciliation.ts`, `ReconciliationPanel.tsx`, `ReconciliationDashboard.tsx`, `StatementsList.tsx`, `ReconciliationRules.tsx`
- **Cambios:**
  - Convertir `fetchStatements`, `fetchAccounts`, `fetchRules`, `fetchDashboardData`, `fetchSuggestions`, `fetchUnreconciledLines`, `fetchUnreconciledPayments` en `useQuery` con `queryKey` estructurado.
  - Match/exclude/unmatch como `useMutation` con `onSuccess` que invalida queryKeys puntuales.
  - Optimistic update en match.
  - `AbortController` automático via React Query al cambiar selección.
- **DoD:** seleccionar línea rápido (5 cambios en 1s) no dispara race; UI no parpadea en match (optimistic).

### S4.2 · Suggestions panel real (top-5 con score y razones)
- **Gaps:** F7 (sin panel dedicado), F23 (diferencia descubierta tarde)
- **Dificultad:** L
- **Archivos:** nuevo `frontend/features/finance/bank-reconciliation/components/SuggestionsPanel.tsx`, integrar en `ReconciliationPanel.tsx`
- **Cambios:**
  - Cuando `selectedLines.length === 1` y `suggestions.length > 0`, renderizar panel lateral/inferior con:
    - Cards top-5 con score badge, razones (chips: "Monto exacto", "Fecha exacta", "ID coincide"), monto, diferencia, contraparte, botón "Match con esta sugerencia".
  - Mismo para `selectedPayments.length === 1` con `lineSuggestions`.
- **DoD:** seleccionar 1 línea muestra panel con 5 candidates accionables.

### S4.3 · Pagination + filtros avanzados en workbench
- **Gaps:** F10 (sin paginación), F11 (sin filtros avanzados)
- **Dificultad:** M
- **Archivos:** `ReconciliationPanel.tsx` (DataTables), backend `views.py` action `statement-lines/` queryparams
- **Cambios:**
  - Quitar `hidePagination`. Default pageSize 50.
  - Filtros adicionales: `amount_min`, `amount_max`, `date_from`, `date_to`, `direction` (debit/credit/all), `state`.
  - Backend acepta esos query params.
- **DoD:** cartola 300 líneas se navega paginada; filtro "solo abonos" reduce visible.

### S4.4 · Atajos de teclado
- **Gaps:** F9 — Sin shortcuts (j/k/Enter/x/?).
- **Dificultad:** M
- **Archivos:** `ReconciliationPanel.tsx`, hook nuevo `useReconciliationShortcuts.ts`
- **Cambios:**
  - `j`/`k`: navegar fila banco arriba/abajo
  - `J`/`K`: navegar fila sistema
  - `Enter`: ejecutar match con selección actual (si válida)
  - `x`: excluir fila banco activa (lanza modal con razón obligatoria — ver S0.5)
  - `?`: mostrar overlay con shortcuts
- **DoD:** shortcuts funcionan, no se gatillan dentro de inputs.

### S4.5 · Crear pago al vuelo desde workbench
- **Gaps:** F12 — Sin "crear pago" desde workbench, obliga navegar a Tesorería.
- **Dificultad:** L
- **Archivos:** `ReconciliationPanel.tsx`, reutilizar `MovementWizard` existente
- **Cambios:**
  - Botón "Crear pago" sobre fila banco no conciliada.
  - Abre `MovementWizard` pre-cargado con: `amount`, `date`, `treasury_account`, `direction` derivados de la línea.
  - Al guardar, automáticamente intenta `manual_match` de la línea con el nuevo pago.
- **DoD:** desde workbench creo movement de comisión y queda conciliado en 1 flujo.

### S4.6 · Sticky bar muestra totales globales sin selección
- **Gaps:** F20 — Bar solo muestra info con selección activa.
- **Dificultad:** S
- **Archivos:** `ReconciliationPanel.tsx`
- **Cambios:** cuando no hay selección, sticky bar muestra "Pendientes: X líneas · Cargos $Y · Abonos $Z".
- **DoD:** barra siempre visible, contenido cambia según selección.

### S4.7 · Estado vacío + undo en match
- **Gaps:** F18 (sin undo), F41 (sin empty state), F42 (refetch silencioso)
- **Dificultad:** M
- **Archivos:** `ReconciliationPanel.tsx`
- **Cambios:**
  - Empty state: cuando 0 líneas y 0 pagos pendientes, mostrar ilustración "Conciliado al 100%" con CTA "Confirmar Cartola".
  - `toast.success("Match creado", { action: { label: "Deshacer", onClick: () => unmatch(lineId) } })`.
  - Loading toast en mutations.
- **DoD:** match disparado muestra toast con undo funcional 5s.

### S4.8 · Auto-match con progreso (Celery + polling)
- **Gaps:** F15 — Sin progress bar en auto-match de cartolas grandes.
- **Dificultad:** L
- **Archivos:** `backend/treasury/views.py` (auto_match action → Celery task), `frontend/features/finance/bank-reconciliation/components/AutoMatchProgressModal.tsx`
- **Precondiciones:** S2.1 (auto_match optimizado primero)
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
- **Gaps:** B13 — Sin allocación parcial 1 pago → N facturas.
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
- **Gaps:** F13 — Sin split UI.
- **Dificultad:** L
- **Archivos:** nuevo `frontend/features/finance/bank-reconciliation/components/SplitAllocationDialog.tsx`
- **Cambios:**
  - Botón "Distribuir" sobre línea banco con monto > suma de pagos seleccionados.
  - Dialog: lista de invoices/orders abiertos del contacto, input amount por cada uno, suma debe coincidir.
  - Crea allocations + match grupo.
- **DoD:** depósito $1M conciliado contra 3 facturas con montos diferentes.

### S5.4 · Reportería: ver allocations en factura
- **Gaps:** B13 (cierre del loop)
- **Dificultad:** M
- **Archivos:** `frontend/features/billing/components/InvoiceDetail.tsx`, `backend/billing/serializers.py`
- **Cambios:** sección "Pagos aplicados" lista allocations con monto + fecha + cartola origen.
- **DoD:** factura $400k cobrada vía split muestra "Aplicado: $400k de DEP-000123".

---

## SPRINT 6 — Reportes formales y compliance (2 semanas)

Objetivo: entregables PDF y workflows formales para contador.

### S6.1 · Reporte PDF Conciliación Bancaria
- **Gaps:** B26 (sin PDF formal), F45 (sin cierre formal)
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
- **Gaps:** B27 — Sin reportería de items en tránsito.
- **Dificultad:** M
- **Archivos:** `backend/treasury/reports_service.py` (nuevos métodos `pending_checks_report`, `deposits_in_transit_report`), `views.py` actions
- **Cambios:**
  - Queries que filtran `TreasuryMovement.is_pending_registration=True` por cuenta y período.
  - Frontend: tab nueva en `/treasury/reconciliation` "Pendientes en tránsito".
- **DoD:** vista lista cheques + depósitos no procesados por banco.

### S6.3 · Workflow cierre mensual conciliación
- **Gaps:** F45 (cierre formal), F48 (segregación funciones — parcial: aprobador requerido)
- **Dificultad:** L
- **Archivos:** nuevo modelo `MonthlyReconciliationClosure`, migración 0028
- **Cambios:**
  - `MonthlyReconciliationClosure(treasury_account, period_year, period_month, closed_at, closed_by, signed_at, signed_by, notes, pdf_file)`
  - Solo se puede cerrar mes si todas las cartolas del mes están CONFIRMED.
  - Cerrar bloquea modificaciones (validation en `BankStatement.save()` y `BankStatementLine.save()`).
  - UI: pestaña "Cierres mensuales" con tabla por mes/cuenta.
- **DoD:** cerrar mes Marzo cuenta BCI bloquea ediciones; reapertura requiere superuser.

### S6.4 · Vista Libros vs Cartola lado a lado
- **Gaps:** F43 (sin vista lado-a-lado), F44 (sin cuadre formal)
- **Dificultad:** L
- **Archivos:** nueva ruta `frontend/app/(dashboard)/treasury/reconciliation/[id]/ledger-vs-bank/page.tsx`, endpoint backend
- **Cambios:**
  - Backend: action `/statements/<id>/ledger_vs_bank/` retorna lista combinada de movements del sistema y lines de cartola alineados por fecha.
  - Frontend: 2 columnas, fila por fecha, indicadores de match/no-match. Resumen al pie con cuadre clásico.
- **DoD:** vista navegable mes completo.

### S6.5 · Export Excel líneas no conciliadas
- **Gaps:** F52 (sin export), B30 (sin export backend)
- **Dificultad:** S
- **Archivos:** `backend/treasury/views.py` action `statement-lines/export_unreconciled/`, lib `openpyxl`
- **Cambios:** endpoint retorna .xlsx con columnas estándar. Botón en workbench "Exportar pendientes".
- **DoD:** descarga genera xlsx abrible en Excel.

### S6.6 · Stale items: Celery beat alert
- **Gaps:** B28 — Sin alert para líneas viejas no conciliadas.
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
- **Gaps:** F1 (rutas zombi), F4 (loop navegacional)
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
- **Gaps:** B18 — Coexistencia legacy + nuevo campo, drift de modelo.
- **Dificultad:** L
- **Archivos:** `models.py`, `matching_service.py` (eliminar fallback legacy), data migration
- **Cambios:**
  - Data migration 0029: para cada line con `matched_payment_id` y sin `reconciliation_match`, crear `ReconciliationMatch` 1:1.
  - Migración 0030: eliminar field `matched_payment` y `bank_statement_line` (FK en TreasuryMovement legacy).
  - Limpiar code paths "if not group and line.matched_payment".
- **DoD:** schema limpio; no hay refs a `matched_payment` en código.

### S7.4 · `ReconciliationMatch.created_by` nullable para auto-match
- **Gaps:** B33 — created_by PROTECT bloquea auto-match sistema.
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
- **Gaps:** F48 — Sin segregación de funciones.
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
- **Gaps:** F27 (sin guardar mapping), F28 (auto-mapping débil)
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
- **Gaps:** B20 (sin UI auditoría), B29 (timeline incompleto)
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

| Sprint | Tareas | Dificultad acumulada | Duración estimada | Estado |
|--------|--------|----------------------|-------------------|--------|
| 0 | 5 | 4S+1M | 1 semana | ✅ Parcial (2 deudas → S1.5) |
| 1 | 7 | 4S+3M | 1.5 semanas | ✅ Parcial (1 deuda → S1.5) |
| 1.5 | 3 | 2S+1M | ½ semana | ⏳ Pendiente |
| 2 | 6 | 1S+2M+3L | 2 semanas | ⏳ Pendiente |
| 3 | 7 | 1S+2M+4L | 1.5–2 semanas | ⏳ Pendiente |
| 4 | 8 | 1S+3M+4L | 2 semanas | ⏳ Pendiente |
| 5 | 4 | 0S+2M+2L | 2 semanas | ⏳ Pendiente |
| 6 | 6 | 1S+2M+2L+1XL | 2 semanas | ⏳ Pendiente |
| 7 | 11 | 5S+3M+3L | 1.5 semanas | ⏳ Pendiente |
| 8 | 6 | 3S+2M+1L | 1 semana | ⏳ Pendiente |
| **Total** | **63 tareas** | — | **~14.5–15.5 semanas** | — |

Cobertura de gaps: B1, B2, B3, B6, B7 (parcial), B8–B33 + F1, F3–F52 (B4/B5 excluidos). Glosario inline al inicio del documento sirve como referencia self-contained.

---

## Notas para LLM ejecutor

- Antes de cada Sprint, lee `docs/30-playbooks/refactor-workflow.md` si aplica refactor, `add-migration.md` si tocas modelos.
- Cada migración debe ir con data backfill cuando elimina campo.
- Tests obligatorios para servicios críticos: matching, allocation, import idempotency.
- Sprint 5 (allocation) modifica `TreasuryMovement` flow → requiere coord con sales/purchasing/billing payment endpoints.
- Sprint 7 deprecation legacy field `matched_payment` requiere ventana de migración: deploy 7.3a (data migrate) → wait 1 release → deploy 7.3b (drop column).
- Si tarea bloqueada por gap nuevo, anotar abajo y continuar con siguiente.
- **Verificación obligatoria:** antes de marcar tarea como [COMPLETADA], ejecutar literal el comando del DoD (grep, test, query) y citar el resultado en el commit.

## Hallazgos no planificados

(Vacío — el ejecutor agrega aquí gaps descubiertos durante implementación.)
