---
id: 0040
title: Demover factura/orden al protestar o anular un cheque
status: Accepted
date: 2026-06-04
author: core-team
related: 0035, 0039
---

# 0040 — Demover factura/orden al protestar o anular un cheque

## Contexto

ADR-0035 modeló el ciclo del cheque: al recibirlo se crea un `INBOUND` con
`payment_method=OTHER` vinculado a la `Invoice` (o `SaleOrder`); al depositarlo
se crea un `TRANSFER` interno cartera → cuenta-de-depósito; al cobrarlo
(`clear`) se mueve de la cuenta-de-depósito a la cuenta bancaria operativa.
Al **anular** (`void`) o **protestar** (`bounce`) un cheque recibido, el
servicio crea los movimientos reversos correspondientes y eso **revierte
correctamente la contabilidad y el saldo de tesorería**.

Sin embargo, el cálculo de `total_paid` que dispara la democión del estado
de la factura estaba roto:

```python
# backend/treasury/services.py:181-182
related_payments = TreasuryMovement.objects.filter(invoice=target)
total_paid = sum(m.amount for m in related_payments)
```

`amount` es **siempre positivo** (validado en `services.py:37` con
`amount <= 0 → ValidationError`). El código suma montos absolutos sin
descontar por `movement_type`, de modo que:

| Paso | Movimiento | `total_paid` calculado | Estado factura |
|---|---|---|---|
| Recibo | INBOUND 1000 | 1000 | → `PAID` |
| Protesto/Anulo | OUTBOUND 1000 (reverso) | **2000** (sumado) | sigue `PAID` ❌ |

Resultado: tras `bounce()` o `void()`, la factura **sigue marcada PAGADA**
aunque el cliente ya no haya pagado y el saldo de tesorería refleje la
reversión. Los reportes de cuentas por cobrar y el dashboard de ventas no
muestran la deuda. El docstring de `CheckService.bounce` (`check_service.py:171-173`)
explícitamente dice *"reinstalar el documento original como no pagado"*, por
lo que la intención estaba documentada pero la implementación no la
cumplía.

La rama democión de `update_related_document_status`
(`services.py:215-220`) solo cubre el caso de transacciones sin número de
operación (`PAID → CONFIRMED`/`INVOICED`); no cubre el caso de un OUTBOUND
reverso que reduce el total firmado por debajo del facturado.

## Decisión

Añadir un helper dedicado en `CheckService` que se invoca **solo** desde
`bounce()` y `void()`, después de crear los movimientos reversos. El helper
recalcula el estado de pago de la factura/SO con matemática firmada y
demueve si corresponde.

### Helper

```python
@staticmethod
def _recompute_invoice_status(check: "Check") -> None:
    """
    Recalcula el estado de pago de la factura/SO vinculada con matemática
    firmada (INBOUND suma, OUTBOUND resta, TRANSFER es interno) y demueve
    a estado no-pagado si el total neto cae por debajo del total facturado.
    Idempotente. No-op si el cheque no tiene invoice_id ni sale_order_id.
    """
```

Algoritmo:

1. Cargar todos los `TreasuryMovement` vinculados a la `invoice` del cheque.
2. `net_paid = Σ(INBOUND.amount) - Σ(OUTBOUND.amount)` (TRANSFER se ignora,
   es movimiento interno entre cuentas propias).
3. Si `net_paid < target_total` y el estado actual es `PAID`:
   - `Invoice.status = 'POSTED'`; guardar con `update_fields=['status']`.
   - `SaleOrder.status`: idem si la SO expone `Status.PAID` (hoy no — `sales/
     models.py:405-408` solo define `DRAFT/CONFIRMED/CANCELLED` — pero la
     lógica queda lista si se agrega en el futuro).
4. No-op si el cheque no tiene `invoice_id` ni `sale_order_id`.
5. Idempotente (puede llamarse N veces, el resultado es estable).

### Invocación

Llamado al final de `bounce()` y `void()`, **después** de `check.save()` y
antes de `return check`:

