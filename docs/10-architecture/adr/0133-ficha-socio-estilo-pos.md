---
id: 0133
title: La ficha de socio sigue el patrón de la ficha POS (6 pestañas, alertas del backend, acciones por pestaña)
status: Accepted
date: 2026-11-11
author: frontend-team
---

# 0133 — La ficha de socio sigue el patrón de la ficha POS

**Relacionado:** ADR-0080, ADR-0087, ADR-0118, ADR-0121, ADR-0132. Spec: `docs/superpowers/specs/2026-11-11-ficha-socio-estilo-pos-design.md`. Plan: `docs/superpowers/plans/2026-11-11-ficha-socio-estilo-pos.md`.

## Contexto

`PartnerDrawer` (ADR-0132) tenía 4 pestañas y todas las acciones vivían en el header y en un menú por fila de la lista. No avisaba qué requería atención ni permitía operar dentro de cada pestaña. La ficha de sesión POS (`POSSessionSheet`) ya resuelve ese problema: Resumen con alertas, KPIs y pestañas que responden preguntas distintas.

## Decisión

1. **Seis pestañas** (reemplazan la lista del ADR-0132): Resumen, Capital, Resultados y retiros, Distribuciones, Libro, Relaciones. «Participación» se fusiona en Capital.
2. **Alertas propiedad del backend.** `GET /contacts/{id}/partner_overview/` calcula los umbrales una vez y devuelve alertas (`code`, `severity`, `amount`, `target_tab`, `action`), KPIs, datos del socio y composición del patrimonio. El frontend no recalcula umbrales: mapea `action` a `run(...)`. Query count fijo, con test (ADR-0118). Reutiliza `_partner_metrics_map`; no define fórmulas nuevas.
3. **`placement` en `partnerActions`** (`"capital" | "results" | "menu"`). `buildPartnerActions` (`partnerActions.tsx`) sigue siendo la única fuente de acciones; `partnerActionsFor(partner, placement)` entrega a cada pestaña (o al menú «⋯» del header) solo las suyas. `transfer` pertenece a Capital con origen prellenado (`PartnerActionRequest { type: "transfer"; fromPartnerId?: number }`); la barra de la lista usa la misma acción sin origen.
4. **«Dar de baja» deshabilitada con motivo** (en vez de oculta). `demoteBlockedReason` se calcula en el frontend con los campos del socio.
5. **La lista de composición solo abre la ficha**: se elimina el menú por fila; la barra queda con «Añadir socio» (primaria) y «Transferencia» (secundaria).
6. **Relaciones** con el patrón `DocumentRelationsTab` y un nuevo tipo documental `contacts.partner` (proveedor en `contacts/relations.py`: contacto, asientos de sus movimientos, distribuciones en las que participa).
7. **Clasificación de movimientos.** Cada `PartnerTransaction.Type` se asigna a Capital, a Resultados o a una lista de omitidos (ledger-only: traspasos de aporte, préstamos, otros). La clasificación vive en `partnerMovement.entity` y un test la verifica contra `Type` del backend: un tipo nuevo sin clasificar rompe el test.

## Consecuencias

- **Extensión de infraestructura compartida (`core/documents`).** `DocumentType` gana `queryset` y `permission` opcionales, para que una segunda etiqueta (`contacts.partner`) resuelva al modelo `Contact` restringido a socios y use `contacts.view_contact`. `DocumentTypeRegistry.queryset_for(label)` es nuevo; sin `queryset` el comportamiento es el anterior. La etiqueta no se registra en `UniversalRegistry` (duplicaría la indexación de búsqueda y haría ambiguo `get_for_model`); `label_for(Contact)` sigue siendo `contacts.contact`. Un contacto que no es socio responde 404 bajo `contacts.partner`.
- **Extensión de tipo compartido.** `StructuredAction` y `ActionMenuItem` ganan `disabledReason?: string`; `DataCell.ActionMenu` lo muestra como segunda línea atenuada bajo la etiqueta e ignora los clics en ítems deshabilitados.
- **Limitación conocida (preexistente en core).** Mostrar un asiento contable en una lista de relaciones cuesta 2 queries extra por asiento (el `DocumentRef` del asiento lee los O2O inversos `sale_order` y `purchase_order`). El proveedor `contacts.partner` los precarga con `select_related`; otros proveedores que listen muchos asientos pueden tener el mismo N+1. No se corrige globalmente aquí.
- Las escrituras no cambian. `partners_summary` no se retira.
- No se verificó visualmente con datos reales en el momento de este ADR.
- **Verificación visual pendiente.** No se hizo la revisión visual de la ficha con datos reales; solo tests automatizados. Un contacto que no es socio responde 400 en `partner_overview` (404 si no existe).
