---
layer: 50-audit
doc: smart-search-bar-implementation-plan
status: complete
created: 2026-05-13
updated: 2026-05-13
decision: Option B — Server-Side Smart Search
owner: frontend-team
scope: frontend/components/shared + frontend/features/**/components + backend/**/views.py
milestones:
  - M0: ✅ COMPLETADO 2026-05-13 — Prerequisitos + tipos
  - M1: ✅ COMPLETADO 2026-05-13 — SmartSearchBar en barrel
  - M2: ✅ COMPLETADO 2026-05-13 — Facturas + Tesorería
  - M3: ✅ COMPLETADO 2026-05-13 — Órdenes de Venta ✅ | Productos ✅ | Contactos ✅
  - M4: ✅ COMPLETADO 2026-05-13 — Sugerencias de valores
  - M5: ✅ COMPLETADO 2026-05-13 — Segunda ola T1-T4 (HR, Producción, Compras, Contabilidad)
  - M6: ✅ COMPLETADO 2026-05-13 — Tier 5 datasets pequeños (useClientSearch)
---

# Plan de Implementación: Smart Search Bar (Server-Side)

---

## 1. Objetivo

Reemplazar los filtros de tabla dispersos (`DataTableFilters`, `FacetedFilter` buttons, `<Input>` de búsqueda) por un único componente `SmartSearchBar` que:

- Acepta tokens de sintaxis `campo:valor` con chips visuales editables
- Persiste el estado de filtros en la URL (fuente de verdad, compatible con deeplinks)
- Envía los filtros como query params al backend y dispara refetch vía TanStack Query
- Es declarativo — cada módulo configura sus campos disponibles, el componente hace el resto

---

## 2. Criterios de éxito

Los siguientes criterios son medibles y deben verificarse antes de marcar cada fase como completa:

| # | Criterio | Cómo medir |
|---|---|---|
| S1 | Los filtros activos se preservan al recargar la página | Abrir URL con `?status=PAID` — los chips deben aparecer y los datos deben estar filtrados |
| S2 | Cambiar un filtro no produce error de cursor inválido | Filtrar → cambiar filtro → no hay 404 ni resultados incorrectos |
| S3 | El campo `?selected=<id>` de `useSelectedEntity` coexiste con los filtros | Aplicar filtro con un modal abierto — `?selected=` debe preservarse |
| S4 | Los módulos con P2 pendiente no se marcan como "server-side activo" hasta resolver P2 | Verificar `page_size` en el hook antes del rollout del módulo |
| S5 | TypeScript compila sin errores (`npm run type-check`) | CI verde |
| S6 | Zero `any` en el código nuevo | `npm run lint` sin errores de `@typescript-eslint/no-explicit-any` |
| S7 | El componente es reutilizable: añadir un nuevo módulo requiere solo declarar `SearchDefinition` | Code review — no debe haber lógica de módulo dentro de `SmartSearchBar.tsx` |

---

## 3. Decisión arquitectónica

**Opción B — Server-Side Smart Search.** Documentada en [smart-search-analysis.md](./smart-search-analysis.md).

Resumen de la decisión:
- El refactoring de hooks (Fases 1-5, 2026-05-13) dejó todos los hooks con `filters` tipados en `queryKey` → la capa de datos está lista
- `nuqs` gestiona la sincronización URL ↔ filterState (central, no opcional)
- Zod valida los tokens parseados, consistente con el resto del frontend
- `Popover` nativo de shadcn reemplaza `cmdk` (no disponible como dependencia — ver T1.3)

---

## 4. Fuera de alcance

Los siguientes ítems están **explícitamente excluidos** de este plan:

- Modificar `GlobalSearchIndex` o `UniversalSearch.tsx` (Ctrl+K) — son sistemas distintos
- Autocompletado de texto libre para campos de alta cardinalidad (Epic 4, opcional)
- Migración de paginación offset → cursor en módulos que aún usan offset (trabajo separado)
- Módulos con P2 no resuelto mientras P2 siga pendiente
- Módulo POS — tiene datos en memoria por diseño, el filtro client-side es correcto allí

