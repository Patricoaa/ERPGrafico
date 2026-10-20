---
id: 0089
title: Fin del módulo Facturación — las vistas DTE se mudan a Ventas y Compras
status: Accepted
date: 2026-10-20
author: frontend-team
---

# 0089 — Fin del módulo Facturación — las vistas DTE se mudan a Ventas y Compras

**Related:** ADR-0080 (documentos y rutas canónicas), ADR-0083 (ficha documental en la lista), ADR-0086 (drilldown canónico), contratos [document-relations.md](../../20-contracts/document-relations.md) y [module-layout-navigation.md](../../20-contracts/module-layout-navigation.md), playbook `docs/30-playbooks/deprecate-feature.md`.

## Context

El módulo "Facturación" existía en el riel como un tercer módulo con tres tabs: DTE de Ventas (`/billing/sales`), DTE de Compras (`/billing/purchases`) y Configuración de Facturación (`/billing/settings/dtes`). Pero la facturación no es un área de negocio separada: las DTE de ventas son la continuación natural de Ventas (OV/POS → factura/boleta) y las DTE de compras la continuación natural de Compras (OC → recepción y cuadratura de la factura del proveedor). La separación obligaba al usuario a saltar de módulo para ver los documentos que él mismo creó desde Ventas/Compras, y la navegación duplicaba concepts (ya existían "Notas de Crédito y Débito" como sub-tabs dentro de ambos módulos, mostrando *también* `billing.invoice`).

Del lado backend la fusión **no aplica**: `billing.Invoice` es un kernel compartido (tabla única con discriminador `is_sale_document()`, NC/ND compartidas, folios/series, estrategias DTE) consumido por ventas, compras, tesorería, impuestos, producción y workflow. Ese modelo se mantiene intacto (fuera de alcance).

## Decision

1. **Se elimina el módulo "Facturación" del riel** (`MODULE_REGISTRY`/`MODULE_ORDER`, `app/(dashboard)/billing/**`, `BillingHeader`, `features/billing/navigation.ts`).
2. **Cada módulo comercial gana un tab de nivel 1 "Documentos"** con sub-tabs `[lista, configuración]`:
   - Ventas: `/sales/dtes` (lista de DTE emitidas, ficha documental con `?selected=`, ADR-0083) y `/sales/dtes/settings` (tipos de documento habilitados para **emitir**).
   - Compras: `/purchasing/dtes` (lista/cuadratura de DTE recibidas) y `/purchasing/dtes/settings` (tipos de documento habilitados para **recibir**).
3. **La configuración DTE se parte en dos páginas**, una por módulo. Los campos (`allowed_dte_types_emit` / `allowed_dte_types_receive`) siguen en `accounting.AccountingSettings` y se guardan con PATCH parcial al mismo endpoint — sin migración de datos.
4. **La entrada side-agnostic para detalle (`billing.invoice`) pasa al resolvedor `/d/billing.invoice/{id}`** (ADR-0080). Es el mecanismo ya declarado: el buscador universal ya devolvía `/d/billing.invoice/{id}` (`DocumentTypeRegistry.url_for`, ver `test_search_detail_url_uses_canonical_url`); ahora el `detailUrlPattern` del registro de entidades y el `detail_url_pattern` de `UniversalRegistry` (backend) también. El resolvedor redirige a la lista con ficha (venta) o abre el drawer (compra), según ADR-0086.
5. **Corte limpio, sin redirects de compatibilidad** (decisión explícita del owner, excepción al playbook `deprecate-feature.md`). El mapa de rutas es la migración manual de favoritos/bookmarks:

   | Antes | Después |
   |---|---|
   | `/billing/sales` | `/sales/dtes` |
   | `/billing/sales/{id}` | `/sales/dtes/{id}` (redirect a `?selected=`) |
   | `/billing/purchases` | `/purchasing/dtes` |
   | `/billing/purchases/{id}` | `/purchasing/dtes/{id}` (redirect a `?selected=`) |
   | `/billing/invoices/{id}` | `/d/billing.invoice/{id}` (resolvedor) |
   | `/billing/settings/dtes` | `/sales/dtes/settings` (emit) · `/purchasing/dtes/settings` (receive) |
6. **Permisos**: se retira `view_dashboard_billing` del registro y de `sync_permissions` (tabs nuevos heredan el acceso del módulo contenedor). Los permisos de objeto (`billing.view_invoice`, `add`, `change`, `delete`) **no cambian** — siguen siendo del modelo.

## Consequences

- `features/billing` **se conserva como feature compartido** (barrel consumido por sales, purchasing, orders, notes — patrón ya usado por `features/notes`); solo desaparece su *shell* de módulo. Distribuir sus componentes hacia cada módulo es una limpieza futura opcional.
- Los registros de URL a actualizar en bloque (fallan en cadena los tests de contrato si se mueve una ruta sin actualizarlos): `lib/entity-registry.ts`, `lib/searchableEntityRoutes.ts`, `backend/billing/apps.py` (`list_url`/`detail_url_pattern`), `backend/billing/relations.py` (URL canónica de venta), `backend/inventory/services.py` (links de alertas).
- La etiqueta "Facturación" que aparece en el inbox de workflow (`HUB_BILLING`) es el nombre de una **etapa del proceso**, no del módulo — no cambia.
- Bookmarks y búsquedas guardadas a `/billing/*` dejan de resolver (corte limpio, punto 5).

## Alternatives considered

| Alternative | Why not |
|---|---|
| Mantener el módulo y solo re-etiquetar tabs | No resuelve el salto de contexto entre módulos |
| Fusionar también la app Django `billing` (partir el modelo Invoice) | ~200 referencias cruzadas, migraciones de content-types/`simple_history`, y NC/ND/folios/pagos son compartidos por naturaleza — costo altísimo, valor nulo |
| Redirecciones permanentes `/billing/*` → rutas nuevas | Elegido corte limpio por el owner; el mapa queda documentado arriba como migración manual |
| Split de settings en campos nuevos por módulo | Exigiría migración de datos y tocar consumidores (checkout POS, producción) sin beneficio |
