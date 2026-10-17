# Evaluación del sistema documental — informe final

> Entregable 6 · 2026-10-14 · Auditoría de solo lectura. Detalle en:
> [inventario](./documents-inventory.md) · [matriz](./document-relations-matrix.md) · [grafo](./document-graph.md) · [integridad](./document-integrity-findings.md) · [navegación](./document-navigation-audit.md) · [arquitectura objetivo](./target-document-architecture.md) · [plan](./document-migration-roadmap.md) · [decisiones](./document-decisions.md).
> Evidencia: C código · E ejecución en BD de test efímera · D datos demo del dev server (consultas SELECT).

## Resumen ejecutivo

El ERP tiene ~25 tipos documentales en modelos específicos por app, conectados mayoritariamente por FKs tipadas. Las piezas para una experiencia documental unificada **ya existen pero están dispersas** en 7 registros paralelos de identidad y navegación. El problema principal **no es de presentación**: varias relaciones centrales se escriben mal o no se escriben (cumplimiento de despachos, despacho→stock, stock→documento, factura→orden por GFK y pago→documento), así que ninguna UI puede mostrarlas correctamente. Se recomienda una arquitectura **híbrida**:

- un registro de tipos único (que extienda `UniversalRegistry`);
- un contrato `DocumentRef`/`DocumentLink`;
- un servicio de relaciones con proveedores por app sobre FKs normalizadas, sin tabla genérica;
- una ficha común con tabla de relacionados.

El orden propuesto es hotfix, luego integridad, después contratos y por último UI, con piloto en el ciclo de venta.

## 1. ¿Qué tipos de documentos existen?
- **Comerciales:** OV, despacho, devolución, OC, recepción, devolución de compra, factura (FACV/BOL/FACC/NC/ND según `dte_type`) y `NoteWorkflow`.
- **Producción:** OT.
- **Inventario:** documento de inventario, movimiento de stock y toma de inventario.
- **Tesorería:** movimiento, `PaymentAllocation`, cartola, lote de terminal, cheque, tarjetas y créditos.
- **Contabilidad e impuestos:** asiento, ejercicio y F29.
- **RRHH:** liquidación.
- **Socios:** transacciones y distribución de utilidades.

Solo 7 heredan de `TransactionalDocument`. → [inventario §2](./documents-inventory.md)

## 2. ¿Cómo se representan sus relaciones?
Hay 7 mecanismos: FK/O2O, GFK, pseudo-GFK de texto, texto libre, JSON, relaciones calculadas en selectores y emparejamiento heurístico. Las relaciones se exponen en 3 formatos incompatibles. Dos relaciones están duplicadas: factura→orden (FK + GFK) y pago→documento (FK + GFK + tabla). → [matriz](./document-relations-matrix.md), [grafo](./document-graph.md)

## 3. ¿Cuáles están bien y cuáles tienen problemas?
- **Bien:** OV/OC→despacho/recepción a nivel documento, OV→OT, recepción→cumplimiento por línea, documento→asiento (O2O) y asiento→origen (GFK, 0 colgantes), y reversión de asientos.
- **Rotas (E/D):**
  - `quantity_delivered` en despachos: 107/132 líneas en 0.
  - Despacho→stock move: 83/83 nulos.
  - Stock move→documento: 90 % sin vínculo.
  - Factura→orden por GFK: 168/168 vacío, y hay lógica de `post_invoice` que depende de él.
  - Pagado/pendiente: 3 cálculos distintos, uno con un atributo inexistente.
- **No validables con datos** (0 registros en dev): notas de crédito/débito, devoluciones y `PaymentAllocation`. → [integridad](./document-integrity-findings.md)

## 4. ¿Cómo navega hoy el usuario?
- **OV/OC:** se abren en el Order Hub (vista por fases), que es la única UI que muestra el grafo.
- **Resto de documentos:** drawers abiertos con `openEntity` o `?selected`, sin sección de relacionados; solo el asiento enlaza a su origen.
- **Despacho y recepción:** abren la entidad equivocada.
- **Hub de compras:** anula recepciones usando el id de un StockMove.
- **Vuelta atrás:** no existe (un solo slot de drawer).
- **Búsqueda global:** falla en 7 tipos porque sus rutas no existen.

→ [navegación](./document-navigation-audit.md)

## 5. ¿Qué componentes y patrones se reutilizan?
`openEntity` + `ENTITY_DRAWERS`, `SourceDocumentLink`, `EntityBadge`/`DataCell.Entity`, `useDrawerIdentity`, `ActivitySidebar`, `StatusBadge`, `PrintableLayout`, Order Hub (como vista de proceso), `JournalEntry.source_info` (semilla de `DocumentRef`), `UniversalRegistry`, `DocumentRegistry` y `workflow.Transition`.