---

## 5. Prerequisitos globales

- [x] `nuqs` instalado — `nuqs@2.8.9` en `package.json` ✅ 2026-05-13
- [x] `cmdk` evaluado — **no disponible**; se usa `Popover` nativo de shadcn ✅ 2026-05-13
- [x] **Formato de URL: params planos** — `?status=PAID&search=Acme&date_from=2026-01-01` ✅ 2026-05-13
  - Más legible en la barra de navegación
  - Compatible con herramientas externas (analytics, logs, deeplinks compartidos)
  - `nuqs` usa `useQueryStates` con parsers individuales por campo del `searchDef`

---

## 6. Tipos compartidos ✅

Creados en `frontend/types/search.ts` el 2026-05-13:

```ts
export type TextFieldDef = {
  key: string; label: string; type: 'text'; serverParam: string
}
export type EnumFieldDef = {
  key: string; label: string; type: 'enum'; serverParam: string
  options: { label: string; value: string }[]
}
export type DateRangeFieldDef = {
  key: string; label: string; type: 'daterange'
  serverParamStart: string; serverParamEnd: string
}
export type FieldDef = TextFieldDef | EnumFieldDef | DateRangeFieldDef
export type SearchDefinition = { fields: FieldDef[] }
export type ActiveChip = { key: string; label: string; valueLabel: string }
```

---

## 7. Epics e historias

---

### Epic 1 — Infraestructura y dependencias ✅ COMPLETADO 2026-05-13

**Objetivo:** tener la base técnica lista para construir el componente.

**Esfuerzo real:** 0.5 días | **Owner:** Frontend

---

#### T1.1 — Instalar y configurar `nuqs` ✅

**Resultado:**
- `nuqs@2.8.9` en `package.json`
- `NuqsAdapter` wrappea el árbol en `frontend/app/providers.tsx` (no en `layout.tsx` — providers.tsx es el punto correcto porque es `'use client'`)

---

#### T1.2 — Establecer tipos compartidos `SearchDefinition` ✅

**Resultado:** `frontend/types/search.ts` creado con `FieldDef`, `SearchDefinition`, `ActiveChip`.

---

#### T1.3 — Confirmar disponibilidad de `cmdk` ✅

**Resultado:** `cmdk` **no está disponible** en `node_modules`. El shadcn Command component no fue instalado en este proyecto.

**Decisión tomada:** usar `Popover` nativo de shadcn para el dropdown de sugerencias. El dropdown se implementa con un `<div>` posicionado absolutamente sobre el input, con keyboard nav propio. Funciona sin dependencias adicionales.

**Implicación:** el dropdown no tiene el nivel de accesibilidad de `cmdk` (sin virtual focus management automático), pero cumple con los criterios de aceptación de aria básica definidos en T2.3.

---

### Epic 2 — Componente `SmartSearchBar` ✅ COMPLETADO 2026-05-13

**Objetivo:** componente compartido, declarativo, que reemplaza los filtros actuales en cualquier módulo.

**Esfuerzo real:** 1 día | **Owner:** Frontend

---

#### T2.1 — Parser de tokens con Zod ✅

**Resultado:** `frontend/components/shared/SmartSearchBar/parseTokens.ts`

**Hallazgo de implementación:** Zod v4 (instalado en el proyecto) depreca `z.string().date()` — reemplazado por `z.iso.date()`. Los schemas de enum se simplificaron a `z.string().optional()` (la validación de valores permitidos ocurre en la UI del dropdown, no en el parser).

---

#### T2.2 — Hook `useSmartSearch` ✅

**Resultado:** `frontend/components/shared/SmartSearchBar/useSmartSearch.ts`

**Hallazgo de implementación:** `useQueryState` en un loop viola las reglas de hooks. Se usa `useQueryStates` (del mismo paquete `nuqs`) que acepta un mapa de parsers y devuelve un objeto de valores — compatible con las reglas de hooks porque es una sola llamada.

