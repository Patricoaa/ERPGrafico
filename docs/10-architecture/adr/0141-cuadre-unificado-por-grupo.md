---
id: 0141
title: El cuadre es un solo registro por grupo (documento ERP, pagos TUU, registros RCV) que el motor resuelve cada 10 minutos, sin vínculos por pares ni recálculo manual
status: Accepted
date: 2026-11-17
author: backend-team
---

# 0141 — Cuadre unificado por grupo

**Relacionado:** ADR-0138 (enmienda D4–D6), ADR-0139 (enmienda D1–D3), ADR-0140 (enmienda D4–D5), ADR-0091, ADR-0116, ADR-0118. Spec: `docs/superpowers/specs/2026-11-17-cuadre-unificado-design.md`.

## Contexto

El control de que el SII (RCV), TUU y el ERP digan lo mismo estaba repartido: vínculos por pares en dos modelos (`TerminalSale.matched_invoice`, `RCVDocument.matched_invoice`, `TerminalSale.rcv_document`), tres servicios que se pisaban (`reconcile_terminal_sales`, `reconcile_rcv_boletas`, `reconcile_rcv_period`), unión manual en dos fichas, una página por mes con botones «Recalcular RCV / TUU» y varios nombres para lo mismo («Cuadre», «Cuadre fiscal», `reconciliation`).

Además, la parte TUU comparaba el monto de la venta contra el total del documento, lo que falla en el pago mixto y en varios pagos con tarjeta; y cada corrida limpiaba y recalculaba el rango completo.

## Decisión

### D1. Un modelo por grupo: `tax.FiscalMatch`

Un grupo es un documento ERP (0..1, `invoice` único) con sus ventas TUU (`TerminalSale.fiscal_match`, 0..N) y sus registros RCV (`RCVDocument.fiscal_match`, 0..N), o un grupo huérfano con registros externos esperando su documento. Guarda el estado del grupo y de cada parte, y los montos denormalizados para filtrar y paginar sin joins. Se eliminan `matched_invoice`, `match_status`, `matched_manually`, `rcv_document` y `issue_*` de `TerminalSale`/`RCVDocument`; `Invoice` sigue siendo la única fuente contable (ADR-0138 D1). Enmienda ADR-0138 D4–D6.

### D2. Estados de parte y de grupo

`core/fiscal_match.py` define `PartState` (`MATCHED`, `PENDING`, `MISSING`, `DIFF`, `AMBIGUOUS`, `NOT_APPLICABLE`, `SUMMARY_ONLY`) y `FiscalMatchStatus` (`EXCLUDED`, `AMBIGUOUS`, `DIFF`, `MISSING_ERP`, `MISSING_EXTERNAL`, `PENDING`, `MATCHED`, derivado por esa prioridad). Desaparecen `MatchStatus` y `PENDING_ERP`. Ante duda el resultado es `AMBIGUOUS`, nunca un vínculo.

### D3. Cuadre de TUU por pago

Cada venta TUU se cruza con un `TreasuryMovement` del documento (`TerminalSale.matched_movement`, único), no contra el total. La parte TUU es `MATCHED` cuando todos los movimientos que esperan TUU tienen su venta. Una diferencia de tipo de documento es `DIFF`. Una factura pagada sin terminal tiene TUU `NOT_APPLICABLE`. Enmienda ADR-0139 D1–D2.

### D4. Cuántos registros por parte, y qué espera la caja