## 6. Limitaciones estructurales
- Relaciones rotas en origen (INT-01…06).
- Factura sin líneas propias.
- Líneas de notas mezcladas con las líneas del pedido.
- Devoluciones sin FK a la línea de origen.
- Identidad y rutas repartidas en 7 registros, con 29 rutas inexistentes.
- Dos registros de drawers.
- Sin pila de navegación.

## 7. Arquitectura común recomendada
Híbrida: modelos específicos más `DocumentTypeRegistry` (que extiende `UniversalRegistry`), `DocumentRef`, y un `DocumentRelationService` con proveedores por app. La ficha es `DocumentDrawerShell` + `RelatedDocumentsTable`. La navegación usa `openEntity` con pila, la ruta canónica `lista?selected=id` generada por el registro y un resolvedor opcional `/d/{label}/{id}`. Quedan descartadas una tabla `Document` padre y una tabla genérica de relaciones. Requiere ADR-0080. → [arquitectura](./target-document-architecture.md)

## 8. ¿Qué primero y qué puede esperar?
1. **Hotfix:** GAP-07 (anulación de recepción por id incorrecto), GAP-04a (cálculo único de pagado) y GAP-05 (consumidores del GFK muerto).
2. **Integridad:** GAP-01, GAP-02 y GAP-03 con sus backfills.
3. **Contratos:** registro, `DocumentRef` y endpoint de relaciones.
4. **UI del piloto.**
5. **Facturación y pagos:** líneas de factura propias (GAP-13), líneas de NC/ND sobre la factura (GAP-14), ambas por la decisión D1, y fuente única de imputación.

Pueden esperar: FK de línea en devoluciones, grafo navegable y el log de transiciones completo. → [plan](./document-migration-roadmap.md)

## 9. Flujo piloto
Venta: **OV → despacho → factura → pago**, más asientos y stock. Es el flujo con más datos, el que concentra las roturas graves, ya tiene UI de proceso para comparar, y su simétrico en compras se migra después.

## 10. ¿Cómo se valida?
- Las consultas de integridad de este informe deben llegar a los umbrales definidos (p. ej. 0 OV DELIVERED con 0 entregado; ≤ 5 % de stock moves sin documento).
- El endpoint de relaciones debe resolver todas las relaciones del piloto con `unresolved` vacío.
- El pagado debe coincidir en las 3 vistas.
- El script de rutas debe dar 0 fallos.
- Tests de navegación OV→despacho→stock→asiento→volver.
- E2E de la búsqueda contra el backend real.
- El DoD del repo.

→ [plan §5](./document-migration-roadmap.md)

## Mapas de referencia
- Grafo documental actual: [document-graph.md §A](./document-graph.md)
- Matriz de relaciones: [document-relations-matrix.md](./document-relations-matrix.md)
- Mapa de navegación actual: [document-navigation-audit.md §1-4](./document-navigation-audit.md)
- Arquitectura objetivo: [target-document-architecture.md §6](./target-document-architecture.md)
- Registro de brechas: [document-migration-roadmap.md §1](./document-migration-roadmap.md)

## Decisiones (resueltas 2026-10-14)

Detalle, consecuencias e impacto en el plan: [document-decisions.md](./document-decisions.md).

| # | Decisión | Resultado |
|---|---|---|
| D1 | Relación factura ↔ orden | Coexisten 1:1, varias facturas por orden y 1 factura multi-orden. Por cantidad, atada a la entrega, NC/ND sobre líneas de factura, estado "Parcial" → **GAP-13 y GAP-14 pasan a P1** (fase M4, ADR propio) |
| D2 | Imputación de anticipos | Pago → factura; la orden se deriva. Anticipo no facturado sigue en la orden. `PaymentAllocation` con importe obligatoria |
| D3 | Backfill que reclasifica OV | Dry-run con informe + aprobación antes de aplicar |
| D4 | Ficha de OV/OC | El Order Hub es la ficha de OV/OC desde cualquier entrada; incorpora relacionados comunes y "volver" |
| D5 | Datos reales | Gate: `audit_document_integrity` antes de toda carga real (propuesta por defecto) |
| D6 | Flujos sin datos | Escenarios de prueba antes de M4 (facturación) y M5 (notas/devoluciones) (propuesta por defecto) |

## Verificación de coherencia (realizada)
- Los IDs INT-*, R* y GAP-* se referencian igual en todos los informes.
- Cada afirmación de defecto indica su nivel de evidencia. Las hipótesis llevan marca **I** o **NV**: doble conteo de pagos, efecto sobre las NC y causa de los 21/34 nulos en recepciones.
- No se modificó código, esquema, datos ni configuración. Los artefactos auxiliares (`models_ast.py`, `routes_check.py`, `integrity_counts.py`, test de sondeo) quedaron en el scratchpad de la sesión, fuera del repo. Las consultas en el dev server fueron solo SELECT vía ORM.
