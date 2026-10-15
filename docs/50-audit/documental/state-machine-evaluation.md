# Evaluación — máquina de estados de OV, OC y factura (2026-10-15)

> Origen: piloto de la ficha documental (ADR-0083). En la OV-000004 del dev server la franja de ciclo mostraba "Facturado" sin que la factura tuviera folio, y la tarjeta de la lista mostraba otra cosa.
> Conclusión: **no es un caso puntual**. Hay dos errores de frontend (ya corregidos) y un error de diseño en el backend: **el pago sobrescribe el estado del documento**.

## 1. Caso OV-000004

| Dato | Valor |
|---|---|
| OV `status` | `INVOICED` |
| OV `invoicing_status` / `delivery_status` | `INVOICED` / `DELIVERED` |
| Total / saldo | 50.000 / 0 |
| Factura 13 | `number` vacío (se muestra "FACV-Draft"), `status = PAID`, con asiento |
| Pago 15 | 50.000, `POSTED`, imputado a la factura 13 |

La factura nunca registró su folio, pero su estado es "Pagada": el estado del documento se perdió.

## 2. Alcance en el dev server

| Hallazgo | Cantidad |
|---|---|
| Facturas en `PAID` | 211 de 238 |
| …de ellas **sin folio** | **180** |
| Facturas en `DRAFT` | 0 (el "folio pendiente" de una factura de OV se crea como `POSTED` sin número) |
| OV en `INVOICED` cuyas facturas no tienen folio | 180 |
| OV por `status` | 187 `INVOICED`, ninguna `PAID` (las OC sí: 38 `PAID`) |

## 3. Causas

### 3.1 Frontend (corregido el 2026-10-15)
1. **Dos fuentes para el ciclo.** La tarjeta usaba `getHubStatuses` (exige folio) y la ficha usaba `invoicing_status` (cuenta facturas sin folio) → discrepaban. Había además dos copias de `getHubStatuses` (`lib/workflow-status` y `features/orders/utils/status`).
   → Fuente única `lib/workflow-status` (`billingStage`): solo cuentan las facturas emitidas (con folio). Sin emitidas el paso queda vacío aunque haya borradores ("Folio pendiente"); parcial o emitidas + borradores = en curso; todo facturado y foliado = completo. La copia de `features/orders` reexporta.
2. **Colores de etapa.** Los estados de paso (`active`, `neutral`…) se pasaban a `StatusBadge` como estados de negocio: `active` se resolvía como `ACTIVE` (verde, "Activo") → una etapa en curso se veía igual que una completada, en la tarjeta y en la ficha.
   → `stageIntent` (`lib/workflow-status`): en curso = advertencia, completado = éxito, pendiente = neutro, anulado = destructivo. Lo usan `HubStatus` (tarjeta) y `DocumentLifecycle` (ficha).

### 3.2 Backend — el pago sobrescribe el estado del documento (pendiente de decisión)
- `TreasuryService` (`treasury/services.py:339`), al quedar pagado el destino, hace `target.status = Status.PAID` sobre **factura, OV, OC o liquidación**, sin mirar el estado previo. Una factura sin folio (o en borrador) pasa a "Pagada" y pierde su estado de emisión.
- `Invoice.Status` mezcla dos ejes: emisión (`DRAFT`, `POSTED`, `CANCELLED`) y cobro (`PAID`).
- El folio pendiente no tiene estado propio y se modela distinto según el flujo: las facturas de OV quedan `POSTED` con `number` vacío; las notas (`note_checkout_service`) usan `DRAFT`.
- `SaleOrder.Status` y `PurchaseOrder.Status` mezclan tres ejes en un campo: ciclo del documento (`DRAFT`, `CONFIRMED`, `CANCELLED`), facturación (`INVOICED`) y cobro (`PAID`), aunque **ya existen** `invoicing_status` (ADR-0081), `delivery_status`/`receiving_status` y el saldo (`pending_amount`). `BillingService` escribe `INVOICED`/`PAID` al facturar y `TreasuryService` escribe `PAID` al pagar → el `status` de la OV es redundante y a veces contradictorio (las OV quedan en `INVOICED` aunque estén pagadas; las OC llegan a `PAID`).

## 4. Decisión (aprobada 2026-10-15, opción 1) — implementada en ADR-0084

Un campo por eje; el estado del documento nunca lo escribe tesorería.

| Documento | `status` (ciclo del documento) | Ejes separados (ya existen o derivados) |
|---|---|---|
| Factura / nota | `DRAFT` (folio pendiente) → `POSTED` (folio registrado) → `CANCELLED` | `payment_status` derivado de `pending_amount`: `UNPAID` · `PARTIAL` · `PAID` |
| OV | `DRAFT` → `CONFIRMED` → `CANCELLED` (+ `PAYMENT_PENDING` del POS) | `invoicing_status`, `delivery_status`, `payment_status` |
| OC | `DRAFT` → `CONFIRMED` → `CANCELLED` | `invoicing_status`, `receiving_status`, `payment_status` |

Pasos:
1. **Guarda inmediata (sin migración):** `TreasuryService` deja de escribir `status` en facturas/OV/OC. El pago solo recalcula saldo y sincroniza tareas.
2. **Migración de datos:** factura `PAID` → `POSTED` si tiene folio, `DRAFT` si no; OV/OC `INVOICED`/`PAID` → `CONFIRMED`; factura de OV creada con folio pendiente → `DRAFT` (igual que las notas).
3. **`payment_status`** como propiedad/campo derivado en serializers; filtros y facetas de listas por eje.
4. **Consumidores:** unas 50 referencias a `PAID` en el backend (guardas `status in [POSTED, PAID]`, notas, cheques, reportes) y 37 en el frontend (filtros, badges, registros de acciones, ciclo). Los registros de acciones y el ciclo ya leen saldo e `invoicing_status`, así que el impacto en la ficha es bajo.
5. Seed y tests de contrato de estados actualizados.

Riesgo: medio-alto (toca facturación, tesorería, notas, cheques y reportes). Recomendación: hacerlo **antes de U3**, porque la ficha de facturas (U3) depende de que el estado de la factura sea fiable.

## 5. Resultado (2026-10-15)

Implementado según ADR-0084. En el dev server (respaldo `~/erpgrafico_pre_adr0084_20261015-2013.dump`): facturas 181 `DRAFT` (folio pendiente) + 58 `POSTED`, 0 incoherencias de folio; OV 188 `CONFIRMED`; OC 50 `CONFIRMED`. OV-000004: `CONFIRMED` · facturación `INVOICED` · pago `PAID`; su factura `DRAFT` · pago `PAID` (folio sigue pendiente).
