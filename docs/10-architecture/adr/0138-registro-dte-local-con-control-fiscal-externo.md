---
id: 0138
title: El registro DTE local es la fuente contable; el RCV (SII) y las ventas TUU son control fiscal externo que se cuadra contra él
status: Accepted
date: 2026-11-15
author: backend-team
---

# 0138 — Registro DTE local con control fiscal externo (RCV + TUU)

> **Enmendado por ADR-0141:** D4–D6 (cuadre por pares y vínculos en `TerminalSale`/`RCVDocument`) pasan a un registro por grupo (`FiscalMatch`).

**Relacionado:** ADR-0081 (facturación parcial y multi-orden), ADR-0084 (estado del documento desacoplado del pago), ADR-0089 (fusión de billing en ventas/compras), ADR-0091 (inmutabilidad económica), ADR-0118 (zero N+1), ADR-0134 (wizard F29). Specs: `docs/superpowers/specs/2026-11-14-rcv-importacion-simpleapi-design.md`, `docs/superpowers/specs/2026-11-13-tuu-sincronizacion-ventas-terminal-design.md`.

## Contexto

Hoy conviven tres registros de documentos tributarios que no se conectan entre sí:

| Registro | Modelo | Qué sabe | Qué no sabe |
|---|---|---|---|
| **Local** | `billing.Invoice` | Líneas, costo, asiento, pagos, OV/OC, notas, borradores diferidos | Si el SII o el proveedor emitieron de verdad el documento |
| **RCV (SII vía SimpleAPI)** | `accounting.RCVDocument` + `RCVImportSummary` | Lo que el SII registra: detalle de 33/34/56/61 y compras, resumen mensual de 39/48 | Líneas, costo, pagos, OV/OC; boletas de compra |
| **Ventas TUU** | `treasury.TerminalSale` | Cada transacción del terminal (tarjeta y efectivo) con `document_type` (39/48/33), fecha y hora, monto y dispositivo | Folio DTE (ninguna API TUU lo trae); líneas |

El ERP **no emite DTE**: los registra. Las boletas (39) y los comprobantes de pago (48) los emite el proveedor del terminal (TUU). Las facturas se emiten fuera y se registran con su folio.

La evaluación (2026-11-15) encontró que no conviene quedarse con un solo registro, porque ninguno reemplaza al otro. También encontró defectos del registro local que impiden cualquier cuadre:

1. **Las compras con factura tienen dos representaciones:** `FACTURA` + `purchase_order` y `PURCHASE_INV`, ambas código 33 (`billing/models.py:239`, `billing/strategies/dte.py:621`). Además, "Factura de Compra" se confunde con el DTE 46 del SII.
2. **`Invoice` no guarda si es compra o venta.** La dirección se deduce de `sale_order`, `purchase_order`, `dte_type` y `corrected_invoice`.
3. **Las claves no están normalizadas.** El folio local es `CharField` y el del RCV es `BigInteger`. El RUT local (`partner_tax_id_snapshot`) tiene formato libre.
4. **El tipo de documento de venta se elige antes de conocer el pago.** El wizard pide el documento en el paso 2 y el pago al final (`SalesCheckoutWizardView.tsx:128`). Nunca ofrece el 48 (`Step2_DTE.tsx:58`), aunque `ComprobantePagoStrategy` existe. Toda venta con tarjeta en un terminal integrado queda como 39.
5. **El folio de la boleta se inventa.** `create_sale_invoice` asigna a una boleta sin folio el siguiente número de una secuencia interna (`billing/services.py:517`). Ese número no es un folio SII.

## Decisión

### D1. Roles

- **`Invoice` es la única fuente contable.** Solo `Invoice` genera asientos, pagos y efectos de inventario o costo.
- **`RCVDocument`/`RCVImportSummary` y `TerminalSale` son evidencia externa de solo lectura.** Nunca generan contabilidad por sí mismos.
- La relación entre ellos es un **cuadre**: un vínculo opcional más un estado. No es sincronización.

### D2. Clave fiscal de `Invoice` (fase 1)

