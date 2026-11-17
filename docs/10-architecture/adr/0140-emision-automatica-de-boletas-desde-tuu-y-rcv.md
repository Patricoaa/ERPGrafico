---
id: 0140
title: Las boletas y comprobantes nacen en borrador y se emiten automáticamente con el folio del RCV o el id de TUU; cuadre cada 10 minutos y sincronización TUU con intervalo configurable
status: Accepted
date: 2026-11-16
author: backend-team
---

# 0140 — Emisión automática de boletas desde TUU y el RCV

**Relacionado:** ADR-0138 (enmienda D3), ADR-0139, ADR-0084, ADR-0091.

## Contexto

ADR-0138 D3 dejaba **emitidas sin folio** las boletas (39/41) y los comprobantes (48) cobrados en un POS con terminal TUU, y les mostraba un correlativo de visualización. Así quedaban documentos emitidos sin un número fiscal real.

Además, la prueba con la OV-10 mostró que una boleta registrada fuera del POS queda en borrador y nunca entra al cruce, porque el paso 1 (ERP ↔ TUU) solo consideraba documentos `POSTED`.

El número fiscal real existe fuera del ERP:

- **Boleta 39/41:** su folio está en el RCV, que llega con atraso.
- **Comprobante 48:** el SII no lo detalla; su identificador es el de la transacción TUU (`saleId`, o el número de secuencia cuando el `saleId` no viene).

La sincronización TUU corre hoy una vez al día, a una hora fija y hasta el día anterior. No alcanza para cuadrar durante la jornada.

## Decisión

### D1. Toda boleta o comprobante sin folio nace en borrador

Desde cualquier flujo (POS o wizard de venta), un 39, 41 o 48 sin número queda `DRAFT`. Se elimina la excepción de ADR-0138 D3 que permitía `POSTED` sin folio.

### D2. El cruce considera borradores

El paso 1 (ERP ↔ TUU, ADR-0138 D4) toma como candidatos los documentos de venta `POSTED` y, además, los `DRAFT` de tipo 39, 41 o 48 sin número. Con la misma condición entran a los candidatos del vínculo manual.

### D3. Emisión automática con el número fiscal

`issue_fiscal_drafts(year, month)` emite (`BillingService.confirm_invoice`) los borradores de venta 39/41/48 sin número que ya tienen evidencia externa:

- **48:** si está vinculado a una venta TUU, el número es el `sale_id` de TUU, o el `sequence_number` cuando el `sale_id` está vacío o es «N/A». La fecha es el día local de la transacción TUU.
- **39/41:** si su venta TUU tiene `rcv_document` (paso 2, ADR-0139), el número es el `folio` del RCV y la fecha la `issue_date` del RCV.

Cada emisión es independiente, con su propia transacción. Si una falla (período cerrado, folio duplicado, falta de cuentas contables), se registra en el log y el documento sigue en borrador. Por decisión del usuario, esta emisión es automática y no pide confirmación: es la excepción explícita al principio de ADR-0138 D8.

### D4. Cuadre periódico cada 10 minutos

Una tarea de Celery Beat, `tax.tasks.run_fiscal_reconciliation`, corre cada 10 minutos. Procesa el mes en curso y, durante los primeros 10 días del mes, también el anterior, en este orden:

1. `reconcile_terminal_sales`;
2. `reconcile_rcv_boletas`;
3. `issue_fiscal_drafts`;
4. `reconcile_rcv_boletas` otra vez, para que el RCV vea las facturas recién emitidas.

Solo trabaja con datos locales, sin llamar a APIs externas. Un candado en caché (clave `tax:fiscal_reconciliation:lock`, 540 s) evita que dos ejecuciones se solapen, y no hace nada si no hay `fiscal_match_start_date`.

### D5. Estado de la boleta RCV según la cadena

Una boleta 39/41 del RCV queda `MATCHED` solo cuando su venta TUU tiene documento ERP. Si tiene venta TUU pero no documento ERP, queda en el estado nuevo `PENDING_ERP` («Sin documento ERP»), que cuenta en `fiscal_mismatches`. Si no tiene venta TUU, sigue `ONLY_EXTERNAL`.

### D6. Sincronización TUU con intervalo configurable

`TerminalSyncSettings` agrega `interval_value` y `interval_unit` (`MINUTES`, `HOURS`, `DAYS`):

- `run_hour` solo aplica con la unidad `DAYS`;
- el despachador corre cada minuto y lanza una sincronización cuando se cumple el intervalo desde la última programada;
- el rango programado termina **hoy**, ya no ayer;
- los intervalos intradía (`MINUTES`/`HOURS`) sincronizan solo [ayer, hoy]; `DAYS` mantiene `lookback_days`;
- el despachador omite un proveedor que ya tiene una ejecución `RUNNING`, y marca como `FAILED` («Sincronización interrumpida…») las `RUNNING` con más de `max(60, max_retries × retry_delay_minutes + 30)` minutos (el umbral crece con el presupuesto de reintentos).

La pantalla de configuración de TUU edita esos campos, igual que la del RCV.

## Consecuencias

- **Borradores hasta la importación del RCV:** las boletas 39/41 quedan en borrador hasta que se importa el RCV. Con borradores pendientes no se puede cerrar el período ni registrar la declaración del F29 (ADR-0134), así que hay que importar el RCV antes de declarar. Los 48 se emiten en cuanto cuadran con TUU.
- **Asiento en borrador:** mientras la boleta es borrador, su asiento contable también lo es, y la venta no cuenta en el F29. Al emitirse, el asiento se publica.
- **Datos existentes:** los documentos ya emitidos sin folio con ADR-0138 quedan como están. No se reescriben (ADR-0091).
- **Tolerancia del cruce 48 ↔ TUU:** solo se emite un borrador cuyo vínculo con la venta TUU está en `MATCHED`, sea automático o manual. Si el paso 1 se equivoca (dos ventas candidatas del mismo monto en la misma ventana), el resultado es `AMBIGUOUS`; si el tipo de documento de TUU no coincide, es `TYPE_DIFF`. En ambos casos no se emite nada.
- **Fecha del asiento:** al emitir, `confirm_invoice` mueve la fecha del asiento en borrador a la fecha fiscal del documento, y su período contable se recalcula con esa fecha. Si la fecha del SII cae en otro mes, el asiento queda en ese mes. Las fechas por defecto de los documentos de venta usan la fecha local, no la fecha UTC.
- **Checkout con borrador del asistente:** el checkout reutiliza cualquier documento primario no anulado de la orden, incluido un borrador creado por el asistente. Es intencional: evita documentos duplicados.
- **Fechas de negocio locales:** en toda la aplicación las fechas de negocio son locales (America/Santiago), no UTC.
- **Umbral de sincronización colgada:** una ejecución TUU `RUNNING` se da por interrumpida pasados `max(60, max_retries × retry_delay_minutes + 30)` minutos, para no cortar una corrida que aún reintenta.
- **Resúmenes del cuadre:** los borradores sin folio solo cuentan en `erp_*` si provienen de una orden de venta; un borrador hecho a mano no entra.
