# entity-view — guía rápida (ADR-0087 *Accepted*)

> Contrato normativo: [`docs/20-contracts/component-entity-view.md`](../../../docs/20-contracts/component-entity-view.md). Playbook: `docs/30-playbooks/add-feature.md` §4c.

Sistema para presentar colecciones de una entidad (tabla, cards, listas embebidas, superficies editables) **declarando los campos una vez** y el layout **por superficie**. Barrel: `@/components/entity-view`.

## 1. Dar de alta la presentación de una entidad (2 archivos)

### `features/<feature>/entity-view/<entidad>.entity.ts`

```ts
import { defineEntity, type StatusValue } from "@/components/entity-view"
import type { Warehouse } from "../types"

export const warehouseEntity = defineEntity<Warehouse>()((f) => ({
    label: "inventory.warehouse",                  // etiqueta del entity-registry (icono, drawer, URL)
    fields: {
        code: f.code("code", { label: "Código" }),
        name: f.text("name", { label: "Nombre" }),
        active: f.status((w): StatusValue => (w.is_active ? { status: "ACTIVE", label: "Activa" } : { status: "INACTIVE", label: "Inactiva" }), { label: "Estado" }),
    },
}))

export const warehouseViews = warehouseEntity.views({
    table: { columns: ["code", "name", "active"], defaultSort: "name" },
    card: { title: "name", subtitle: ["code"], trailing: ["active"] },
})
```

- El primer argumento de cada campo es **una clave de la fila** (tipada: una clave inexistente o de tipo incompatible no compila) **o una función** `(row) => valor`.
- Las opciones pueden ser constantes o funciones por fila: `uom: (row) => row.uom_name`.
- Los ids de `columns`, `title`, `subtitle`, `meta`, `trailing`, `footer.sum`, `defaultSort` y `.without(...)` se comprueban en compilación.

### Página / vista

```tsx
import { Collection, useEntityCollection } from "@/components/entity-view"
import { warehouseEntity, warehouseViews } from "../entity-view/warehouse.entity"
import { useWarehouses } from "../hooks/useWarehouses"      // hook de feature (los componentes no usan useQuery)

export function WarehouseCollection() {
    const { data, isLoading, error } = useWarehouses()
    const collection = useEntityCollection(warehouseEntity, { rows: data, isLoading, error })
    return (
        <Collection.Root collection={collection} selection="bulk">
            <Collection.Toolbar />
            <Collection.View table={warehouseViews.table} card={warehouseViews.card} />
        </Collection.Root>
    )
}
```

Gratis, sin código: tabla semántica accesible, orden, paginación, card, vacío, carga, error, abrir el drawer de la entidad (clic o teclado en la celda principal), cambio tabla/cards.

- La fuente `{ rows, isLoading?, isRefetching?, error?, rowCount?, refetch?, isFiltered? }`: solo `rows` es obligatorio. Pasa `refetch` para que el estado de error ofrezca "Reintentar" e `isFiltered` para el vacío "Ningún resultado para el filtro".
- **Abrir la ficha** requiere el `EntityViewProvider` montado una vez en el shell de la app (lo conecta con `openEntity` y el registro de drawers). Sin provider y sin `onOpen` en `Collection.Root`, la celda principal no se muestra como enlace.
- El icono de la card sale del `entity-registry` por `label`. Si la etiqueta no está registrada, se usa un icono genérico: declara `media.icon`.

## 2. Tipos de valor del núcleo (`f.<tipo>`)

| Tipo | Valor | Opciones |
|---|---|---|
| `text` | string | `tone: "secondary"`, `truncate` |
| `code` | string \| number | `prefix` |
| `number` | number \| string decimal | `decimals`, `suffix` |
| `quantity` | number \| string decimal | `uom`, `decimals` |
| `money` | number \| string decimal | `currency`, `sign: "auto"\|"always"\|"never"` |
| `flow` | number \| string decimal | **`direction`** (`inflow`/`outflow`/`neutral`), `currency` |
| `date` | ISO string | `time: true` para fecha y hora |
| `dateRange` | `{ from, to }` | — |
| `status` | `{ status, label?, intent? }` (StatusBadge) | — |
| `hubStatus` | la fila del documento | **`entity`** (etiqueta del registro) |
| `contact` | `{ id, name }` | — |
| `tags` | `string[]` | `domain` (chips de categoría) |
| `progress` | `{ done, total }` | `format: "percent"\|"ratio"` |

Extensiones de features (se usan con su **constructor**, que además registra el tipo): `docRef(f, (row) => ({ label, id, display }) | null, { label, fallback? })`, importado de `@/features/documents`, para enlazar a otro documento o entidad.

## 3. Layout de la card

`title` (1 campo, enlace a la ficha) · `subtitle` (campos unidos con " · ") · `meta` (pares etiqueta/valor bajo la cabecera) · `trailing` (estado o KPI a la derecha) · `media` (`icon`, `iconFor: (row) => Icono`, `tone`: `"default" | "primary" | "info" | "success" | "warning" | "destructive" | "muted"` o función por fila, `image`, `avatar`) · `body`: `{ kind: "workflow", total, pending?, date?, lines? }`, `{ kind: "metrics", fields }`, `{ kind: "progress", field }` o `{ kind: "custom", component }`.

## 4. Lo específico: extensión en la feature (sin tocar `components/entity-view`)

```tsx
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds { miTipo: { value: X; options: { ... } } }
}
let registered = false
function register() { if (!registered) { registered = true; registerValueKind("miTipo", { format, sortValue?, align?, render }) } }

// Exporta un constructor que registra al usarse: nadie puede declarar el campo sin registrar el tipo.
export function miTipo<T>(f: FieldBuilders<T>, accessor: Accessor<T, X>, input: FieldMeta & { /* opciones */ }) {
    register()
    return f.value("miTipo", accessor, input)
}
```

Desde otra feature, impórtalo por el **barrel** de la feature dueña (invariante #3).

Regla de gobierno: un tipo entra al núcleo solo si lo usan ≥3 entidades de ≥2 features; si no, es extensión de la feature.

## 5. Superficie editable (wizard/modal: cantidad a procesar, reparto de montos)

`defineEditable(entity, { rowKey, context: [ids], inputs: { nombre: { kind, header, label: (row) => …, max?, step?, initial?, unit? } }, eligible?, footer?, bulk? })` + `editableSchema(def, rows)` dentro de un formulario react-hook-form con `zodResolver`, y `<EditableCollection … errors={editableErrorsFromForm(form.formState.errors.lines, value)} />`.

## 6. Prohibido

`any`; `as unknown as` para mezclar entidades (usa `CollectionModes`); formatear dinero o fechas a mano (usa los tipos o los formatters exportados); `<table>` propias; importar `DataTable`, `createEntityFields` o `AutoEntityCard` desde código nuevo; importar rutas internas de `@/components/entity-view`. Lo bloquean las reglas `entity-view/*` de ESLint y `lib/__tests__/entity-view.contract.test.ts`.
