---
layer: 20-contracts
doc: list-modal-edit-pattern
status: active
owner: frontend-team
last_review: 2026-05-09
stability: contract-changes-require-ADR
preconditions:
  - module-layout-navigation.md
  - component-form-patterns.md
  - form-layout-architecture.md
---

# Contrato: List-Modal Edit Pattern

> **Origen:** ADR-0020 (2026-05-09). Opción A — URL-state pattern.
> **Audiencia:** ingenieros frontend implementando edición de entidades desde la lista o desde Universal Search.

Este contrato define el patrón canónico para abrir el modal de edición de una entidad desde:
- El botón "Editar" de una fila de la lista.
- Un resultado del Universal Search (navegación a `/module/entity/{id}`).

---

## 1. Forma del query param

| Atributo | Valor |
|----------|-------|
| **Nombre** | `selected` |
| **Tipo** | `string` — id de la entidad (PK numérico como string) |
| **Cardinalidad** | Una sola entidad seleccionable a la vez por lista |
| **Canonical** | `/inventory/categories?selected=42` |

**Solo `?selected` es el nombre canónico.** No usar `?id=`, `?edit=`, `?modal=` ni ningún otro alias para este propósito.

La URL con `?selected` es **deep-linkeable y shareable**. El comportamiento observable: la lista monta con el modal ya abierto, mostrando la entidad indicada.

---

## 2. Responsabilidades

### 2.1 La lista

1. Lee `searchParams.get('selected')` al montar.
2. Llama a `useSelectedEntity(endpoint)` (ver §2.3) para fetchear la entidad y obtener `entity`, `isLoading`, `error`, `clearSelection`.
3. Monta el modal de edición existente con `initialData={entity}` cuando `entity !== null`.
4. La acción "Editar" de cada fila hace `router.push(\`?selected=\${id}\`)` (no abre modal vía estado local).
5. La acción "Crear" sigue abriendo el modal vía estado local — no usa `selected`.

```tsx
// Patrón de uso en la lista
const { entity: selectedCategory, isLoading: isLoadingSelected, clearSelection } =
  useSelectedEntity<Category>({ endpoint: '/api/inventory/categories/' })

// La fila de la tabla llama a:
const handleEdit = (item: Category) => {
  router.push(`?selected=${item.id}`)
}

// El modal se monta con los datos fetcheados:
<CategoryForm
  open={!!selectedCategory || isLoadingSelected}
  onOpenChange={(open) => { if (!open) clearSelection() }}
  initialData={selectedCategory ?? undefined}
/>
```

### 2.2 El modal de edición

- Al **cerrar** invoca la función `clearSelection()` proporcionada por `useSelectedEntity`.
- `clearSelection()` hace `router.replace(pathname)` sin el param `selected`, preservando otros params existentes.
- El modal no accede directamente a `useSearchParams` — esa responsabilidad es de la lista.

### 2.3 Hook `useSelectedEntity`

**Archivo:** `frontend/hooks/useSelectedEntity.ts`

```ts
interface UseSelectedEntityOptions {
  endpoint: string       // base endpoint, e.g. '/api/inventory/categories/'
  paramName?: string     // default: 'selected'
}

interface UseSelectedEntityResult<T> {
  entity: T | null
  isLoading: boolean
  clearSelection: () => void
}

function useSelectedEntity<T>(opts: UseSelectedEntityOptions): UseSelectedEntityResult<T>
```

**Comportamiento:**

| Condición | Resultado |
|-----------|-----------|
| `?selected` ausente en URL | `entity: null`, sin fetch |
| `?selected` presente | `useQuery({ queryKey: [endpoint, id] })` — reutiliza cache si la lista ya hizo fetch del mismo id |
| Respuesta 404 | `toast.error('No encontrado')` + `clearSelection()` |
| Respuesta 403 | `toast.error('Sin permiso')` + `router.replace('<base list path>')` |
| Loading | `isLoading: true`, `entity: null` |

**`clearSelection`** hace `router.replace(pathname)` eliminando `selected` y preservando otros params existentes.

---

## 3. Regla de desacoplamiento del modal

El modal de edición **DEBE** ser un componente independiente con esta firma mínima:

```tsx
interface EntityEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Entity        // undefined = modo creación
  onSuccess?: () => void
}
```

La lista lo monta como uno de N consumidores potenciales. No debe estar embebido como bloque JSX inline dentro de la lista si tiene más de un consumidor.

> **Cuándo se exige el refactor:** Hoy no se requiere refactorizar modales que aún están inline en la lista. **Se exige cuando aparezca un segundo consumidor** del mismo modal (e.g., un drawer lateral que también quiera abrirlo).

---

## 4. Permisos / 404 / 403

El hook `useSelectedEntity` centraliza el manejo de errores. El comportamiento estándar es:

```
?selected=<id>
    ↓
fetch /api/<module>/<entity>/<id>/
    ├─ 200 → entity cargada → modal se abre con initialData
    ├─ 404 → toast.error('No encontrado') → clearSelection() → URL limpia
    └─ 403 → toast.error('Sin permiso para ver esta entidad') → router.replace(<base list>) → modal no se abre
```

Los permisos de **escritura** (editar, guardar) los valida el form al hacer submit, tal como hoy. El hook solo maneja permisos de lectura del fetch inicial.

---

## 5. Ejemplo canónico

### `CategoryList.tsx` — estado actual (post T-82, compatible con Opción A)

El componente ya usa `CategoryForm` de forma unificada para crear y editar. La adaptación para Opción A (T-91) consiste en:

1. Conectar `useSelectedEntity` al param `?selected`.
2. Cambiar el `onClick` de la acción "Editar" de `setEditingCategory + setIsFormOpen` a `router.push('?selected=' + item.id)`.
3. Conectar `clearSelection` al `onOpenChange` del modal.

**Antes (estado actual — usa estado local):**

```tsx
// CategoryList.tsx — patrón actual (pre T-91)
const [editingCategory, setEditingCategory] = useState<Category | null>(null)
const [isFormOpen, setIsFormOpen] = useState(false)

// En la fila:
<DataCell.Action
  icon={Pencil}
  title="Editar"
  onClick={() => { setEditingCategory(item); setIsFormOpen(true) }}
/>

// Modal:
<CategoryForm
  open={isFormOpen}
  onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingCategory(null) } }}
  initialData={editingCategory ?? undefined}
/>
```

**Después (target T-91 — usa `?selected`):**

```tsx
// CategoryList.tsx — patrón Opción A (post T-91)
const { entity: selectedCategory, isLoading: isLoadingSelected, clearSelection } =
  useSelectedEntity<Category>({ endpoint: '/api/inventory/categories/' })

// En la fila:
<DataCell.Action
  icon={Pencil}
  title="Editar"
  onClick={() => router.push(`?selected=${item.id}`)}
/>

// Modal — CategoryForm no cambia en absoluto:
<CategoryForm
  open={!!selectedCategory || isLoadingSelected}
  onOpenChange={(open) => { if (!open) clearSelection() }}
  initialData={selectedCategory ?? undefined}
/>
```

> **`CategoryForm` no requiere ninguna modificación.** El cambio es exclusivamente en la lista. Los formularios ricos existentes son transparentes al mecanismo de URL-state.

---

## 6. Anti-patrones

| Anti-patrón | Correcto |
|-------------|----------|
| `?id=<id>` como query param | `?selected=<id>` — nombre canónico único |
| `?edit=<id>` | `?selected=<id>` |
| Abrir el modal vía `useState` local cuando hay `?selected` en la URL (ignora el deeplink) | Leer `useSelectedEntity` que consume el param |
| Duplicar el form en una página detalle separada para la misma entidad | Redirect server-side a `<list>?selected=<id>` desde `[id]/page.tsx` |
| Llamar a `router.push('?selected=' + id)` Y también `setEditingCategory(item)` en el mismo handler | Solo `router.push` — `useSelectedEntity` se encarga del fetch |
| `clearSelection` implementada como `setEditingCategory(null)` | `router.replace(pathname)` sin el param |

---

## 7. Ruta `[id]/page.tsx` — redirect canónico

Toda ruta `[id]/page.tsx` de una entidad registrada en `UniversalRegistry` DEBE ser un **redirect server-side**:

```tsx
// frontend/app/(dashboard)/inventory/categories/[id]/page.tsx
import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

export default async function CategoryDetailPage({ params }: { params: { id: string } }) {
  const listUrl = searchableEntityRoutes['inventory.productcategory']
  // '/inventory/categories'
  redirect(`${listUrl}?selected=${params.id}`)
}
```

El mapa centralizado `searchableEntityRoutes.ts` (T-88) es la fuente de verdad. Un cambio de slug toca un solo archivo.

---

## 8. Cross-references

- ADR de la decisión: [ADR-0020](../10-architecture/adr/0020-modal-on-list-edit-ux.md)
- Hook `useSelectedEntity` (implementación): [hook-contracts.md](./hook-contracts.md)
- Árbol de decisión de componentes: [component-decision-tree.md §5](./component-decision-tree.md)
- Surface y tamaño del modal: [component-form-patterns.md §2](./component-form-patterns.md)
- FormSplitLayout + ActivitySidebar (sidebar en modo edición): [form-layout-architecture.md §5-6](./form-layout-architecture.md)
- Mapa de rutas canónicas de entidades searchable: [module-layout-navigation.md §7.3](./module-layout-navigation.md#73-tabla-de-patrones-canónicos-26-entidades)
- Decommission de DetailClients y EntityDetailPage: [20-task-list.md T-95](../50-audit/Arquitectura%20Django/20-task-list.md#t-95--decommission-de-detailclients-y-entitydetailpage)