- **RCV 0..N por grupo** (FK desde `RCVDocument`): no se sabe si TUU emite una boleta por venta o una por la venta completa. La parte RCV de una boleta cuadra si la suma de sus registros iguala el total del ERP o la suma de sus ventas TUU; otro monto es `DIFF`. Con varios folios la boleta no se emite sola: la parte ERP queda `PENDING` con aviso «varios folios en el SII».
- Los pagos con medio integrado esperan una venta TUU en cualquier documento de venta; los pagos en efectivo en una sesión POS con terminal TUU la esperan solo en boletas 39/41. Sin pagos que esperen TUU, la parte es `NOT_APPLICABLE`.
- **Una venta TUU en efectivo solo respalda el cobro en efectivo de una boleta 39/41**: nunca se une sola al cobro en efectivo de una factura (que no deja registro TUU). Si una venta de otro tipo queda en el grupo (p. ej. unida a mano), la parte TUU es `DIFF` aunque ningún pago espere TUU: la revisión de tipo va antes de `NOT_APPLICABLE`.
- **Una venta TUU no completada (anulada) no respalda su cobro**: no suma al monto TUU ni cuenta en la revisión de tipo. El motor la saca del grupo de su documento a un huérfano propio (sin cobro ni marca manual), que se evalúa `EXCLUDED`; el documento vuelve a esperar su venta. La unión manual rechaza ventas no completadas.

### D5. Motor sin meses: `run_fiscal_match`

Reemplaza `tax/reconciliation/` por `tax/fiscal_match/` con un único punto de entrada idempotente: asegurar grupos → ERP ↔ TUU por pago → TUU ↔ RCV boletas (día + monto, en orden; por folio directo si ya está emitida) → ERP ↔ RCV por `fiscal_key` (facturas y notas, ahora también en la tarea periódica) → emisión de borradores → derivar estados con `bulk_update`. Ventanas: `SCAN_DAYS = 62` días hacia atrás desde hoy, acotado por `fiscal_match_start_date`. Enmienda ADR-0140 D4: la tarea `tax.tasks.run_fiscal_match` corre cada 10 min (beat `run_fiscal_match_10min`) y se encola al terminar cada `TerminalSyncRun` y cada `RCVImport` exitosa. Los botones «Recalcular» y las rutas `terminal/run` y `rcv/run` se eliminan. La marca de la última corrida se guarda en BD (`last_run_at`).

### D6. Reglas de re-evaluación

- Se evalúan todos los grupos fuera de `MATCHED`/`EXCLUDED` y los registros nuevos o modificados desde la última corrida buena.
- La marca de cambio es la última corrida terminada **con `error=""`**: una corrida fallida no avanza la marca, para no saltarse cambios.
- Los grupos `MATCHED` con ventas automáticas cuyo pago cae en el rango de la última sincronización TUU, y los grupos `AMBIGUOUS` con ventas automáticas, se re-cruzan: una venta rival tardía los reabre como `AMBIGUOUS`. Una venta ya emitida (48 con el id TUU) queda congelada: el grupo pasa a `AMBIGUOUS` con `closed_period_alert`, pero el vínculo no se borra.
- Los períodos cerrados se recalculan igual; si un grupo deja de estar cuadrado, guarda `closed_period_alert` y la página lo destaca.
- Un vínculo manual (`linked_manually` / `rcv_linked_manually`) no se toca salvo que su documento se anule o desaparezca.

### D7. Unión manual desde la ficha del grupo

`FiscalMatchDrawer` (`tax.fiscalmatch`) concentra vincular documento ERP, agregar pago TUU (eligiendo el movimiento), vincular registro RCV, quitar, devolver al cruce automático y reintentar emisión. Quitar deja el registro en un grupo huérfano marcado como manual. En un huérfano con venta TUU los documentos candidatos salen de la venta (día, cobro libre del monto); con solo una boleta RCV 39/41, son las boletas del ERP (emitidas o borradores sin folio) del mismo día y monto. Las boletas llevan en el SII un RUT genérico: la unión no exige el RUT en 39/41, solo en facturas y notas. Si la ficha pasa al grupo resultante (el abierto se borró), la página actualiza `selected`; un grupo que ya no existe (404) se explica como tal. Los servicios manuales toman el mismo candado de caché del motor y responden **409** si está ocupado (fallan rápido, sin esperar), y mutan bajo `@transaction.atomic`.

### D8. Idempotencia

