---
id: 0139
title: Las boletas del RCV se cuadran una a una vía la venta TUU (día + monto, en orden); reloj de depuración para desarrollo
status: Accepted
date: 2026-11-16
author: backend-team
---

# 0139 — Cuadre de boletas RCV vía TUU y reloj de depuración

**Relacionado:** ADR-0138 (lo enmienda en D5), ADR-0091, ADR-0118.

## Contexto

ADR-0138 D5 asumió que el RCV entrega las boletas (39, 41) y los comprobantes (48) **solo como resumen mensual**, por lo que los marcó `EXCLUDED` a nivel de documento y los cuadró solo por totales.

Los datos reales (importaciones de oct y nov 2026) lo desmienten:

- **39:** viene con detalle (246 de 246 en nov, 522 de 522 en oct), con folio, fecha de emisión y monto.
- **48:** viene solo como resumen (`has_detail = False`).

El RCV trae la fecha, no la hora. La boleta del ERP no tiene folio, porque la emite TUU, y TUU no entrega folio. El único registro que tiene hora en ambos lados es el par **pago del ERP ↔ venta TUU**, que ya cuadra ADR-0138 D4 con una ventana de tiempo.

Además, el cruce D4 compara contra la hora real del servidor. Las ventas TUU de prueba son de días pasados, así que en desarrollo no hay forma de registrar una venta del ERP «a la hora del cobro» y probar el cruce automático.

## Decisión

### D1. Cadena de cruce de boletas

- **Paso 1 (sin cambios, ADR-0138 D4):** pago del ERP ↔ venta TUU por ventana de tiempo, monto y dispositivo. Este es el único paso que usa hora.
- **Paso 2 (nuevo):** venta TUU ↔ boleta del RCV.
  - Se cruzan las ventas TUU `COMPLETED` con `document_type` 39 o 41 contra los `RCVDocument` de ventas del mismo tipo, del **mismo día local** (`timezone.localdate(transaction_at)` == `issue_date`) y del **mismo monto** (`sale_amount` == `abs(total_amount)`).
  - **Montos duplicados del día se emparejan en orden, sin cruzar:** las ventas TUU se ordenan por `transaction_at` (desempate por id) y las boletas RCV por `folio` (desempate por id), y se emparejan 1 a 1 en ese orden. Como el folio crece con la hora, el par suele ser el real. Cuando no lo es, el error queda dentro del mismo día y del mismo monto, así que no afecta ningún total.
  - Cada boleta y cada venta se usan **una sola vez**. Lo que sobra de un lado queda sin par.
- **El ERP llega por la venta TUU:** el `RCVDocument` de la boleta toma como `matched_invoice` el documento ERP enlazado a su venta TUU, si existe.

### D2. Modelo

- **`TerminalSale.rcv_document`:** FK opcional a `RCVDocument` (`SET_NULL`, `related_name="terminal_sales"`, único cuando no es nulo).
- **Estado del `RCVDocument` 39/41 tras el paso 2:**
  - `MATCHED` si tiene venta TUU, con `matched_invoice` = la factura de esa venta, o nulo si la venta aún no cuadra con el ERP;
  - `ONLY_EXTERNAL` si no tiene venta TUU.
  - `missing_since_import` → `EXCLUDED` y sin enlaces, igual que en ADR-0138.
- **Venta TUU 39/41 sin boleta RCV:** no lleva campo de estado propio. El reporte la cuenta como «Falta en el SII».
- **48:** sigue `EXCLUDED` a nivel de documento y se cuadra por resumen, como en ADR-0138.
- Las filas con `matched_manually` se respetan, con la misma regla de ADR-0138: deja de protegerse un vínculo manual si su factura se anuló o desapareció.

### D3. Cuándo corre

Servicio `reconcile_rcv_boletas(year, month)`, idempotente y atómico, que corre:

- al final del cuadre TUU (después de `reconcile_terminal_sales`), para que un cambio en el paso 1 se propague al RCV;
- al final de cada importación exitosa del RCV de ventas;
- desde «Recalcular RCV» y «Recalcular TUU».

El cuadre documento a documento del RCV (`reconcile_rcv_period`) deja de tocar las filas 39/41: ahora son de este servicio.

### D4. Reloj de depuración

Solo existe con `DEBUG=True` y `DEBUG_CLOCK_ENABLED=1`. En cualquier otro caso, el código no hace nada.

- Un desfase guardado en el caché (Redis) mueve `timezone.now()` del backend con `time-machine`, y el reloj sigue avanzando desde la hora fijada. Se aplica en las requests web y en las tareas Celery.
- Se controla con `manage.py debug_clock set "AAAA-MM-DD HH:MM"`, `manage.py debug_clock reset` y `manage.py debug_clock show`. No hay endpoint para fijarlo.
- `/api/core/server-time/` informa `debug_clock: true|false`. El frontend muestra un **banner fijo** mientras el reloj está alterado. La interfaz ya toma la fecha del servidor (`useServerDate`), así que sigue al reloj.
- Fuera de alcance: Celery Beat sigue el reloj real, y las APIs externas (TUU, SimpleAPI) responden con fechas reales.

## Alternativas descartadas

- **Boletas solo por totales mensuales (ADR-0138 D5):** desaprovecha el detalle que el RCV sí entrega y no identifica qué boleta falta.
- **Marcar `AMBIGUOUS` los montos repetidos del día:** casi todas las boletas de montos comunes quedarían sin cuadrar. Emparejar en orden es tolerable porque el error posible no cambia ningún total.
- **Cruzar el ERP con el RCV directamente:** la boleta del ERP no tiene folio y su fecha de registro puede diferir. La venta TUU es el único puente con hora.
- **`libfaketime` en el contenedor:** afecta a todo el proceso, exige reiniciar para cambiar la hora y es más fácil que termine en producción por error.
- **Guardar el folio RCV en la boleta emitida:** modifica un documento emitido (ADR-0091). El folio se muestra desde la relación.

## Consecuencias

- El reporte y `fiscal_mismatches` pasan a contar las boletas 39/41 sin par (RCV sin venta TUU, venta TUU sin boleta RCV).
- Los vínculos boleta ↔ venta pueden intercambiarse entre ventas del mismo día y monto. Ningún flujo contable depende de ese vínculo.
- **Supuesto a vigilar:** el folio del RCV crece con la hora de emisión. Si TUU emite boletas fuera de orden, los pares de montos repetidos quedan intercambiados, sin efecto en los totales.
