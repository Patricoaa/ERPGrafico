---
id: 0152
title: Un registro = una pestaña — las filas abren pestañas por `openEntity` (varias por entidad); `?selected` pasa a ser solo enlace profundo
status: Accepted
date: 2026-11-22
author: frontend-team
---

# 0152 — Pestañas de registro múltiples por entidad

**Relacionado:** ADR-0101 (barra de trabajo; este ADR reemplaza sus decisiones 6 y 12), ADR-0020 (`?selected`; queda como enlace profundo), ADR-0028 (registro de drawers), ADR-0086 (navegación canónica de documentos), ADR-0087 (entity-view). Issue #260.

**Estado:** Accepted (2026-11-26). La verificación en navegador sigue siendo obligatoria antes de merge, pero ya no condiciona el estado del ADR.

## Contexto

La barra de trabajo (ADR-0101) presenta pestañas al estilo navegador. Hoy hay **dos mecanismos** para abrir un registro como pestaña, con comportamientos opuestos:

| Mecanismo | Clave de pestaña | Varias de la misma entidad |
|---|---|---|
| `openEntity(label, id)` → `ENTITY_DRAWERS` (ADR-0028) | `label:id` | **Sí** |
| Drawer montado por la página (`useEntityPanelRoute` + `EntityPanelTab`, decisión 12) | `panel:label[:variant]:id` | **No**: el estado vive en un único `?selected` |