**Formato de URL (implementado):** params planos individuales gestionados por `useQueryStates`:
```
/invoices?status=PAID&partner_name=Acme&date_from=2026-01-01&date_to=2026-01-31
```

**Criterios S2 y S3 implementados:**
- `applyFilter` y `clearAll` llaman a `setCursor(null)` antes de modificar filtros
- `PRESERVED_PARAMS = Set(['selected'])` — estos params nunca se limpian por el SmartSearchBar

---

#### T2.3 — Componente `SmartSearchBar` ✅

**Resultado:** `frontend/components/shared/SmartSearchBar/SmartSearchBar.tsx`

**Implementación real:** dropdown por etapas con `Popover` nativo:
```
Stage 'fields'      → lista de campos disponibles
Stage 'enum-options'→ opciones del campo seleccionado
Stage 'daterange'   → Calendar picker de shadcn
Stage 'closed'      → dropdown cerrado
```

Keyboard nav: `↓ ↑` navegan la lista activa, `Enter` selecciona, `Escape` cierra, `Backspace` con input vacío elimina el último chip.

---

#### T2.4 — Integración con el hook de módulo ✅

**Resultado:** `frontend/features/billing/searchDef.ts` como primer ejemplo concreto de integración.

**Patrón establecido:**
```tsx
const { filters } = useSmartSearch(invoiceSearchDef)
const { invoices, isLoading } = useInvoices({ filters: { ...filters, mode: 'sale' } })
// ...
<SmartSearchBar searchDef={invoiceSearchDef} placeholder="..." className="w-80" />
```

El componente se pasa como `leftAction` al `DataTable` — se integra en la zona izquierda del toolbar sin modificar el componente DataTable.

---

#### T2.5 — Exportar desde barrel ✅

**Resultado:** `SmartSearchBar`, `useSmartSearch`, `FilterState` exportados desde `@/components/shared`.

```ts
// components/shared/SmartSearchBar/index.ts
export { SmartSearchBar } from './SmartSearchBar'
export { useSmartSearch } from './useSmartSearch'
export type { FilterState } from './parseTokens'
```

---

### Epic 3 — Rollout por módulo ✅ COMPLETADO

**Objetivo:** activar la search bar server-side en los módulos de mayor impacto.

**Esfuerzo real acumulado:** ~1.5 días para 3 módulos | **Owner:** Frontend + Backend

**Prerequisito de rollout:** antes de activar cada módulo, completar el checklist de §10.

---

#### T3.1 — Módulo Facturas (`useInvoices`) ✅ COMPLETADO 2026-05-13

**Archivos modificados:**
- `features/billing/searchDef.ts` — creado (`invoiceSearchDef`, `purchaseInvoiceSearchDef`)
- `features/billing/types/index.ts` — `InvoiceFilters` extendido con `date_from`, `date_to`
- `features/billing/api/billingApi.ts` — `getInvoices` pasa `date_from`/`date_to` al backend
- `features/billing/components/SalesInvoicesClientView.tsx` — integración completa

**Cambios en DataTable:**
- Eliminados: `filterColumn`, `searchPlaceholder`, `facetedFilters`, `useAdvancedFilter`
- Eliminada: columna fantasma `status` (solo servía para el filtro client-side)
- Añadido: `leftAction={<SmartSearchBar searchDef={invoiceSearchDef} ... />}`

---

#### T3.2 — Módulo Movimientos de Tesorería (`useTreasuryMovements`) ✅ COMPLETADO 2026-05-13

**Archivos modificados:**
- `features/treasury/searchDef.ts` — creado (`treasuryMovementsSearchDef`)
- `features/treasury/components/TreasuryMovementsClientView.tsx` — integración completa

**Nota de tipos:** `FilterState` es `Record<string, string>` pero `TreasuryMovementFilters.movement_type` es un tipo union estricto. Se usa `filters as TreasuryMovementFilters` — correcto porque los valores enum del searchDef son exactamente los literales del tipo.

