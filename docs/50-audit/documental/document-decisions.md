# Decisiones previas a la implementación (D1–D6)

> Registro de decisiones · 2026-10-14 · Responde a las "Decisiones pendientes" de [document-system-assessment.md](./document-system-assessment.md).
> D1–D4 las tomó el responsable del proyecto. D5–D6 son propuestas por defecto, aceptadas salvo objeción.
> Las consecuencias ya están reflejadas en el [plan de migración](./document-migration-roadmap.md) (§1 GAP-04, GAP-13 y §4).

| # | Decisión | Resultado | Estado |
|---|---|---|---|
| D1 | Relación factura ↔ orden | **Las tres modalidades coexisten**: 1 factura por orden, varias facturas por orden y 1 factura para varias órdenes. Facturación por cantidad, atada a la entrega, NC/ND sobre líneas de factura, estado "Parcial" (D1.1–D1.4) | Decidida |
| D2 | Imputación de anticipos | **Pago → factura; la orden se deriva** a través de la factura | Decidida |
| D3 | Backfill de `quantity_delivered` que reclasifica OV | **Informe previo (dry-run) + aprobación** antes de aplicar | Decidida |
| D4 | Qué se abre al abrir una OV/OC | **El Order Hub es la ficha de OV/OC** | **Revertida** por ADR-0083 (2026-10-15): ver D7 |
| D5 | Validación con datos reales | **Sí, como gate**: auditoría de integridad antes de cualquier carga real | Propuesta por defecto |
| D6 | Escenarios para notas/devoluciones/imputaciones | **Sí**: fixtures de prueba antes de M4/M5 | Propuesta por defecto |
| D7 | Etapa UI: despliegue de la ficha documental | **Piloto en la OV** (U2), luego OC, facturas y resto | Decidida (2026-10-15) |
| D8 | Orientación de los tabs de la ficha | **Horizontales** (`TabBar` `underline`) | Decidida |
| D9 | Relaciones en la ficha | **Un único tab "Relaciones" agrupado por área**, con acciones por área | Decidida |
| D10 | Franja de ciclo (Origen → … → Tesorería) en OV/OC/facturas | **Se conserva** en la cabecera de la ficha | Decidida |
| D11 | POS | **Mantener vista incrustada** (ficha `embedded`) | Decidida |

---

## D1 · Factura ↔ orden: las tres modalidades

**Decisión.** La imprenta factura de las tres formas:
- una factura por orden;
- varias facturas parciales para una misma orden (por entrega o por avance);
- una factura que agrupa varias órdenes del mismo cliente.

**Situación actual (C).**
- `Invoice` tiene una FK simple `sale_order` / `purchase_order` (`billing/models.py:89-93`).
- Varias facturas por orden son posibles estructuralmente (`related_name="invoices"`), pero la factura **no tiene líneas propias**: `get_lines` devuelve las de la orden (INT-07). Por eso no puede expresar *qué* parte de la orden factura.
- Una factura con varias órdenes **no es representable**.

**Consecuencias.**
1. **GAP-13 deja de ser diferible.** Pasa de P2 a P1 y entra en la fase M4 (ver más abajo). Alcance:
   - `InvoiceLine` propia con FK a la línea de origen (`SaleLine` / `PurchaseLine`) y FK opcional a la línea de entrega (`SaleDeliveryLine` / `PurchaseReceiptLine`);
   - campos `quantity_invoiced` en la línea de la orden, igual que `quantity_delivered`;
   - la relación factura ↔ orden pasa a ser **N:M derivada de las líneas**. No se agrega una tabla N:M aparte.
2. **`Invoice.sale_order` / `purchase_order` se conservan** como "orden principal" (nullable) para compatibilidad y para el caso 1:1. Para una factura multi-orden quedan en NULL o apuntan a la primera, a decidir en el ADR. Las lecturas nuevas usan las líneas.
3. **Backfill**: para cada factura existente se crean líneas espejo de su orden. Es correcto porque hoy todas son 1:1 por construcción.
4. **El proveedor de relaciones de facturación** (GAP-09) se define desde el principio sobre "órdenes de la factura" y "facturas de la orden" como listas. Así la UI del piloto (M3) no cambia cuando GAP-13 sustituye la FK por las líneas.
5. **Requiere su propio ADR** (cambio de modelo de facturación, separado de ADR-0080).

### D1.1–D1.4 · Detalle de facturación (decidido 2026-10-14)