En el segundo, abrir otra fila cambia `?selected`, el panel anterior se desmonta y su pestaña se elimina (ADR-0101 §6: "choosing another row replaces it"). El comportamiento viene del modelo previo de panel de vista previa; con pestañas el usuario espera lo contrario (#260): abrir dos clientes deja dos pestañas. El segundo comentario del issue añade que las pestañas deben llevar un sufijo identificable (hoy `{Entidad} #{id}`), igual que las de `openEntity` con `display`.

Alcance medido (2026-11-22): 39 vistas usan `useEntityPanelRoute`, 40 etiquetas distintas pasan por `EntityPanelTab` (≈28 ya están en `ENTITY_DRAWERS`, ≈12 no) y 81 archivos tocan `?selected` / `openSelected` / `useSelectedEntity`.

## Decisión

1. **Abrir un registro desde una lista = `openEntity`.** El clic de fila de toda `Collection` (y toda acción "abrir/editar" de una fila) abre una pestaña por `label:id` vía el registro de drawers. Abrir uno ya abierto lo activa; abrir otro **añade** pestaña. El tope de 8 y la regla de origen (ADR-0101 §3, §5) no cambian.
2. **Los drawers de edición/vista viven solo en `ENTITY_DRAWERS`.** El drawer carga su registro por `id` (con `data` de la fila como arranque opcional, como hoy en ADR-0028). Una vista no vuelve a montar su drawer de edición ni a leer `?selected` para ello.
3. **`EntityPanelTab` queda solo para paneles que no son "un registro por id":** creación (`?modal=new`, `id = null`; una sola a la vez, por diseño) y paneles con `variant` que son acciones sobre un registro (`credit`, `ledger`, `invoice`, `disburse`…). Su clave sigue incluyendo `variant`.
4. **`?selected` es enlace profundo, no estado.** Al cargar una página con `?selected=<id>[&action=…]`, `useDeepLinkEntity(label)` abre **una vez** la pestaña (`openEntity`) y limpia el parámetro con `router.replace`. La URL no refleja las pestañas abiertas (coherente con ADR-0101 §9: las pestañas no se serializan). Los enlaces internos que generaban `?selected=` (`EntityBadge`, notificaciones, búsqueda global, `searchableEntityRoutes`) pasan a llamar `openEntity` o conservan el enlace profundo como compatibilidad.
5. **Título de pestaña = el display que ya define el registro.** `openEntity` resuelve el título con `formatEntityDisplay(label, data)` (`display_id` del backend o `shortTemplate` de `ENTITY_REGISTRY`/API: `OV-42`, `CON-12`) y los drawers lo refinan con `setEntityDisplay`; no se crea un campo nuevo. La fila pasa su `data` a `openEntity`. Entidades cuyo `shortTemplate` solo da `{id}` pero cuya identidad útil es un nombre (p. ej. contactos) ajustan su `shortTemplate` en el registro (`{name}`), de modo que fila, drawer, relaciones y pestaña usen el mismo texto. Sin plantilla cae a `{Entidad} #{id}`.
6. **Pestañas hermanas con el mismo título.** Si dos pestañas abiertas tienen el mismo título, la barra añade ` (2)`, ` (3)`.
7. **Cambios sin guardar:** sin cambios. Solo la pestaña activa está montada; cambiar de pestaña con un formulario sucio pasa por la guarda (ADR-0101 §7). Con varias pestañas de edición abiertas el estado de las inactivas se pierde al desmontar; el ADR **no** introduce montaje persistente (ver Consecuencias).
8. **Resaltado tras guardar (ADR-0101 §13)** se mantiene: la pestaña de entidad publica `SavedRecord` por `onSuccess`.
9. **`variant="execution"` es una acción sobre el registro, no su ficha.** En `/finances/budgets/list`, «Ver Ejecución» abre `EntityPanelTab` con `variant="execution"` y `display="Ejecución: <nombre>"`, montando `BudgetExecutionPanel` (`BaseModal` con métricas y exportación CSV). La fila y «Editar Montos» siguen abriendo `openEntity("accounting.budget", id)` (decisión 1). El deep link `?selected=<id>&action=execution` lo abre con `useCreatePanelRoute({ actions: ["execution"], create: false })`, mientras `useDeepLinkEntity(label, { actions: [null] })` impide que se abra también el editor.
10. **Simetría `replace` al abrir y cerrar.** La apertura del panel escribe la URL con `router.replace` y `close()` también usa `replace`: «Atrás» tras cerrar no reabre el panel. Aplica también al deep link de `hr.payroll`, que limpia `?selected` al abrir la pestaña.

## Alternativas descartadas

- **Mantener un drawer por página y un `Set` de ids abiertos (multi-`?selected`).** Obliga a cada vista a renderizar N drawers o a multiplexar uno, duplica el estado entre URL y provider y no resuelve el título. Contradice el invariante 13 (declarar una vez, componer por superficie).
- **Reemplazo solo con aviso.** Es la situación actual disfrazada: no cumple el modelo de pestañas.
- **Montar todas las pestañas abiertas a la vez** para conservar el estado. Requiere un Radix sheet por pestaña (ADR-0101, Consecuencias); costo alto sin evidencia de necesidad. Se reevalúa tras la Oleada 4 con uso real.

## Consecuencias

- **Una sola vía** para abrir un registro: desaparecen los pares `useEntityPanelRoute` + `useSelectedEntity` + drawer duplicado por vista (~39 vistas). `useEntityRouteActions.openSelected/openView/openAction` quedan deprecados para registros (permanecen para `?action=` de paneles `variant`).
- **Costo de registro:** ≈12 etiquetas aún no están en `ENTITY_DRAWERS` (`treasury.bankloan`, `treasury.bank`, `treasury.paymentmethod`, `treasury.cardpendingcharge`, `treasury.bankmovement`, `accounting.budget`, `tax.taxperiod`, `production.bom`, `inventory.uomcategory`, `inventory.subscription`, `inventory.inventorycount`, …). Registrarlas es prerequisito de su oleada.
- **Se pierde** que recargar conserve el registro abierto, salvo vía enlace profundo manual (`?selected`). El ADR-0101 ya aceptó que las pestañas no se serializan.
- **Contratos a actualizar:** `component-entity-drawers.md` (registro como única vía; título por `shortTemplate`), `module-layout-navigation.md` §2.1.1 (lista no reemplaza pestañas), `add-feature.md` y `add-settings-panel.md` (ya no montan drawer de edición en la vista), `ADR-0101` (decisiones 6 y 12 marcadas *superseded by 0152*), `ADR-0020` (nota: `?selected` solo enlace profundo).
- **Pruebas:** los tests de vistas que afirman `?selected` en la URL cambian a "clic en fila llama `openEntity(label, id)`"; los de drawers que mockean `useSelectedEntity` pasan a cargar por id.
- **Riesgo:** un drawer que hoy recibe props de la vista (filtros, callbacks de la página) pierde ese contexto en el registro. Cada oleada lo detecta en su inventario previo; si hay dependencia real, el dato viaja en `data` o el drawer lo resuelve por hooks propios.
