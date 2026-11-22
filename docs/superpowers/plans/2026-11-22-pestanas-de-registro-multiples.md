# Plan — Pestañas de registro múltiples por entidad (ADR-0152, issue #260)

**Objetivo:** abrir dos registros de una misma entidad deja dos pestañas, con título identificable; `?selected` queda solo como enlace profundo.
**Contratos:** ADR-0152 (este plan lo ejecuta), ADR-0101, ADR-0028, `component-entity-drawers.md`.
**DoD por oleada:** `npm run type-check`, `npm run lint`, tests del alcance tocado, invariantes globales (zero `any`, imports por barrel, hooks en `features/*/hooks`). Sin tocar backend.

## Oleada 0 — Infraestructura (sin migrar vistas)

Prerrequisito de todo lo demás; no cambia comportamiento visible.

1. **Títulos:** sin campo nuevo; se reutiliza `formatEntityDisplay`/`shortTemplate` (ya lo usa `entityTabLabel`). Auditar los `shortTemplate` de las 40 etiquetas y ajustar los que den solo `{id}` donde la identidad útil sea un nombre (Contactos se ajusta en la Oleada 1).
2. **`openEntity` recibe `data` de la fila** (ya soportado); sin cambios de API.
3. **Desambiguación de títulos iguales** en `WorkspaceTabBar` (` (2)`, ` (3)`), calculada en `tabView`.
4. **`useDeepLinkEntity(label, options?)`** (`hooks/`): lee `?selected`/`?action`, llama `openEntity` una vez al montar y limpia el parámetro con `router.replace`. Cubre el caso `?action=view` con `variant` cuando aplique. Idempotente ante re-render (ref).
5. **Prueba de contrato** (`lib/__tests__/`): toda etiqueta usada en `EntityPanelTab` sin `variant` y con `id` de registro debe existir en `ENTITY_DRAWERS`; con lista de excepciones (ratchet) que baja por oleada, como el ratchet de entity-view.
6. **Tests:** `GlobalModalProvider` — abrir `contacts.contact:1` y `:2` deja dos pestañas; reabrir `:1` solo la activa; título duplicado se desambigua. `useDeepLinkEntity` abre una vez y limpia la URL.
7. **Documentación:** ADR-0152 a *Accepted* al cerrar la oleada piloto (no antes).

**Salida:** infraestructura mergeada; ratchet creado con las ≈12 etiquetas no registradas listadas.

## Oleada 1 — Piloto: Contactos (el caso del issue)

`ContactsClientView`, `contacts.contact`, `contacts.partner` y `PartnersClientView`.

1. Fila → `openEntity` (quitar `openSelected`); `useDeepLinkEntity("contacts.contact")` en la vista.
2. Mantener `EntityPanelTab` solo para `?modal=new`.
3. Verificar que `ContactDrawer` en `ENTITY_DRAWERS` cubre lo que hoy recibe de la vista (props, `onSuccess`, invalidación); ajustar el registro si falta.
4. `CreditPortfolioClientView` queda **fuera**: sus paneles `credit`/`ledger` son `variant` (decisión 3), solo se revisa que no choquen de clave.
5. Verificación en navegador (Node 24 + dev server): abrir cliente A, volver a la lista, abrir B → dos pestañas; recargar con `?selected=A` abre una; guarda con cambios sin guardar; resaltado de fila tras guardar.
6. **Gate de la oleada:** 3 flujos manuales + tests de vista actualizados. Decide si el ADR pasa a *Accepted* y si el montaje persistente hace falta (medir pérdida de estado al alternar pestañas de edición).

## Oleada 2 — Entidades ya registradas, módulos de datos maestros

Etiquetas ya en `ENTITY_DRAWERS`; mecánica idéntica a la piloto, una PR por módulo:

- **Inventario:** `product`, `category`, `warehouse`, `uom`, `attribute`, `pricingrule`, `stockmove`.
- **RR. HH.:** `employee`, `absence`, `salaryadvance`, `payroll`.
- **Configuración:** `core.user`, `settings.group`.
- **Contabilidad:** `account`, `journalentry`, `rcvdocument`, `rcvimport`.

Cada PR: migrar la vista, borrar `useSelectedEntity` redundante, actualizar el test, bajar el ratchet.

## Oleada 3 — Tesorería, producción y entidades que requieren registrar el drawer

Primero **registrar** en `ENTITY_DRAWERS` (con carga por `id` y `shortTemplate`), luego migrar:

- **Tesorería:** `treasuryaccount`, `treasurymovement`, `terminal*` (batch, sale, syncrun, device, provider, `terminal`), `bankmovement`, `bank`, `bankloan`, `paymentmethod`, `cardpendingcharge`.
- **Otros sin registro:** `accounting.budget`, `tax.taxperiod`, `production.bom`, `inventory.uomcategory`, `inventory.subscription`, `inventory.inventorycount`.
- `production.workorder` y `contacts.profitdistributionresolution` ya están registrados; entran aquí por su cercanía al flujo.

Riesgo principal: drawers que hoy reciben contexto de la vista (filtros de periodo, terminal seleccionado). Inventario previo por drawer; el dato viaja en `data` o el drawer lo resuelve por sus hooks.

## Oleada 4 — Retiro de lo antiguo y documentación

1. Borrar los usos restantes de `useEntityPanelRoute` para registros (queda solo creación / `variant`); renombrar o recortar el hook a `useCreatePanelRoute` si es lo único que sobrevive.
2. Deprecar `openSelected/openView/openAction` para registros en `useEntityRouteActions`; limpiar `searchableEntityRoutes`, notificaciones y búsqueda global que generan `?selected=`.
3. Contratos: `component-entity-drawers.md`, `module-layout-navigation.md` §2.1.1, `add-feature.md`, `add-settings-panel.md`, ADR-0020 (nota) y ADR-0101 (§6, §12 *superseded*). Ratchet de la oleada 0 en cero y eliminado.
4. Decisión documentada sobre montaje persistente de pestañas (sí/no) con los datos de uso.

## Orden y dependencias

`0 → 1 (gate) → 2 (módulos en paralelo) → 3 → 4`. La Oleada 3 puede empezar por las entidades ya registradas de tesorería mientras se registran las demás. Cada oleada es mergeable por sí sola: mientras una vista no migra, convive con el modelo de reemplazo.

## Riesgos transversales

| Riesgo | Mitigación |
|---|---|
| Drawer del registro no equivale al de la vista | Inventario previo por entidad; test de render del drawer por `id` sin `data` |
| N+1 / carga extra al abrir por `id` | Reutilizar `data` de la fila como arranque; detalle por endpoint de retrieve existente (invariante 14) |
| Pérdida de estado al alternar pestañas de edición | Guarda de cambios existente; medir en la Oleada 1 antes de decidir montaje persistente |
| Enlaces antiguos `?selected=` | `useDeepLinkEntity` mantiene compatibilidad |
| Tests que asumen `?selected` | Se actualizan junto a cada vista; ratchet impide regresiones |
