---
id: 0141
title: El cuadre es un solo registro por grupo (documento ERP, pagos TUU, registros RCV) que el motor resuelve cada 10 minutos, sin vínculos por pares ni recálculo manual
status: Accepted
date: 2026-11-17
author: backend-team
---

# 0141 — Cuadre unificado por grupo

**Relacionado:** ADR-0138 (enmienda D4–D6), ADR-0139 (enmienda D1–D3), ADR-0140 (enmienda D4–D5), ADR-0091, ADR-0116, ADR-0118. Specs: `docs/superpowers/specs/2026-11-17-cuadre-unificado-design.md` y `docs/superpowers/specs/2026-11-18-ficha-cuadre-columnas-design.md` (D7, D8 y D13).

## Contexto

El control de que el SII (RCV), TUU y el ERP digan lo mismo estaba repartido: vínculos por pares en dos modelos (`TerminalSale.matched_invoice`, `RCVDocument.matched_invoice`, `TerminalSale.rcv_document`), tres servicios que se pisaban (`reconcile_terminal_sales`, `reconcile_rcv_boletas`, `reconcile_rcv_period`), unión manual en dos fichas, una página por mes con botones «Recalcular RCV / TUU» y varios nombres para lo mismo («Cuadre», «Cuadre fiscal», `reconciliation`).

Además, la parte TUU comparaba el monto de la venta contra el total del documento, lo que falla en el pago mixto y en varios pagos con tarjeta; y cada corrida limpiaba y recalculaba el rango completo.

## Decisión

### D1. Un modelo por grupo: `tax.FiscalMatch`

Un grupo es un documento ERP (0..1, `invoice` único) con sus ventas TUU (`TerminalSale.fiscal_match`, 0..N) y sus registros RCV (`RCVDocument.fiscal_match`, 0..N), o un grupo huérfano con registros externos esperando su documento. Guarda el estado del grupo y de cada parte, y los montos denormalizados para filtrar y paginar sin joins. Se eliminan `matched_invoice`, `match_status`, `matched_manually`, `rcv_document` y `issue_*` de `TerminalSale`/`RCVDocument`; `Invoice` sigue siendo la única fuente contable (ADR-0138 D1). Enmienda ADR-0138 D4–D6.

### D2. Estados de parte y de grupo

`core/fiscal_match.py` define `PartState` (`MATCHED`, `PENDING`, `MISSING`, `DIFF`, `AMBIGUOUS`, `NOT_APPLICABLE`, `SUMMARY_ONLY`) y `FiscalMatchStatus` (`EXCLUDED`, `AMBIGUOUS`, `DIFF`, `MISSING_ERP`, `MISSING_EXTERNAL`, `PENDING`, `MATCHED`, derivado por esa prioridad). Desaparecen `MatchStatus` y `PENDING_ERP`. Ante duda el resultado es `AMBIGUOUS`, nunca un vínculo. Etiquetas (2026-11-18): grupo `DIFF` = «Con advertencias»; parte `DIFF` = «Advertencia». Facturas y notas (33/34/56/61) cuyo registro RCV trae otro RUT quedan en `DIFF` en la parte RCV; las boletas 39/41 ignoran el RUT.

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

### D7. Unión manual desde la ficha del grupo (enmendada 2026-11-18: ficha en columnas)

`FiscalMatchDrawer` (`tax.fiscalmatch`) pasa a ser un tablero de columnas (ERP, TUU, RCV): cada columna muestra lo ya unido y, debajo, candidatos con puntaje para unir. Unir y quitar **no llaman al servidor**: arman una lista de cambios en espera con sus consecuencias a la vista, y un solo botón «Guardar» los envía juntos con `POST apply/` (D13). Los endpoints sueltos `link/`, `unlink/` y `candidates/` se retiraron; los candidatos los da `GET search/`. Quitar deja el registro en un grupo huérfano marcado como manual. Las boletas llevan en el SII un RUT genérico: la unión no exige el RUT en 39/41, solo en facturas y notas. Si la ficha pasa al grupo resultante (el abierto se borró), la página actualiza `selected`; un grupo que ya no existe (404) se explica como tal. Los servicios manuales toman el mismo candado de caché del motor y responden **409** si está ocupado (fallan rápido, sin esperar), y mutan bajo `@transaction.atomic`.