| # | Pregunta | Respuesta | Consecuencia de diseño |
|---|---|---|---|
| D1.1 | ¿Por cantidad, por % de avance o ambos? | **Por cantidad** | `InvoiceLine.quantity` sobre la línea de orden; `SaleLine`/`PurchaseLine.quantity_invoiced = Σ` líneas de factura no anuladas. Validación: `quantity_invoiced ≤ quantity`. No se modela facturación por porcentaje. |
| D1.2 | ¿La factura parcial se ata a una entrega concreta? | **Sí** | La FK de `InvoiceLine` a la línea de entrega (`SaleDeliveryLine`/`PurchaseReceiptLine`) es **obligatoria en facturas parciales** de productos entregables. Queda opcional para la factura de orden completa sin entrega previa y para líneas sin entrega (servicios). Validación: lo facturado contra una entrega no supera lo entregado en ella. Esto crea una relación nueva entrega → factura (no existe en la [matriz](./document-relations-matrix.md)) y hace que GAP-01/GAP-02 (M1) sean requisito de GAP-13. |
| D1.3 | ¿Las NC/ND referencian líneas de factura? | **Sí** | Las líneas de NC/ND pasan a apuntar a `InvoiceLine` en vez de a `SaleLine`/`PurchaseLine` vía `related_note`. Así **GAP-14 queda resuelto por el mismo modelo** y se ejecuta justo después de GAP-13 (M4), no en el bloque diferido. Validación: lo acreditado por línea no supera lo facturado. |
| D1.4 | ¿Qué estado tiene una OV facturada en parte? | **Parcial** | Propuesta: campo nuevo `invoicing_status` (PENDING / PARTIAL / INVOICED), simétrico a `delivery_status` (`sales/models.py:24-27`), calculado desde `quantity_invoiced`. El estado principal `INVOICED` pasa a significar "facturada por completo". La forma exacta (campo nuevo o nuevo valor en `Status`) se fija en el ADR; se recomienda el campo nuevo para no romper las transiciones actuales (`sales/models.py:193-196`). |

Escenarios D6 añadidos por estas respuestas: factura parcial atada a una entrega; intento de facturar más de lo entregado (debe fallar); NC parcial sobre una línea de factura; OV que pasa por PENDING → PARTIAL → INVOICED.

## D2 · Anticipos: pago → factura, orden derivada

**Decisión.** Mientras no hay factura, el pago se imputa a la orden. Al facturar, se re-imputa a la factura, y la orden se obtiene a través de la factura.

**Situación actual (C/D).** Es lo que ya hace el código: `billing/services.py:538-540` asigna `payment.invoice = invoice` y conserva `sale_order`. En dev hay 127 movimientos con ambas FK. La decisión formaliza ese comportamiento; no lo cambia.

**Consecuencias (combinadas con D1).**
- Con varias facturas por orden, un anticipo puede tener que **repartirse por importe** entre facturas. Con una factura multi-orden, una factura recibe anticipos de varias órdenes. Una FK simple no puede expresar ninguno de los dos casos.
- Por eso **`PaymentAllocation` con importe es obligatoria** como fuente única (GAP-04b). Regla:
  - la imputación apunta a la factura cuando existe;
  - el saldo de anticipo **no facturado** sigue imputado a la orden;
  - el pagado de la orden = imputaciones directas a la orden + imputaciones a sus facturas, en proporción a las líneas facturadas de esa orden.
- **Backfill de los 127 casos**: una allocation a la factura por el importe del movimiento. Ninguna a la orden, para evitar el doble conteo.
- GAP-04(b)(c) se ejecutan **junto con GAP-13** en la fase M4: el diseño de imputación depende del de líneas de factura.

## D3 · Backfill de cantidades despachadas: informe previo + aprobación

**Decisión.** Antes de aplicar el backfill de `quantity_delivered` (GAP-01):
1. Un comando en modo dry-run lista cada OV cuyo estado de entrega cambiaría (p. ej. `DELIVERED → PARTIAL`), con la diferencia por línea.
2. El responsable revisa y aprueba.
3. Se aplica en el mismo lote revisado; los valores previos quedan en `simple_history`.

**Consecuencias.**
- GAP-01 incluye un comando de gestión con `--dry-run` por defecto y `--apply` explícito.
- El mismo patrón se usa en los backfills de GAP-02, GAP-03, GAP-04(b) y GAP-13: informe de cambios y de ambiguos primero, aplicación después.
- Hoy no hay producción, así que el riesgo es bajo. La regla queda establecida para cuando haya datos reales (ver D5).

## D4 · El Order Hub es la ficha de OV/OC

**Decisión.** Cualquier punto de entrada (lista, búsqueda, `openEntity`, enlace de relacionado) que abra una OV u OC muestra el **Order Hub**.

**Situación actual (C).**
- `?selected` en la lista ya abre el Hub (`SalesOrdersPageClient.tsx:27-28`).
- `openEntity('sales.saleorder')` abre `SaleOrderDrawer`, una segunda ficha delgada y sin relacionados.