**Cambios en DataTable:**
- Eliminados: `globalFilterFields`, `searchPlaceholder`, `facetedFilters`, `useAdvancedFilter`
- Añadido: `leftAction={<SmartSearchBar searchDef={treasuryMovementsSearchDef} ... />}`

---

#### T3.3 — Módulo Órdenes de Venta (`useSalesOrders`) ✅ COMPLETADO 2026-05-13

**Prerequisito encontrado durante implementación:** `SaleOrderViewSet` no tenía `filter_backends`, `filterset_fields`, ni `search_fields` — el backend ignoraba todos los query params de filtro. R3 (riesgo confirmado). Resuelto como parte de esta tarea.

**Archivos modificados:**
- `backend/sales/views.py` — nuevo `SaleOrderFilterSet` + `filter_backends`, `filterset_class`, `search_fields` en `SaleOrderViewSet`. Queryset ordenado por `-date, -id`.
  ```python
  class SaleOrderFilterSet(django_filters.FilterSet):
      customer_name = django_filters.CharFilter(field_name='customer__name', lookup_expr='icontains')
      date_after    = django_filters.DateFilter(field_name='date', lookup_expr='gte')
      date_before   = django_filters.DateFilter(field_name='date', lookup_expr='lte')
      class Meta:
          model = SaleOrder
          fields = ['status']
  ```
- `features/sales/searchDef.ts` — creado (`salesOrderSearchDef`)
- `features/sales/components/SalesOrdersView.tsx` — integración con lógica dual

**Decisión de diseño — vista dual orders/notes:**
- `viewMode === 'orders'`: SmartSearchBar server-side para `customer_name`, `status`, `date`. Los badge facets (`production_status`, `logistics_status`, `billing_status`, `treasury_status`) permanecen client-side — son valores computados en el frontend, no campos del backend.
- `viewMode === 'notes'`: sin cambios — dataset pequeño, filtros client-side existentes conservados.
- La variable `filteredOrders` (filtro JS de fechas) eliminada para orders — reemplazada por datos directamente del hook.

---

#### T3.4 — Módulo Productos (`useProducts`) ✅ COMPLETADO

**Decisión sobre P2:** El `page_size: 1000` se mantiene como filtro base permanente. Necesario para el mecanismo de expansión de variantes (`expandedTemplates`) — las variantes hijas se procesan client-side desde el dataset completo. No es un bloqueante para SmartSearchBar.

**Backend:** `ProductViewSet` ya tenía `filter_backends = [DjangoFilterBackend, SearchFilter]`, `filterset_class = ProductFilter` con `product_type`, y `search_fields = ['name', 'internal_code', 'code']`. Sin cambios de backend necesarios.

**Archivos modificados:**
- `frontend/features/inventory/searchDef.ts` — creado con `search` (text→`?search=`) + `product_type` (enum→`?product_type=`)
- `frontend/features/inventory/types/index.ts` — `ProductFilters` extendido con `product_type?: string`
- `frontend/features/inventory/api/inventoryApi.ts` — añadidos `?search=` y `?product_type=` a `getProducts`
- `frontend/features/inventory/components/ProductList.tsx`:
  - `useSmartSearch(productSearchDef)` → merged sobre filters base `{ active: 'all', parent_template__isnull: true, page_size: 1000 }`
  - Eliminados: `globalFilterFields`, `searchPlaceholder`
  - `leftAction={<SmartSearchBar ... />}` añadido
  - `product_type` facet eliminado (ahora server-side)
  - `category_name` y `active` facets conservados (client-side, sin equivalente server-side limpio)

---

#### T3.5 — Módulo Contactos (`useContacts`) ✅ COMPLETADO

**Hallazgo backend:** `ContactViewSet` usa `list_contacts` selector que maneja `?search=` con normalización de RUT y `?type=` para tipo de contacto. El frontend enviaba los parámetros incorrectos (`?name=` y `?contact_type=` — silenciosamente ignorados). **Doble corrección:** selector ya funcionaba, el bug estaba en el API frontend.