Nuevos scopes de `Idempotency-Key`: `tax.fiscal_match.link`, `.unlink`, `.release`, `.retry_issue`, `.confirm_draft`, `.create_draft` (documentados en `docs/20-contracts/idempotency.md`).

### D9. Emisión automática por documento

La emisión de borradores (ADR-0140 D3) se conserva, ahora leyendo el grupo y escribiendo `issue_attempted_at`/`issue_error` en él. Exige la parte TUU `MATCHED` y, en boletas 39/41, también la RCV `MATCHED`: la boleta toma el folio de su registro RCV, y emitir con un registro de otro monto (o ambiguo o pendiente) fijaría un folio equivocado de forma irreversible (ADR-0091). Emite **por documento**, con una transacción por borrador: es una excepción acotada a ADR-0118 (la emisión asigna folio y publica el asiento; no se puede agrupar), no una lista que consulte por fila.

### D10. Conteo del F29 (sin resumen mensual ni pendientes de folio)

El resumen mensual 39/41/48 (con el **48 esperado** = comprobantes 48 del ERP + pagos TUU con tarjeta de facturas 33/34) y la lista de borradores pendientes de folio se **retiraron por decisión del usuario (2026-11-18)**: no tenían consumidor en la UI. Los endpoints `fiscal-matches/summary/` y `fiscal-matches/pending-issue/`, sus funciones y sus hooks ya no existen. Se mantiene `fiscal_mismatch_counts`: la compuerta F29 `fiscal_mismatches` sigue en **Sugeridos** (no bloquea) con claves nuevas: `DIFF`, `AMBIGUOUS`, `MISSING_ERP`, `MISSING_EXTERNAL` del `fiscal_period`; `status_check`, el wizard F29 y el checklist de cierre se actualizaron. Su enlace «Ir al cuadre» abre ambas direcciones (`direction=all`) y «necesita atención» del mes. El conteo agrupa por `fiscal_period` y el enlace filtra por fecha de emisión: en algún registro RCV cuyo período no es el mes de emisión pueden no coincidir.

### D11. API y UI

`/api/tax/fiscal-matches/` reemplaza `/api/tax/reconciliation/` (ver `api-contracts.md`); `counts` incluye `last_run_at` y `start_date` para evitar un ciclo `tax → accounting`. La página es `/accounting/rcv/cuadre` (`reconciliation` redirige), sin selector de mes, abierta en «necesita atención». Las listas RCV/TUU filtran por `fiscal_match_status`. En la UI el nombre es «Cuadre»; «conciliación» queda para la bancaria.

### D12. Datos y planificador

La migración `tax.0010` crea los grupos desde los vínculos antiguos; `treasury.0113` y `accounting.0051` (que dependen de `tax.0010`) eliminan después los campos viejos de `TerminalSale` y `RCVDocument`. Como el beat corre con `DatabaseScheduler`, la migración `tax.0011` borra la fila `PeriodicTask` de `run_fiscal_reconciliation_10min` (la tarea retirada ya no existe); la entrada nueva se registra desde `CELERY_BEAT_SCHEDULE`.

## Alternativas descartadas

- **B — mantener pares y armar el grupo al leer:** la lista mezcla tres fuentes con paginación frágil, el estado no queda guardado y la unión de tres queda en dos vínculos inconsistentes.
- **C — vista materializada de Postgres:** los problemas de B más el refresco.
- **Un solo monto por documento para TUU:** no representa el pago mixto (bug actual).
- **Recalcular por mes con botones:** exige que alguien recuerde pulsarlos; la tarea cada 10 min cubre todo lo abierto.

## Consecuencias

- Una sola tabla alimenta la página, los conteos, el F29 y la emisión; no hay dos fuentes de verdad.
- Hay que revisar con datos reales si TUU emite una boleta por venta o una por la venta completa (D4).
- Un vínculo automático equivocado antiguo persiste hasta una desvinculación manual (mismo día y monto: sin efecto en totales).
- Los vínculos de TUU 1 venta → N documentos siguen fuera de alcance.