**Consecuencias.**
- En `ENTITY_DRAWERS`, `sales.saleorder` y `purchasing.purchaseorder` abren el Hub (`openHub`) en lugar del drawer delgado. `SaleOrderDrawer` y `PurchaseOrderDrawer` se retiran cuando tengan 0 consumidores (fase M6, política de [deprecación](../../30-playbooks/deprecate-feature.md)).
- El Hub incorpora:
  - la `RelatedDocumentsTable` común, alimentada por el endpoint de relaciones, sustituyendo poco a poco los buckets de `related_documents`;
  - la pila de navegación (GAP-11): desde un relacionado abierto en el Hub se puede volver.
- `DocumentDrawerShell` aplica al resto de documentos (despacho, factura, pago, stock, asiento…). OV/OC son la excepción documentada: su ficha es una vista de proceso.
- La ruta canónica de OV/OC sigue siendo `lista?selected=id`, que ya abre el Hub. No hace falta cambiar rutas.
- Se documenta en ADR-0080 como parte del contrato de fichas.

## D7–D11 · Etapa UI: ficha documental (2026-10-15)

Respuestas del responsable a las decisiones abiertas de [ui-document-sheet-plan.md](./ui-document-sheet-plan.md) §5. Formalizadas en ADR-0083, que **revierte D4**: el Order Hub deja de ser la ficha de OV/OC y se retira por completo (U6).

- **D7 · Piloto en la OV.** La OV abre su ficha documental desde todos los puntos de entrada; OC y facturas siguen en el Hub hasta U3.
- **D8 · Tabs horizontales** (`underline`, precedente `ContactDrawer`).
- **D9 · Un solo tab Relaciones** agrupado por área (Origen, Facturación, Producción, Logística, Tesorería, Contabilidad, Otros). El área la declara el backend (`DocumentRef.domain`).
- **D10 · Franja de ciclo** con pasos, avance y cifras clave; pulsar un paso filtra Relaciones.
- **D11 · POS con vista incrustada**: `OrderSheet embedded` reemplaza al `OrderHubPanel` incrustado.

## D5 · Validación con datos reales (propuesta por defecto)

**Propuesta.** Las cifras de la auditoría son de datos demo. Antes de la primera carga de datos reales (puesta en marcha o migración desde la base legacy):
- se ejecuta la auditoría de integridad documental. El script del scratchpad (`integrity_counts.py`) se incorpora en M1 como comando de gestión de **solo lectura** (`audit_document_integrity`);
- su salida debe cumplir los umbrales de [plan §5](./document-migration-roadmap.md). Si no los cumple, la carga o la puesta en marcha se detiene.

Esto se convierte en un paso fijo del checklist de puesta en marcha.

## D6 · Escenarios de prueba para flujos sin datos (propuesta por defecto)

**Propuesta.** Notas de crédito/débito, devoluciones y `PaymentAllocation` tienen 0 registros en dev. Antes de tocarlas, se crean escenarios reproducibles (factories de pytest más un comando opcional para sembrarlos en dev):
- **Antes de M4**: facturación parcial (2 facturas para 1 OV), factura multi-orden (1 factura para 2 OV), anticipo repartido entre facturas, pago anulado. Son los casos de D1/D2.
- **Antes de M5**: NC total y parcial, ND, devolución de venta y de compra, recepción sin stock move.

Cada escenario debe resolver sus relaciones con `unresolved` vacío y saldos coherentes en las tres vistas.

---

## Impacto en el plan

| Fase | Antes | Después de D1–D6 |
|---|---|---|
| M0 Hotfix | GAP-07, GAP-04(a), GAP-05 | Sin cambios |
| M1 Integridad | GAP-01, 02, 03 | + backfills con dry-run/aprobación (D3) + comando `audit_document_integrity` (D5) |
| M2 Contratos | ADR-0080, `DocumentRef`, registro, endpoint | + proveedor de facturación con relación N:M desde el inicio (D1); contrato de ficha con excepción Hub para OV/OC (D4) |
| M3 UI piloto | Fichas y pila en el piloto | + `openEntity` de OV/OC abre el Hub; `RelatedDocumentsTable` dentro del Hub (D4) |
| M4 | Pagos (GAP-04 b/c) | **Facturación y pagos**: ADR propio + GAP-13 (por cantidad, atada a entrega, `invoicing_status`) + GAP-14 (NC/ND sobre líneas de factura) + GAP-04(b)(c), con escenarios D6 previos |
| M5 Extensión | Otros módulos | + escenarios de devoluciones (D6) antes de GAP-15 |
| M6 Retiro | Legacy | + retiro de `SaleOrderDrawer`/`PurchaseOrderDrawer` (D4) |