### D8. Idempotencia

Scopes de `Idempotency-Key`: `tax.fiscal_match.apply` (reemplaza a `.link` y `.unlink`, retirados), `.release`, `.retry_issue`, `.confirm_draft`, `.create_draft` (documentados en `docs/20-contracts/idempotency.md`). `apply` es un único guardado: reintentar con la misma clave devuelve la respuesta original sin reaplicar los cambios.

### D9. Emisión automática por documento

La emisión de borradores (ADR-0140 D3) se conserva, ahora leyendo el grupo y escribiendo `issue_attempted_at`/`issue_error` en él. Exige la parte TUU `MATCHED` y, en boletas 39/41, también la RCV `MATCHED`: la boleta toma el folio de su registro RCV, y emitir con un registro de otro monto (o ambiguo o pendiente) fijaría un folio equivocado de forma irreversible (ADR-0091). Emite **por documento**, con una transacción por borrador: es una excepción acotada a ADR-0118 (la emisión asigna folio y publica el asiento; no se puede agrupar), no una lista que consulte por fila.

### D10. Conteo del F29 (sin resumen mensual ni pendientes de folio)

El resumen mensual 39/41/48 (con el **48 esperado** = comprobantes 48 del ERP + pagos TUU con tarjeta de facturas 33/34) y la lista de borradores pendientes de folio se **retiraron por decisión del usuario (2026-11-18)**: no tenían consumidor en la UI. Los endpoints `fiscal-matches/summary/` y `fiscal-matches/pending-issue/`, sus funciones y sus hooks ya no existen. Se mantiene `fiscal_mismatch_counts`: la compuerta F29 `fiscal_mismatches` sigue en **Sugeridos** (no bloquea) con claves nuevas: `DIFF`, `AMBIGUOUS`, `MISSING_ERP`, `MISSING_EXTERNAL` del `fiscal_period`; `status_check`, el wizard F29 y el checklist de cierre se actualizaron. Su enlace «Ir al cuadre» abre ambas direcciones (`direction=all`) y «necesita atención» del mes. El conteo agrupa por `fiscal_period` y el enlace filtra por fecha de emisión: en algún registro RCV cuyo período no es el mes de emisión pueden no coincidir.

### D11. API y UI

`/api/tax/fiscal-matches/` reemplaza `/api/tax/reconciliation/` (ver `api-contracts.md`); `counts` incluye `last_run_at` y `start_date` para evitar un ciclo `tax → accounting`. La página es `/accounting/rcv/cuadre` (`reconciliation` redirige), sin selector de mes, abierta en «necesita atención». Las listas RCV/TUU filtran por `fiscal_match_status`. En la UI el nombre es «Cuadre»; «conciliación» queda para la bancaria.

### D12. Datos y planificador

La migración `tax.0010` crea los grupos desde los vínculos antiguos; `treasury.0113` y `accounting.0051` (que dependen de `tax.0010`) eliminan después los campos viejos de `TerminalSale` y `RCVDocument`. Como el beat corre con `DatabaseScheduler`, la migración `tax.0011` borra la fila `PeriodicTask` de `run_fiscal_reconciliation_10min` (la tarea retirada ya no existe); la entrada nueva se registra desde `CELERY_BEAT_SCHEDULE`.

### D13. Ficha en columnas: búsqueda, puntaje, reglas y guardado atómico (2026-11-18)

**Búsqueda (`GET /api/tax/fiscal-matches/{id}/search/?part=erp|tuu|rcv&q=&ordering=score|recent`).** Páginas fijas de 20 tarjetas por columna. Universos, siempre «sin cuadrar» (se excluyen grupos `MATCHED`/`EXCLUDED`):