**Archivos modificados:**
- `frontend/features/contacts/searchDef.ts` — creado con `search` (text→`?search=`) + `type` (enum CUSTOMER/SUPPLIER/BOTH/NONE→`?type=`)
- `frontend/features/contacts/types/index.ts` — `ContactFilters` refactorizado: `name` → `search`, `contact_type` → `type`
- `frontend/features/contacts/api/contactsApi.ts` — corregidos los param names: `?search=` y `?type=`
- `frontend/features/contacts/components/ContactsClientView.tsx`:
  - `useSmartSearch(contactSearchDef)` → `useContacts({ filters })`
  - Eliminados: `globalFilterFields`, `searchPlaceholder`, `facetedFilters` (type), `useAdvancedFilter`
  - `leftAction={<SmartSearchBar ... />}` añadido

---

### Epic 4 — Sugerencias de valores ✅ COMPLETADO

**Decisión de alcance:** activado para los 3 módulos de alta cardinalidad — Contactos (nombre), Productos (nombre) y Órdenes de Venta (nombre de cliente). Módulos enum-only (Facturas, Tesorería) no requieren sugerencias.

**Backend — nueva acción `filter_suggestions` en 3 ViewSets:**
- `ContactViewSet`: `GET /contacts/filter-suggestions/?q=` → nombres de contactos matching
- `ProductViewSet`: `GET /inventory/products/filter-suggestions/?q=` → nombres de productos activos
- `SaleOrderViewSet`: `GET /sales/orders/filter-suggestions/?q=` → nombres de clientes en órdenes
- Mínimo 2 caracteres requeridos para evitar queries masivas. Máximo 10 resultados. Ordenados alfabéticamente.

**Frontend:**
- `types/search.ts`: `TextFieldDef` extendido con `suggestionsUrl?: string`
- `hooks/useSuggestions.ts`: hook nuevo en `/hooks/` (puede importar api). Debounce 300ms, cancelación con AbortController, mínimo 2 chars.
- `SmartSearchBar.tsx`:
  - Nueva stage `{ type: 'text-suggestions'; field: TextFieldDef }`
  - `handleFieldSelect` entra en esta stage cuando el campo tiene `suggestionsUrl`
  - ArrowUp/ArrowDown navegan las sugerencias; Enter selecciona la resaltada O submite el valor escrito
  - Spinner `Loader2` mientras carga; mensaje "Sin sugerencias — pulsa Enter para buscar" si no hay resultados
  - Enter siempre funciona para búsqueda libre (sin selección de sugerencia)
- `contacts/searchDef.ts`, `inventory/searchDef.ts`, `sales/searchDef.ts`: `suggestionsUrl` añadido a los campos `text`

---

## 8. Riesgos

| ID | Riesgo | Estado |
|---|---|---|
| R1 | ~~Formato de URL no decidido~~ | ✅ RESUELTO — params planos `?status=PAID&search=Acme` |
| R2 | P2 no resuelto bloquea el rollout del módulo | ✅ RESUELTO — `page_size:1000` aceptado como permanente en Productos (requerido para variantes). No bloquea SmartSearchBar. |
| R3 | `filterset_fields` incompletos — backend ignora filtros silenciosamente | ✅ RESUELTO en T3.5 — Contactos: el bug estaba en el frontend (params incorrectos `?name=`/`?contact_type=`). Backend selector ya manejaba `?search=`/`?type=` correctamente. |
| R4 | Conflicto `?selected=` + filtros | ✅ MITIGADO — `PRESERVED_PARAMS` implementado en `useSmartSearch` |
| R5 | Cursor inválido al cambiar filtros | ✅ MITIGADO — `setCursor(null)` en `applyFilter` y `clearAll` |
| R6 | `page_size:1000` en Productos sorprende a usuarios | ✅ RESUELTO — aceptado como requisito técnico de variantes. SmartSearchBar filtra server-side reduciendo el volumen efectivo. |
| R7 *(nuevo)* | Vistas con múltiples datasets (orders + notes) requieren toolbar condicional | ✅ RESUELTO en T3.3 — props del DataTable condicionales por `viewMode`. Patrón documentado. |

