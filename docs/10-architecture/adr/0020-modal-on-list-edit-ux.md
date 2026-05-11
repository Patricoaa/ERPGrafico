# ADR-0020: Modal-on-List Edit UX (URL-State Pattern)

**Fecha:** 2026-05-09
**Estado:** Aceptado
**Fase:** F8
**Supersede parcialmente:** ADR-0019 (los reverts de Phase 4 siguen vigentes; la expansión schema-driven queda superseded)
**Firmas Stakeholder:** @pato

---

## 1. Contexto

Durante F7 se implementó el shell `EntityDetailPage` y las rutas `[id]/page.tsx` para las 26 entidades registradas en el `UniversalRegistry`. Esta implementación produjo una segunda UI de edición que coexiste con el modal local de la lista, generando duplicación de código y superficie de mantenimiento.

Tras completar T-80..T-84 (reverts de Phase 4 y ADR-0019), el problema de fondo quedó expuesto con claridad:

- Los formularios ricos existentes (`CategoryForm`, `BudgetEditor`, `ProductForm`, etc.) ya cumplen plenamente los contratos UI del proyecto.
- El shell `EntityDetailPage` + `*DetailClient` produce una segunda ruta de edición completa que en la práctica no aporta valor UX diferencial respecto al modal.
- La navegación desde **Universal Search** a una ruta `[id]` carga una página completa separada de la lista, rompiendo el contexto del usuario.

### Opciones evaluadas

#### Opción A — URL-state pattern *(adoptada)*

El `UniversalRegistry` mantiene URLs limpias `/module/entity/{id}`.
Cada `[id]/page.tsx` se convierte en un **redirect server-side** a `<list_url>?selected={id}`.
La lista lee el query param `?selected` y abre su modal local existente con `initialData` fetcheado.

#### Opción B — Intercepting routes (Next.js)

El App Router permite rutas que se interceptan cuando la navegación es interna. El modal se renderiza sobre la lista cuando se navega internamente; la ruta completa se renderiza cuando se accede directamente.

**Por qué se descartó Opción B:**

Las intercepting routes de Next.js **solo interceptan navegación interna** dentro de la misma instancia de navegación del browser. El caso de uso central de F8 es la **Universal Search**: el usuario tipea en el buscador desde `/accounting/entries` y hace click en un resultado `SaleOrder`. Este click es una navegación entre módulos que **no dispara el mecanismo de intercepting routes**, por lo que el usuario vería la página completa `[id]` en lugar del modal, exactamente el comportamiento que queremos evitar.

La Opción A resuelve el caso de uso central con un mecanismo simple y predecible.

---

## 2. Decisión

Se adopta **Opción A — URL-state pattern** como patrón canónico para la edición de entidades searchable:

1. **El registry mantiene `detail_url_pattern` limpio** (`/sales/orders/{id}`).
2. **`[id]/page.tsx` redirige server-side** a `<list_url>?selected={id}` (redirect 307 temporal).
3. **La lista lee `searchParams.selected`** y monta su modal local de edición con `initialData` fetcheado vía `useSelectedEntity` (T-87).
4. **Cerrar el modal** invoca `clearSelection()` → `router.replace(pathname)` → URL queda limpia.

El contrato completo se formaliza en [`list-modal-edit-pattern.md`](../../20-contracts/list-modal-edit-pattern.md) (T-86).

---

## 3. Trade-offs aceptados

| Trade-off | Mitigación |
|-----------|-----------|
| La lista debe montar para abrir el modal | Paginación + skeleton superpuesto al modal durante carga inicial |
| Acoplamiento lista ↔ modal | Regla de desacoplamiento en T-86: el modal debe ser componente independiente `<EntityEditModal>` cuando haya ≥2 consumidores |
| URL no es una "página" autónoma (el redirect es inmediato) | La URL es válida, shareable y deep-linkeable — cumple el objetivo del Universal Search |
| `EntityDetailPage` + `DetailClient` (23 archivos) deben eliminarse | T-95 hace el decommission completo tras T-88..T-94 |

---

## 4. Consecuencias

### Positivas

- **Un solo formulario por entidad** — el modal existente es la única UI de edición; no hay duplicación.
- **Cero código nuevo de UI** para conectar Universal Search con el modal — solo el redirect y el hook.
- **URLs deep-linkeables y shareables** — el link a `/sales/orders/123` funciona y navega al modal correcto.
- **Mantenimiento reducido** — eliminar 23 `DetailClient.tsx` y `EntityDetailPage.tsx` reduce la superficie activa.

### Negativas / Restricciones

- Las rutas `[id]` dejan de ser páginas completas independientes. Si en el futuro se necesita una vista de detalle standalone (e.g., para impresión o compartir sin la lista), habrá que reintroducir una ruta propia para ese caso específico.
- El redirect produce una navegación adicional antes de que el modal se muestre. Para datos en cache de TanStack, este efecto es imperceptible.

---

## 5. Relación con ADR-0019

ADR-0019 documentó dos decisiones separadas:

1. **Reverts de Phase 4** (Budget, ProductCategory, UoM create → form rico unificado) — **siguen vigentes**.
2. **Expansión schema-driven** (nuevo vocabulario `FormMeta`, Widget Registry frontend) — **supersedida por este ADR**.

La expansión schema-driven queda indefinidamente postergada. Los formularios ricos existentes son el estándar canónico de edición; no se volverá a intentar reemplazarlos con `EntityForm` salvo ADR explícito futuro.

---

## Changelog

- **2026-05-09**: ADR creado (F8, T-85). Decisión: Opción A adoptada. Opción B descartada. T-84 (`schema-driven-forms.md`) marcado como superseded. `EntityDetailPage` + 23 `DetailClient` programados para decommission en T-95.