- Un selector `fiscal_key(invoice)` en `billing/fiscal_key.py` devuelve `(direction, sii_code, folio:int | None, counterparty_rut_normalized)`.
  - `direction` se deduce de una sola forma, en este orden: compra si hay `purchase_order` o es `PURCHASE_INV`; venta si hay `sale_order`; si es una nota con `corrected_invoice`, la dirección de esa factura; **venta en el resto de los casos** (una factura suelta, sin OV ni OC, es de venta). La misma regla existe como expresión ORM (`fiscal_direction_expression`).
  - El RUT se normaliza con el mismo normalizador del RCV (`accounting/integrations/rcv_normalizer.py`).
- `PURCHASE_INV` y `FACTURA` + `purchase_order` producen la misma clave (`purchase`, 33). Unificar el enum es una migración aparte y queda fuera de este ADR.

### D3. El documento de venta se deriva del pago (fase 2)

> Enmendado por ADR-0140: las boletas y comprobantes sin folio nacen en borrador y se emiten con el folio del RCV o el id de TUU.

- En el paso Documento del wizard de venta se elige la **clase** del documento: **boleta** (consumidor final, afecta o exenta) o **factura** (33/34).
- **Factura:** no cambia nada. El pago con terminal es solo el medio de pago.
- **Boleta:** el tipo se decide al confirmar el pago, por cada porción pagada.
  - La porción pagada con un medio integrado (`PaymentMethod.is_integrated`) genera un `COMPROBANTE_PAGO` (48).
  - La porción pagada con cualquier otro medio genera un `BOLETA` (39), o un `BOLETA_EXENTA` (41) si la clase es exenta.
  - Con **pago mixto** se crea **un documento por porción** en la misma OV (lo permite ADR-0081). Cada documento lleva sus líneas proporcionales o una línea resumen, según defina el plan.
- **Sin folio inventado.** Se elimina la secuencia interna de `create_sale_invoice` para las boletas.
- **Excepción acotada a ADR-0084** (que dice "emitido exige folio"): los tipos 39, 41 y 48 de una venta cobrada en un POS con proveedor de terminal pueden quedar `POSTED` **sin folio**.
  - El emisor es el proveedor, y la evidencia es la `TerminalSale` con la que se cuadra (D4).
  - `display_id` usa un correlativo de visualización que no se presenta como folio SII.
  - Sin proveedor de terminal, la boleta sigue la regla general: folio digitado o borrador.

### D4. Cuadre ERP ↔ TUU por transacción (fase 3)

- `TerminalSale` gana `matched_invoice` (FK opcional a `Invoice`, única cuando no es nula), `match_status` y `matched_manually`.
- **Candidatos de una `TerminalSale`:** documentos de venta 39/41/48/33 cuyo movimiento de tesorería cumple con:
  - mismo tipo de pago: tarjeta ↔ medio integrado del mismo `device`; efectivo ↔ efectivo en una sesión POS del terminal;
  - `created_at` dentro de una ventana de ±N minutos de `transaction_at` (N configurable, 15 por defecto);
  - monto igual a `sale_amount` (sin propina ni vuelto).
- **Resultado:**
  - un solo candidato → `MATCHED`;
  - varios → `AMBIGUOUS` (lo resuelve el usuario y nunca se desempata solo por cercanía);
  - ninguno → `ONLY_EXTERNAL`.
- Un `Invoice` POS sin `TerminalSale` después de la ventana de sincronización queda como `ONLY_ERP`.
- **Diferencia de tipo:** si `TerminalSale.document_type` no coincide con el `sii_code` del documento, el estado es `TYPE_DIFF`.
  - El documento está `POSTED` e inmutable (ADR-0091), así que no se corrige automáticamente.
  - La corrección es un servicio explícito y auditado (reclasificar el tipo del documento POS) que queda para el plan.
- El cuadre corre al final de cada `TerminalSyncRun` y se puede recalcular a mano por período.

### D5. Cuadre ERP ↔ RCV (fase 4)

> Enmendado por ADR-0139: las boletas 39/41 se cuadran una a una vía la venta TUU (la «tabla de tres columnas» sigue como resumen).