- *ERP* (para un huérfano): documentos de la misma dirección y evaluables. No se descartan los que ya tienen registros de la parte cuando las reglas permiten acumular: con venta TUU basta un cobro libre (un documento admite N ventas TUU); con registro del SII, las facturas y notas se excluyen si su grupo ya tiene uno (un RCV por documento) y las boletas 39/41 se ofrecen aunque lo tengan (acumulan).
- *TUU*: ventas completadas de grupos huérfanos (solo de venta; en un huérfano, las propias).
- *RCV*: registros vigentes de la misma dirección en huérfanos sin ventas TUU completadas (en un huérfano, los propios).
- Sin `q`, ventana de **62 días** (`SCAN_DAYS` del motor) en las tres partes; con `q` se busca sin ventana por folio, nombre, RUT o monto.

**Puntaje de coincidencia (0–100)**, de `tax/fiscal_match/scoring.py`: monto 40, día 25 (mismo día; si no, `max(0, 15 − 3 × días)`), RUT 20, tipo 15. Mismo folio con dirección y tipo compatibles vale 100. TUU y boletas 39/41 no llevan RUT y suman el criterio completo. Si la referencia es una venta TUU y el candidato un documento ERP, el monto puntúa cuando coincide con **el monto exacto de un cobro libre** del documento (la venta respalda un cobro, no necesariamente el total). El puntaje solo ordena; nunca bloquea.

**Advertencias.** Cada candidato lleva `warnings: [{code, label, blocking}]`. Las **bloqueantes** son reglas que el servidor rechaza al guardar y comparten código con el 400: `TYPE_INCOMPATIBLE` («Tipo distinto»; también «Efectivo solo en boletas»), `OTHER_DIRECTION`, `NOT_COMPLETED` (venta anulada) y `SECOND_RCV` (factura o nota que ya tiene registro del SII). Las **no bloqueantes** son `OTHER_AMOUNT`, `OTHER_DAY` y `OTHER_RUT`: la ficha avisa, pero el usuario manda y puede unir. Un monto de pago distinto al de la venta TUU **no bloquea**: deja la parte TUU en `DIFF` (grupo «Con advertencias»; parte «Advertencia»).

**Reglas del guardado.** Un cobro TUU en efectivo solo se une a un movimiento `CASH` y a una boleta 39/41. No se aplica la comprobación de dispositivo/terminal en uniones manuales (el usuario elige). Las ventas anuladas de un huérfano no impiden unirlo: se quedan atrás y el motor las libera; `link rcv` con ventas en el grupo bloquea (`RCV_HAS_SALES`) solo si están completadas. Los registros RCV de un huérfano viajan con su venta TUU al documento cuando corresponde (`carried_rcv: [{id, folio}]` en la tarjeta TUU, sin consultas por fila); la ficha lo anuncia en las consecuencias («La boleta SII folio N se moverá también»).

**Guardado `POST apply/`.** Cuerpo `{changes: [{op: "link"|"unlink", part, id, movement?, payments?}]}` (1 a 50). Es atómico: primero los `unlink`, luego `link erp`, `link tuu` y `link rcv`; el primer cambio que rompe una regla revierte todo. Un registro que ahora está en otro grupo del que vio la ficha responde `MOVED`. Se re-deriva una sola vez al final y la respuesta es el grupo resultante (puede ser otro id). Los errores usan el sobre estándar del repo (`ERPGraficoError`): `error.code` y `error.details.change_index` (índice del cambio en la lista enviada), con que la UI marca el cambio culpable.

**Invariante 13.** Las listas de candidatos son una lista de tarjetas propia de la feature (`FiscalMatchCandidateCard`), por especificación: no son una colección de entidad ni una tabla, así que no usan `defineEntity` ni son un escape de entity-view (invariante 13 de `CLAUDE.md`).

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