```python
check.save()
CheckService._recompute_invoice_status(check)
return check
```

### Scope explícito

El helper vive en `check_service.py` y **no** modifica
`TreasuryService.update_related_document_status` global. Esto preserva el
comportamiento existente para pagos parciales, devoluciones y notas de
crédito que no son cheques — donde la suma cruda de montos absolutos es la
semántica esperada.

## Consecuencias

**Positivas:**

- Una factura cobrada con cheque protestado vuelve a `POSTED` automáticamente;
  los reportes de CxC reflejan la deuda.
- El docstring de `bounce()` se cumple (*"reinstalar el documento original
  como no pagado"*).
- Idempotencia: si en el futuro otro flujo también invoca el helper, el
  resultado es estable (no loop, no doble reversa).
- Scope acotado: cero impacto en pagos no-cheque.

**Trade-offs / neutrales:**

- Existe duplicación conceptual con `update_related_document_status`. Se
  acepta por el scope acotado: reescribir la lógica global tiene riesgo de
  regresión en pagos parciales con tarjeta + crédito + cheque, donde la
  suma cruda sí es la semántica correcta.
- Si un usuario tiene un flujo custom que crea un `OUTBOUND` contra una
  invoice de cheque (no recomendado), la democión se ejecutará al
  protestar/anular de nuevo. Es el comportamiento esperado: la factura debe
  reflejar el neto real.

**Fuera de alcance:**

- Re-calcular el estado de `SaleDelivery` (no tiene `PAID`).
- Re-calcular KPIs / cache / señales de dominio (`Signal.post_save` etc.).
  La próxima query refresca los datos.
- Auditar el efecto en reportes de Excel/PDF pre-cacheados.

## Alternativas consideradas

1. **Modificar `update_related_document_status` para usar matemática firmada
   globalmente.** Rechazado: la suma cruda de montos absolutos es correcta
   para pagos parciales con múltiples medios (tarjeta + crédito + cheque).
   Cambiar la global introduce regresiones y no respeta la invariante
   "el scope del cheque queda en check_service".
2. **Agregar `is_reversal: bool` en `TreasuryMovement` y filtrar/excluir del
   total.** Más invasivo (migración, modelo, serializer, frontend), más
   explícito, pero rompe el principio de que el campo `movement_type` ya
   codifica la dirección.
3. **Marcar la factura con un flag `has_bounced_check` y dejarla PAGADA.**
   No resuelve el reporte de CxC; solo señaliza visualmente. El usuario
   descartó esta opción en la planificación.
4. **Acción manual del usuario (botón "Reabrir factura" tras protesto).**
   Rechazado: es exactamente lo que el docstring de `bounce()` promete que
   el sistema haga solo, y los reportes en tiempo real lo necesitan.

## Referencias

- ADR-0035 — cheques girados y endosados (modelado original del ciclo).
- ADR-0039 — remoción del endoso de cheques recibidos (motivó esta auditoría
  de los flujos restantes del cheque).
- Contrato [state-map.md](../../20-contracts/state-map.md) — bullet nuevo
  documenta la democión.
- Backend:
  - `backend/treasury/check_service.py:165-212` (`bounce`, a invocar helper).
  - `backend/treasury/check_service.py:218-253` (`void`, a invocar helper).
  - `backend/treasury/services.py:147-230` (`update_related_document_status`
    con la lógica firmada que NO se toca).
  - `backend/billing/models.py:26-30` (Invoice `Status` choices: DRAFT /
    POSTED / PAID / CANCELLED).
  - `backend/sales/models.py:405-408` (SaleOrder `Status` choices: DRAFT /
    CONFIRMED / CANCELLED).
- Tests a añadir:
  - `backend/treasury/tests/test_checks.py` — 3 tests:
    `test_bounce_demotes_invoice_to_posted`,
    `test_void_demotes_invoice_to_posted`,
    `test_bounce_without_invoice_is_noop`.