- `RCVDocument` gana `matched_invoice` (FK opcional), `match_status` y `matched_manually`.
- **Documento por documento** (33, 34, 56, 61, compras y ventas): se cruza `fiscal_key` (D2) contra `(direction, dte_type, folio, counterparty_rut)`.
  - Clave igual y montos iguales → `MATCHED`.
  - Clave igual y monto distinto → `AMOUNT_DIFF`.
  - Sin par → `ONLY_EXTERNAL` (falta en el ERP) u `ONLY_ERP` (falta en el SII).
- **Por resumen mensual** (39, 41, 48): una tabla de tres columnas por tipo y período, con la suma del ERP, la suma de TUU y `RCVImportSummary`. Las diferencias se explican con el detalle de D4.
- **Exclusiones** (estado `EXCLUDED`, nunca una alerta):
  - boletas de compra, que no van al RCV;
  - tipos sin equivalente local (43, 46, 110–112, 914), que aparecen como `ONLY_EXTERNAL · tipo no soportado`.
- El cuadre corre al final de cada `RCVImport` y es idempotente. Un `RCVDocument` con `missing_since_import` vuelve a evaluarse. Las diferencias nuevas en un período con `tax_period_closed` se muestran como alerta y no se recalculan en silencio.

### D6. Estados de cuadre compartidos

`MatchStatus` es único para D4 y D5: `MATCHED`, `AMOUNT_DIFF`, `TYPE_DIFF`, `AMBIGUOUS`, `ONLY_EXTERNAL`, `ONLY_ERP`, `EXCLUDED`. Los servicios de cuadre viven en `tax/reconciliation/`, porque `tax` ya depende de `billing` y es la app fiscal. Cumplen ADR-0118: los candidatos se cargan en lote por período y no hay consultas por fila.

### D7. Compuerta F29 (fase 5)

`status_check` (ADR-0134) agrega la categoría `fiscal_mismatches`, con los conteos `ONLY_EXTERNAL`, `AMOUNT_DIFF`, `TYPE_DIFF` y `AMBIGUOUS` del período. Va en **Sugeridos**, no en Obligatorios: el RCV puede estar incompleto (el proveedor emite tarde) y no debe impedir declarar.

### D8. El registro externo alimenta al local (fase 6)

- **Completar borradores diferidos:** un `RCVDocument` `ONLY_EXTERNAL` de compra con el mismo RUT que un `Invoice` `DRAFT` y un total parecido se sugiere como su folio. Si el usuario confirma, se asignan folio y fecha y se emite (`confirm_invoice`).
- **Registrar desde RCV:** un `ONLY_EXTERNAL` sin borrador asociado crea un borrador de `Invoice` prellenado (contacto por RUT, folio, fecha, neto, IVA). El usuario completa la OC o la cuenta de gasto.
- Ninguna de estas acciones emite ni contabiliza sin la confirmación del usuario.
- **Alcance:** sin OC no hay borrador. El modelo `Invoice` trata como venta a toda factura sin OC (`is_sale_document`), así que un borrador de compra se crea solo desde una OC.

## Resolución de preguntas abiertas

Decisiones del usuario (2026-11-15) y valores fijados al implementar:

- **Pago mixto con boleta:** las líneas se reparten en proporción al monto de cada documento. La cantidad lleva 2 decimales y el último documento absorbe el redondeo. Un pago mixto da dos documentos (48 + 39); el neto de cada uno es proporcional y el IVA es `monto − neto`, de modo que el asiento cuadra.
- **Pago único:** el movimiento se asocia al documento cuyo monto paga, no siempre al principal.
- **Venta de total cero:** igual genera un documento (toda venta se registra).
- **Anticipos:** si al dividir un documento los anticipos sin vincular superan su monto, se rechaza («Los anticipos de la orden superan el monto del documento; regístrelo sin dividir.»).
- **Histórico:** se cuadra desde una fecha configurable (`fiscal_match_start_date`). Los documentos anteriores no se evalúan ni se modifican.
- **Ventana TUU:** 15 minutos. **Tolerancia de monto:** 0 (CLP enteros). **«Total parecido»** para completar borradores: diferencia ≤ 2 %.
- **Boleta exenta con terminal integrado:** queda como 41 y no se convierte en 48. Si TUU dice 48, el cuadre la marca `TYPE_DIFF`.
- **TUU, competidores en el borde de la ventana:** ventas anteriores a la fecha de inicio pero dentro de la ventana siguen compitiendo; ante duda el resultado es `AMBIGUOUS`, nunca un vínculo erróneo.
- **Facturas ya vinculadas fuera de la corrida:** no se reasignan (ni las manuales ni las automáticas de otra corrida).
- **RCV, claves duplicadas:** si hay más de un documento ERP con la misma clave fiscal, el resultado es `AMBIGUOUS`.
- **Notas de crédito:** se comparan por monto absoluto. El signo no está verificado con datos reales del SII.
- **Permisos:** todos los endpoints de cuadre exigen `tax.change_taxperiod`; el reporte (`GET`) exige `tax.view_taxperiod`.
- **Compuerta F29:** `fiscal_mismatches` también se incluye en la respuesta de `calculate` del F29, porque el wizard lee esa respuesta.
- **D8:** `create-draft` vincula el borrador nuevo al RCV para que deje de aparecer como `ONLY_EXTERNAL` (sigue bloqueando el F29 como borrador). `confirm-draft` exige en el servidor el mismo RUT y el mismo tipo SII (`sii_code`) entre borrador y documento RCV, porque confirmar contabiliza de forma irreversible.

## Alternativas descartadas

- **Solo el registro local, sin RCV:** el F29 se calcula sin ver lo que el SII registra. Se pierden facturas de proveedores no registradas (crédito fiscal), errores de digitación y documentos no reconocidos.
- **Solo el RCV, sin el registro local:** no tiene líneas, costo, pagos, asientos ni relación con OV/OC. Tampoco trae boletas de compra y las boletas de venta solo vienen como resumen.
- **Mantener los tres registros sin vínculo (estado actual):** el RCV y TUU quedan como pantallas para mirar y el cuadre se hace a ojo.
- **Corregir automáticamente `dte_type` con el `document_type` de TUU:** viola ADR-0091 sobre documentos emitidos y oculta errores de operación. Se prefiere `TYPE_DIFF` más una corrección explícita.

## Consecuencias

- **Orden:**
  1. clave fiscal;
  2. documento de venta derivado del pago;
  3. cuadre TUU;
  4. cuadre RCV;
  5. compuerta F29;
  6. alimentación.

  La fase 2 va antes de los cuadres: si no, el primer cuadre de 39/48 sale mal por culpa del registro local.
- **Contratos que cambian:**
  - payload del checkout de venta (la clave sigue siendo `dte_type`, pero su significado pasa a ser la clase del documento: BOLETA, BOLETA_EXENTA, FACTURA, FACTURA_EXENTA);
  - excepción a ADR-0084 para 39/41/48 sin folio;
  - campos nuevos en `RCVDocument` y `TerminalSale`;
  - `status_check`.
- **Datos históricos:** las boletas ya registradas con folio inventado y las ventas con tarjeta registradas como 39 aparecerán como `TYPE_DIFF` o `ONLY_ERP` en el primer cuadre. El plan debe decidir si hacer una migración de limpieza o aceptar el histórico como está.
- **Preguntas abiertas del plan:**
  - líneas en documentos divididos por pago mixto: resuelta, proporcionales (ver «Resolución de preguntas abiertas»);
  - tamaño de la ventana de D4: resuelta, 15 minutos (ver «Resolución de preguntas abiertas»);
  - si TUU separa la transacción mixta igual que D3: **sigue abierta**, verificar con datos reales (el cuadre lo revelará como `ONLY_ERP`/`ONLY_EXTERNAL`);
  - tolerancia de redondeo en `AMOUNT_DIFF`: resuelta, 0 (ver «Resolución de preguntas abiertas»);
  - signo de las notas de crédito en el RCV: **sigue abierta**, se comparan por monto absoluto hasta verificar con datos reales del SII.