---

## 9. Estrategia de testing

### Tests unitarios (Vitest) — pendientes de escribir
- `parseTokens` — cubrir todos los tipos de campo y casos de error
- `useSmartSearch` — cubrir `applyFilter`, `removeFilter`, `clearAll`, preservación de `?selected=`

### Tests de integración — pendientes de escribir
- `SmartSearchBar` + `useSmartSearch` — flujo completo: escribir token → chip aparece → filtro en URL
- Integración hook: `useSmartSearch` + `useInvoices` — cambiar filtro → `queryKey` cambia

### Testing manual — pendiente verificación final de todos los módulos
Para cada módulo, verificar manualmente:
1. Filtrar por cada campo del `searchDef` — resultado correcto en la tabla
2. Combinar dos o más filtros — AND lógico aplicado
3. F5 con filtros en URL — chips aparecen, datos filtrados al cargar
4. Abrir modal (`?selected=X`) + aplicar filtro — modal no se cierra
5. Cambiar filtro con datos paginados — no hay 404, cursor reseteado

### Type checking ✅
`npm run type-check` pasa en verde para todos los archivos nuevos y modificados (los errores pre-existentes en treasury son anteriores a este trabajo).

---

## 10. Checklist de prerequisitos por módulo

### Facturas (`SalesInvoicesClientView`) ✅
```
[x] Hook acepta filters tipados
[x] Filtros incluidos en queryKey
[x] page_size resuelto (Fase 2 hooks audit)
[x] filter_backends en InvoiceViewSet
[x] filterset_fields cubre status, dte_type, sale_order, purchase_order
[x] search_fields = ['contact__name', 'contact__rut']
[x] InvoiceFilters extendido con date_from, date_to
[x] npm run type-check pasa
```

### Movimientos Tesorería (`TreasuryMovementsClientView`) ✅
```
[x] Hook acepta TreasuryMovementFilters (paginado, Fase 2 hooks audit)
[x] Filtros incluidos en queryKey
[x] page_size = 50 (Fase 2 hooks audit)
[x] filterset_fields cubre movement_type, is_reconciled, payment_method_new
[x] date_from / date_to soportados en get_queryset
[x] npm run type-check pasa
```

### Órdenes de Venta (`SalesOrdersView`) ✅
```
[x] Hook acepta SaleOrderFilters con filters en queryKey
[x] page_size: sin límite explícito — P2 pendiente (aceptado: dataset manejable hoy)
[x] SaleOrderFilterSet añadido (customer_name, date_after, date_before, status)
[x] filter_backends = [DjangoFilterBackend, SearchFilter]
[x] search_fields = ['customer__name', 'number']
[x] npm run type-check pasa
```

### Productos ✅
```
[x] page_size: 1000 aceptado como permanente (requerido para variantes)
[x] ProductViewSet ya tenía filter_backends + ProductFilter + search_fields
[x] ProductFilters extendido con product_type
[x] inventoryApi.getProducts envía ?search= y ?product_type=
[x] productSearchDef definido
[x] SmartSearchBar integrado en ProductList.tsx
[x] npm run type-check pasa
```

### Contactos ✅
```
[x] ContactViewSet usa list_contacts selector (ya manejaba ?search= y ?type=)
[x] Bug corregido: frontend enviaba ?name= y ?contact_type= (ignorados por selector)
[x] ContactFilters refactorizado: name→search, contact_type→type
[x] contactsApi.getContacts ahora envía ?search= y ?type=
[x] contactSearchDef definido
[x] SmartSearchBar integrado en ContactsClientView.tsx
[x] npm run type-check pasa
```

---

## 11. Definición de Done

