---
id: 0090
title: Documentos comerciales — un solo tab Documentos por módulo, con cada lista sobre su propia entidad
status: Accepted
date: 2026-10-20
author: frontend-team
---

# 0090 — Documentos comerciales — un solo tab Documentos por módulo, con cada lista sobre su propia entidad

**Related:** ADR-0089 (fin del módulo Facturación), ADR-0080 (documentos y rutas canónicas), ADR-0083 (ficha documental en la lista), ADR-0086 (drilldown canónico), contratos [document-relations.md](../../20-contracts/document-relations.md) y [module-layout-navigation.md](../../20-contracts/module-layout-navigation.md).

## Context

ADR-0089 fusionó Facturación en Ventas/Compras y dejó un tab "Documentos" por módulo. La estructura resultante, sin embargo, seguía arrastrando el diseño anterior en dos frentes:

**1. Tabs que no representan una entidad.** En Ventas, el tab de nivel 1 "Órdenes de Venta" agrupaba cuatro pantallas que resultaron ser la **misma lista reutilizada** con distinto envoltorio:

| Sub-tab | Ruta | Qué renderizaba |
|---|---|---|
| Órdenes de Venta | `/sales/orders` | `SalesOrdersView viewMode="orders"` |
| Notas de Crédito y Débito | `/sales/orders/notes` | `SalesOrdersClientView viewMode="notes"` |
| Guías de Despacho | `/sales/orders/deliveries` | `viewMode="orders"` + `DeliveryDrawer` |
| Devoluciones | `/sales/returns` | `viewMode="notes"` + `UnifiedNoteWizard` |

Es decir: "Notas" y "Devoluciones" eran la misma lista con otro wizard encima, y "Guías de Despacho" listaba **órdenes**, no entregas. En Compras ocurría lo mismo (`/purchasing/notes` → `PurchaseOrdersView viewMode="notes"`), y las entidades `sales.saledelivery`, `sales.salereturn`, `purchasing.purchasereceipt` y `purchasing.purchasereturn` **no tenían vista de lista propia** (dos de ellas figuraban en el ratchet `KNOWN_BROKEN_LIST_URLS`). Las notas NC/ND no son entidad propia: son `billing.invoice` con `dte_type` NC/ND, ya absorbidas por DTE en ADR-0089.

**2. Configuración DTE fuera de lugar.** ADR-0089 dejó la configuración de documentos DTE como sub-tab *de Documentos*. Pero la configuración no es un documento: su lugar natural es el grupo de Configuración del módulo.

Además, Compras **no tenía tab de Configuración** de nivel 1 (a diferencia de Ventas, que ya tiene `/sales/settings/**`), así que su configuración DTE quedaba huérfana.

## Decision

1. **Cada módulo comercial tiene un solo tab de nivel 1 "Documentos"** que contiene todas las listas documentales, cada una **sobre su propia entidad**:

   | Módulo | Sub-tabs de Documentos | Entidad listada |
   |---|---|---|
   | Ventas | Órdenes de Venta | `sales.saleorder` |
   | Ventas | DTE de Ventas | `billing.invoice` (emitidas) |
   | Ventas | Guías de Despacho | `sales.saledelivery` |
   | Ventas | Devoluciones | `sales.salereturn` |
   | Compras | Órdenes de Compra | `purchasing.purchaseorder` |
   | Compras | DTE de Compras | `billing.invoice` (recibidas) |
   | Compras | Recepciones | `purchasing.purchasereceipt` |
   | Compras | Devoluciones | `purchasing.purchasereturn` |

2. **Se elimina el tab de nivel 1 "Órdenes de Venta"** (y el "Órdenes de Compra" y "Notas de Crédito y Débito" de Compras). Sus contenidos pasan a Documentos, ya sin la duplicación: las notas NC/ND **no** son un sub-tab propio — se ven dentro de DTE (que ya las incluye por `dte_type`) y como acción desde la factura de origen.
3. **La OV/OC se trata como un documento comercial más**, hermano de la factura: la cadena OV → entrega → factura → pago se navega desde el mismo tab.
4. **La configuración DTE baja al grupo de Configuración**: `/sales/settings/dtes` (emitir) y `/purchasing/settings/dtes` (recibir). Se crea el **tab de nivel 1 "Configuración de Compras"** en Compras, con la configuración DTE como primer sub-tab. Mismo endpoint de PATCH parcial, sin migración.
5. **Las cuatro listas nuevas se construyen con el patrón canónico** `defineEntity` + `useEntityCollection` + `Collection.Root` (no con la lista de órdenes): entidad de cabecera propia, `unifiedSearchDef`, hook paginado, y ficha vía `useDocumentSheetRoute` (los drawers ya estaban registrados en `ENTITY_DRAWERS`).
6. **Los returns ganan filtros y orden en backend.** `SaleReturnViewSet` y `PurchaseReturnViewSet` no declaraban `filter_backends` ni `ordering_fields`; se añade un `FilterSet` por entidad (mismo patrón que `SaleDeliveryFilter`/`PurchaseReceiptFilter`) para que la vista de devoluciones sea coherente con el resto.
7. **Corte limpio**: las rutas viejas (`/sales/orders/notes`, `/sales/orders/deliveries`, `/purchasing/notes`, y los `list_url` rotos `/sales/deliveries` / `/purchasing/receipts`) desaparecen sin redirects, coherente con ADR-0089.

## Consequences

- `sales.saledelivery` y `purchasing.purchasereceipt` salen del ratchet `KNOWN_BROKEN_LIST_URLS` (sus `list_url` pasan a apuntar a rutas reales).
- Los `detail_url_pattern` de las 4 entidades ya apuntan al resolvedor `/d/{label}/{id}` (ADR-0080) — no cambian; solo se estrena la lista.
- El `UnifiedNoteWizard` **no desaparece**: sigue siendo la acción de crear NC/ND desde una factura. Lo que desaparece es su uso como *lista* de un sub-tab.
- `useSelectedEntity` sigue existiendo para otros consumidores; los hosts de entregas/devoluciones migran al patrón `useDocumentSheetRoute`.
- Compras gana su primer tab de Configuración: cualquier setting de compras futuro tiene dónde vivir.

## Alternatives considered

| Alternativa | Por qué no |
|---|---|
| Mantener las listas de órdenes reutilizadas y solo renombrar sub-tabs | Es el defecto que este ADR corrige: la página promete una entidad y muestra otra |
| Listar `billing.invoice` filtrado como "Devoluciones" en vez de `sales.salereturn` | NC/ND no son devoluciones: una devolución puede o no generar nota, y la NC es un documento tributario, no logístico |
| Dejar la config DTE dentro de Documentos | La configuración no es un documento; mezcla navegación operativa con administración |
| No añadir filtros a los returns (solo paginación) | Incoherente con las demás listas documentales y deja la vista sin búsqueda |