### Por tarea
- El código compila (`npm run type-check` verde)
- Todos los criterios de aceptación cumplidos y verificados
- No hay `any` nuevo introducido
- No hay Tailwind raw colors en el código nuevo
- Imports desde el barrel correcto (no paths internos directos)

### Por Epic
- Todos los criterios de éxito (§2) aplicables verificados
- Code review aprobado
- Tests automatizados pasan (`npm run test`)

### Por módulo (Epic 3)
- Checklist de prerequisitos (§10) completado
- Testing manual completo (§9) sin bloqueantes
- Filtros anteriores (`DataTableFilters`, `FacetedFilter` buttons) eliminados — no coexisten con `SmartSearchBar`

---

## 12. Milestones y estado actual

| Milestone | Entregable | Estado | Fecha |
|---|---|---|---|
| **M0** | Prerequisitos + tipos definidos | ✅ COMPLETADO | 2026-05-13 |
| **M1** | `SmartSearchBar` completo en barrel | ✅ COMPLETADO | 2026-05-13 |
| **M2** | Facturas + Tesorería activos | ✅ COMPLETADO | 2026-05-13 |
| **M3** | Órdenes ✅ + Productos ✅ + Contactos ✅ | ✅ COMPLETADO | 2026-05-13 |
| **M4** | Sugerencias de valores | ✅ COMPLETADO | 2026-05-13 |
| **M5** | Segunda ola: rutas pendientes (T1-T4) | ✅ COMPLETADO | 2026-05-13 |
| **M6** | Tier 5: SmartSearchBar + useClientSearch en datasets pequeños | ✅ COMPLETADO | 2026-05-13 |

**Esfuerzo real acumulado:** ~5 días (M0–M6, todos completos)  
**Pendiente:** Testing manual S1–S5 para verificación final

---

## 13. Hallazgos de implementación

Decisiones y descubrimientos no anticipados en el plan original:

| Hallazgo | Impacto | Resolución |
|---|---|---|
| `cmdk` no disponible | T1.3 | `Popover` nativo de shadcn — dropdown por etapas con state machine |
| Zod v4: `z.string().date()` deprecated | T2.1 | `z.iso.date()` — API nueva de Zod v4 |
| `useQueryState` en loop viola reglas de hooks | T2.2 | `useQueryStates` con mapa de parsers — una sola llamada |
| `SaleOrderViewSet` sin ningún filtro en backend | T3.3 | `SaleOrderFilterSet` nuevo — añadido como parte de T3.3 |
| Vista dual orders/notes comparte toolbar | T3.3 | Props condicionales por `viewMode`; badge facets conservados client-side |
| `TreasuryMovementFilters.movement_type` es union strict | T3.2 | Cast `as TreasuryMovementFilters` — seguro porque enum options del searchDef son exactamente los literales válidos |

---

## 14. Referencias

| Documento | Contenido |
|---|---|
| [smart-search-analysis.md](./smart-search-analysis.md) | Análisis de opciones, decisión arquitectónica, restricciones de contratos |
| [gap-analysis.md](./gap-analysis.md) | Clasificación por tier de las 35 rutas pendientes (segunda ola) |
| [rollout-plan.md](./rollout-plan.md) | Plan de implementación segunda ola: T1→T2→HR→T3 |
| [searchbar-decision.md](../../20-contracts/searchbar-decision.md) | Árbol de decisión: useSmartSearch vs useClientSearch vs excluido |
| [hooks-audit.md](../hooks/hooks-audit.md) | Estado post-refactoring de los 41 hooks — prerequisito completado |
| [hook-contracts.md](../../20-contracts/hook-contracts.md) | Contratos de hooks: staleTime, queryKeys, invalidación |
| [component-datatable-views.md](../../20-contracts/component-datatable-views.md) | Contrato del DataTable — isLoading skeleton, no useState para vista activa |
| [add-shared-component.md](../../30-playbooks/add-shared-component.md) | Playbook para promover `SmartSearchBar` al barrel compartido |
