# Mejoras Concretas para Contratos de Diseño
**Versión:** 1.0  
**Fecha:** 2026-04-15  
**Estado:** Propuestas Listas para Implementación

---

## ESTRUCTURA DEL DOCUMENTO

Este documento proporciona el texto exacto para reemplazar/agregar secciones en `component-contracts.md`.

**Instrucciones de Uso:**
1. Abrir `component-contracts.md`
2. Encontrar la sección indicada
3. Reemplazar con el texto propuesto
4. Ejecutar `npm run type-check`

---

## 1. FIX CRÍTICO: StatusBadge — Corregir "type" a "variant"

### Ubicación en component-contracts.md
Líneas 8-11 (Sección 1. StatusBadge)

### Texto Actual (INCORRECTO)
```
- **Props**:
  - `status`: String (slug del estado).
  - `type`: 'order' | 'payment' | 'generic'.
  - `showLabel`: Boolean (default true).
```

### Reemplazo (CORRECTO)
```
- **Props**:
  - `status`: String (slug del estado, ej. `'DRAFT'`, `'PAID'`, `'CANCELLED'`). Case-insensitive.
  - `variant`: `'default' | 'hub' | 'dot'` (default: `'default'`).
    - `'default'`: Badge estándar con etiqueta.
    - `'hub'`: Círculo de icono pequeño para dashboards (requiere prop `icon`).
    - `'dot'`: Punto pulsante + etiqueta compacta.
  - `label`: String (override de etiqueta automática, opcional).
  - `icon`: LucideIcon (requerido para `variant='hub'`, opcional para otros).
  - `tooltip`: String (solo usado con `variant='hub'`, muestra tooltip al hover).
  - `size`: `'sm' | 'md' | 'lg'` (default: `'md'`).
  - `className`: String (clases CSS adicionales, opcional).

- **Tipos de Componentes Internos**:
  ```tsx
  interface StatusStyle {
    label: string
    className: string
    type: "success" | "warning" | "destructive" | "info" | "neutral"
  }
  ```
  Mapeo: El `status` se convierte automáticamente al `type` interno para colorización.
```

### Ejemplo de Uso
```tsx
// Variant default (estándar)
<StatusBadge status="PAID" />
// → "Pagado" con fondo success

// Variant hub (para dashboards)
<StatusBadge 
  status="IN_PROGRESS" 
  variant="hub"
  icon={Clock}
  tooltip="En Proceso"
/>
// → Círculo naranja con icono Clock

// Variant dot (compacto)
<StatusBadge status="PENDING" variant="dot" size="sm" />
// → Punto pulsante + "Pendiente" miniaturizado
```

---

## 2. UPDATE CRÍTICO: PageHeader — Sincronizar Documentación con Código Real

### Ubicación en component-contracts.md
Secciones 7 (antes era "7. PageHeader", ajustar número tras inserción)

### Texto Actual (INCOMPLETO)
```
### 7. PageHeader y PageLayout (`shared/PageHeader`, `shared/PageTabs`)

Contrato visual para todas las vistas principales del sistema.

**PageHeader Props:**
- `title`: String principal.
- `description`: Subtítulo explicativo.
- `variant`: `default` | `minimal` (minimal quita padding inferior para integrarse con tabs).
- `isLoading`: Muestra esqueletos de carga.
- `titleActions`: Espacio para botones de acción al lado del título (ej: botón Plus circular).
```

### Reemplazo (COMPLETO)
```
### 7. PageHeader — Encabezado Unificado de Páginas

Componente que sincroniza el estado visual del encabezado a través de un `HeaderProvider` global. Implementa la identidad y controles principales de cada vista.

**PageHeader Props:**

```tsx
interface PageHeaderProps {
  /** Título principal de la página */
  title: string
  /** Texto descriptivo bajo el título (opcional) */
  description?: string
  /** Icono Lucide a mostrar junto al título (opcional) */
  icon?: LucideIcon
  /** Nombre del icono vía DynamicIcon (alternativa a prop `icon`) */
  iconName?: string
  /** Nodos React para acciones junto al título (botones, dropdown, etc.) */
  titleActions?: React.ReactNode
  /** Estado de carga del header (muestra esqueletos de carga) */
  isLoading?: boolean
  /** Indicador de estado (synced, saving, error, warning, info) */
  status?: PageHeaderStatus
  /** Variante visual: default (con borde inferior) o minimal (sin borde) */
  variant?: 'default' | 'minimal'
  /** Controles de la derecha (botones de exportar, filtrar, etc.) */
  children?: React.ReactNode
  /** URL a página de configuración (agregará ícono de engranaje automáticamente) */
  configHref?: string
  /** Clases CSS adicionales */
  className?: string
}

interface PageHeaderStatus {
  label: string                     // Texto a mostrar
  type?: 'synced' | 'saving' | 'error' | 'warning' | 'info'
  icon?: LucideIcon                 // Icono personalizado
  iconName?: string                 // Nombre de icono vía DynamicIcon
}
```

**Arquitectura Interna:**
- `PageHeader` usa `HeaderProvider` para sincronizar su estado a nivel global.
- El header real se renderiza en `DashboardShell`, no en-place.
- Esto permite que múltiples `PageHeader` llamadas se sobrescriban sin saltos visuales.

**Reglas de Uso:**

1. **Ubicación**: Llamar `PageHeader` al inicio del componente de página (preferentemente en Server Component).
2. **Sincronización**: Cambios en props se sincronizan automáticamente cada render.
3. **Acciones Circulares**: Para botones circulares de creación ("+"), usar `ActionFoldButton` via `titleActions`.
4. **Variant "minimal"**: Usar cuando se integra con `PageTabs` para evitar espaciado duplicado.
5. **Status Indicator**: Mostrar estado de sincronización (ideal para autosave, cambios no guardados).

**Ejemplo:**
```tsx
export default function OrdersPage() {
  const [isSaving, setIsSaving] = useState(false)

  return (
    <>
      <PageHeader 
        title="Órdenes de Venta"
        description="Gestiona tus pedidos y cotizaciones"
        icon={ShoppingCart}
        variant="default"
        status={isSaving ? { label: "Guardando...", type: "saving" } : undefined}
        titleActions={
          <PageHeaderButton 
            circular 
            icon={Plus} 
            onClick={() => createNewOrder()}
          />
        }
      >
        {/* Controles de derecha: filtros, exportar, etc. */}
        <Button variant="outline">Exportar</Button>
      </PageHeader>
      
      {/* Contenido de página */}
    </>
  )
}
```

**PageTabs Props:**
- `tabs`: Array de `{ label: string; value: string; iconName?: string; href?: string }`
- `activeValue`: El valor de la pestaña seleccionada.
- `onValueChange`: Callback cuando el usuario selecciona una pestaña.
```

---

## 3. NEW SECTION: DataCell Contract (Detallado)

### Ubicación en component-contracts.md
Agregar como **Sección 15** (después de createActionsColumn)

### Texto Propuesto
```
## 15. Contrato de Data Cells — Anatomía Unificada de Celdas

Conjunto de componentes que standariza la renderización de diferentes tipos de datos en tablas. Todos los usos en `DataTable` y `ReportTable` deben usar estas variantes.

**Ubicación**: `@/components/ui/data-table-cells.tsx`

**Variantes Disponibles:**

### DataCell.Text
Texto general, centrado, con truncamiento.

```tsx
<DataCell.Text>
  Nombre del Producto
</DataCell.Text>
```

**Clases Internas:**
`font-sans text-sm font-medium text-foreground truncate flex justify-center items-center`

**Cuándo Usar:**
- Nombres, descripciones cortas, labels
- Campos de texto que deben truncarse si son muy largos

---

### DataCell.DocumentId
Identificador monoespaciado, uppercase, con tracking visual.

```tsx
<DataCell.DocumentId>
  DOC-2026-04-001
</DataCell.DocumentId>
```

**Clases Internas:**
`font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary flex justify-center items-center transition-colors`

**Cuándo Usar:**
- Folios, números de documento, códigos únicos
- Información técnica que requiera monoespaciado

**Comportamiento:**
- Hover cambia a color primary (visual de "clickeabilidad")
- No tiene fondo de color

---

### DataCell.ContactLink
Nombre de contacto como enlace, con icono ExternalLink obligatorio.

```tsx
<DataCell.ContactLink 
  onClick={(e) => {
    e.stopPropagation()
    navigateToContact(row.original.contact_id)
  }}
>
  Juan Pérez
</DataCell.ContactLink>
```

**Clases Internas:**
`font-sans text-sm font-medium text-primary hover:underline cursor-pointer flex justify-center items-center`

**Requerimiento:**
- **OBLIGATORIO**: Incluir icono `ExternalLink` (h-3 w-3) a la derecha
- **OBLIGATORIO**: Llamar `e.stopPropagation()` para evitar que se abra la fila
- Colores: `text-primary` en reposo, `hover:underline` en hover

---

### DataCell.Date
Fecha en formato tabular, centrada.

```tsx
<DataCell.Date>
  2026-04-15
</DataCell.Date>
```

**Clases Internas:**
`tabular-nums text-sm text-foreground/80 flex justify-center items-center`

**Notas:**
- `tabular-nums`: Asegura que números tengan ancho igual para alineación visual
- Texto ligeramente atenuado (foreground/80)

---

### DataCell.Currency (vía MoneyDisplay)
Dinero centrado o alineado a la derecha. **Sin color** a menos que sea riesgo/deuda.

```tsx
// Centrado (por defecto)
<DataCell.Currency>
  <MoneyDisplay amount={1500.00} currency="MXN" />
</DataCell.Currency>

// Con color (solo para riesgo/deuda)
<DataCell.Currency>
  <MoneyDisplay amount={-5000.00} currency="MXN" showColor />
</DataCell.Currency>
```

**Regla de Color:**
- `showColor=false` (default): Gris neutro
- `showColor=true`: Rojo si negativo, verde si positivo

---

### DataCell.Action
Botón de acción individual (Editar, Eliminar, etc.).

```tsx
<DataCell.Action 
  icon={Pencil} 
  title="Editar"
  onClick={() => editItem(row.original)}
/>
```

**Props:**
- `icon`: LucideIcon
- `title`: String (usado como tooltip)
- `onClick`: Manejador de click
- `disabled?: boolean`
- `loading?: boolean`

**Comportamiento:**
- Ancho h-8 w-8
- Icono centrado
- Tooltip al hover
- No genera click del row (stopPropagation integrado)

---

### DataCell.ActionGroup
Contenedor para múltiples acciones. Previene que clicks de acciones se propaguen a la fila.

```tsx
<DataCell.ActionGroup>
  <DataCell.Action icon={Pencil} title="Editar" onClick={...} />
  <DataCell.Action icon={Trash2} title="Eliminar" onClick={...} />
</DataCell.ActionGroup>
```

**Props:**
- `children`: React.ReactNode (solo `DataCell.Action` recomendado)

**Comportamiento Interno:**
- `stopPropagation()` en todos los clicks
- Espaciado uniforme entre acciones (gap-1)

---

## Anatomía Completa de una Fila

```tsx
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => (
      <DataCell.DocumentId>{row.original.sku}</DataCell.DocumentId>
    ),
  },
  {
    accessorKey: "name",
    header: "Producto",
    cell: ({ row }) => (
      <DataCell.Text>{row.original.name}</DataCell.Text>
    ),
  },
  {
    accessorKey: "supplier",
    header: "Proveedor",
    cell: ({ row }) => (
      <DataCell.ContactLink 
        onClick={(e) => {
          e.stopPropagation()
          navigateTo(`/contacts/${row.original.supplier_id}`)
        }}
      >
        {row.original.supplier_name}
      </DataCell.ContactLink>
    ),
  },
  {
    accessorKey: "price",
    header: "Precio",
    cell: ({ row }) => (
      <DataCell.Currency>
        <MoneyDisplay amount={row.original.price} currency="MXN" />
      </DataCell.Currency>
    ),
  },
  {
    accessorKey: "last_update",
    header: "Última Actualización",
    cell: ({ row }) => (
      <DataCell.Date>{row.original.last_update}</DataCell.Date>
    ),
  },
  createActionsColumn({
    renderActions: (item) => (
      <>
        <DataCell.Action 
          icon={Pencil} 
          title="Editar" 
          onClick={() => editProduct(item)}
        />
        <DataCell.Action 
          icon={Trash2} 
          title="Eliminar" 
          onClick={() => deleteProduct(item)}
        />
      </>
    ),
  }),
]
```

---

## Reglas Visuales Consolidadas

| Elemento | Propiedad | Valor |
|----------|-----------|-------|
| **Todas las celdas** | `justify-center items-center` | Alineación vertical |
| **Celdas de texto** | `truncate` | Evitar overflow |
| **Todas las celdas** | `flex` | Display estándar |
| **Moneda** | Alineación | Centro o derecha (contexto-dependiente) |
| **Enlace contacto** | Icon | ExternalLink h-3 w-3 |
```

---

## 4. NEW SECTION: Hooks Contract (Expandido)

### Ubicación en component-contracts.md
Reemplazar la Sección 5 (CONTRATO DE HOOKS)

### Texto Actual (VAGO)
```
## 5. CONTRATO DE HOOKS (Data Fetching)
Todo hook de feature debe seguir este patrón:

- **Naming**: `use[Entity][Action]` (ej. `useProductSearch`, `useOrderDetails`).
- **Retorno Obligatorio**: 
  - `data`: El resultado tipado (vía Zod).
  - `isLoading`: Estado de carga inicial.
  - `error`: Error formateado vía `showApiError`.
- **Regla**: Prohibido usar `useQuery` directamente en componentes UI; siempre envolver en un hook de feature.
```

### Reemplazo (DETALLADO)
```
## 5. CONTRATO DE HOOKS — Data Fetching y State Management

Todo custom hook de feature (especialmente aquellos que obtienen datos del backend) debe seguir esta interfaz estándar.

**Patrón de Naming:**
```tsx
use[Entity][Action] | use[Entity][Relationship]

// Ejemplos válidos:
useProductSearch()
useOrderDetails()
useInventoryMovements()
useSupplierContacts()
useAccountingTransactions()
useUserProfile()
```

**Contrato de Retorno (Hook de Datos):**

```tsx
interface UseDataHookReturn<T> {
  /** Datos obtenidos del backend, tipado vía Zod. undefined si isLoading=true. */
  data: T | undefined
  
  /** True mientras se obtienen datos iniciales (en primera carga) */
  isLoading: boolean
  
  /** Error ocurrido durante fetch, formateado vía lib/api.ts. null si sin errores. */
  error: string | null
}

// Hook típico:
function useOrderDetails(orderId: string): UseDataHookReturn<Order> {
  const [data, setData] = useState<Order | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        setIsLoading(true)
        const response = await api.get(`/api/sales/orders/${orderId}/`)
        const validated = OrderSchema.parse(response.data)
        setData(validated)
        setError(null)
      } catch (err) {
        setError(showApiError(err))
        setData(undefined)
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [orderId])

  return { data, isLoading, error }
}
```

**Regla Fundamental:**
- **PROHIBIDO** usar `useQuery` (TanStack Query) directamente en componentes UI
- **OBLIGATORIO** envolver en un hook de feature que tenga el contrato anterior
- Razón: Centraliza lógica, facilita testing, permite reutilización

**Ejemplo de Uso en Componente:**

```tsx
export function OrderDetailsView({ orderId }: { orderId: string }) {
  // Hook de feature con contrato estándar
  const { data: order, isLoading, error } = useOrderDetails(orderId)

  if (isLoading) return <LoadingFallback />
  if (error) return <Alert variant="destructive">{error}</Alert>
  if (!order) return <EmptyState context="generic" />

  return (
    <div>
      <h2>{order.number}</h2>
      {/* Contenido */}
    </div>
  )
}
```

**Convenciones Adicionales:**

1. **Hooks con Parametrización:**
   ```tsx
   function useProductSearch(query: string, filters?: ProductFilters) {
     // Si `query` cambia, re-fetch automáticamente
   }
   ```

2. **Hooks que Retornan Funciones (Mutation):**
   ```tsx
   interface UseMutationReturn<TInput, TOutput> {
     mutate: (input: TInput) => Promise<TOutput>
     isLoading: boolean
     error: string | null
     data: TOutput | undefined
   }

   function useCreateOrder(): UseMutationReturn<CreateOrderInput, Order> {
     // Implementación
   }
   ```

3. **Hooks que Retornan Arrays (Lista Paginada):**
   ```tsx
   interface UseListHookReturn<T> {
     items: T[]
     isLoading: boolean
     error: string | null
     pagination: {
       page: number
       totalPages: number
       setPage: (page: number) => void
     }
   }

   function useOrdersList(filters?: OrderFilters): UseListHookReturn<Order> {
     // Implementación con paginación
   }
   ```

**Patrones de Error:**

Todos los hooks usan `lib/api.ts` que intercepta errores y los formatea vía `showApiError()`:

```tsx
// En lib/api.ts (ya existe)
export function showApiError(error: any): string {
  if (error.response?.data?.detail) {
    return error.response.data.detail
  }
  return "Error desconocido. Por favor intenta de nuevo."
}
```

Los hooks NO deben hacer `console.error()` ni `toast.error()` directamente. El componente UI decide cómo mostrar el error.

**Regla de Testing:**
Todos los hooks de feature deben ser testeables de forma aislada:
```tsx
// tests/hooks/useOrderDetails.test.ts
test('useOrderDetails fetches order successfully', async () => {
  const { result } = renderHook(() => useOrderDetails('123'))
  expect(result.current.isLoading).toBe(true)
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.data).toEqual(mockOrder)
})
```
```

---

## 5. NEW SECTION: Forms Contract (Expandido)

### Ubicación en component-contracts.md
Reemplazar la Sección 6 (CONTRATO DE FORMULARIOS)

### Texto Actual (SUPERFICIAL)
```
## 6. CONTRATO DE FORMULARIOS
- **Biblioteca**: `react-hook-form` + `zod`.
- **Estructura**:
  - Carpeta `[Feature]/components/forms/`.
  - Archivo `schema.ts`: Definición única del Zod schema y el Type derivado.
- **Props Estándar**:
  - `initialData?: T`: Datos para modo edición.
  - `onSuccess: (data: T) => void`: Callback tras guardado exitoso.
  - `onCancel: () => void`: Cerrar modal o volver atrás.
```

### Reemplazo (COMPLETO)
```
## 6. CONTRATO DE FORMULARIOS — Validación, Estado y Ciclo de Vida

Todos los formularios en el sistema siguen esta arquitectura: separación de schema, componentización modular, y manejo determinista de estados.

**Arquitectura de Carpetas:**

```
features/[module]/
├── components/
│   ├── forms/
│   │   ├── schema.ts              ← Zod schema + derived TypeScript type
│   │   ├── [EntityName]Form.tsx   ← Componente del formulario
│   │   └── [EntityName]Fields.tsx ← Campos reutilizables (opcional)
```

**schema.ts — Fuente Única de Verdad:**

```tsx
import { z } from "zod"
import { phonenumber, formatCurrency } from "@/lib/validation"

// 1. Schema Zod (validación)
export const CreateOrderSchema = z.object({
  customer_id: z.string().min(1, "Cliente requerido"),
  items: z.array(
    z.object({
      product_id: z.string().min(1),
      quantity: z.number().int().positive("Cantidad debe ser positiva"),
      unit_price: z.number().positive("Precio debe ser positivo"),
    })
  ).min(1, "Al menos un item requerido"),
  delivery_date: z.date().min(new Date(), "Fecha debe ser futura"),
  notes: z.string().optional(),
})

// 2. Type derivado de Zod (NO tipear manualmente)
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

// Para edición (puede diferir del creación):
export const EditOrderSchema = CreateOrderSchema.omit({ customer_id: true })
export type EditOrderInput = z.infer<typeof EditOrderSchema>
```

**Regla Crítica:**
- PROHIBIDO: `interface CreateOrderInput { ... }` tipadas manualmente
- OBLIGATORIO: Derivar tipos via `z.infer<typeof Schema>`
- Razón: Una fuente única de verdad, cambios en schema = cambios en types

---

**[EntityName]Form.tsx — Componente Contenedor:**

```tsx
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { CreateOrderSchema, type CreateOrderInput } from "./schema"
import { CreateOrderFields } from "./CreateOrderFields"

interface CreateOrderFormProps {
  /** Datos iniciales para modo edición (si no se pasa, es modo crear) */
  initialData?: Partial<CreateOrderInput>
  /** Callback después de validación exitosa y guardado */
  onSuccess: (data: CreateOrderInput) => void
  /** Callback para cerrar modal/navegar atrás */
  onCancel: () => void
  /** Mostrar estado de carga durante submit */
  isSubmitting?: boolean
}

export function CreateOrderForm({
  initialData,
  onSuccess,
  onCancel,
  isSubmitting = false,
}: CreateOrderFormProps) {
  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: initialData || {
      items: [{ quantity: 1 }],
    },
    mode: "onChange", // Validar mientras escribe
  })

  const onSubmit = async (data: CreateOrderInput) => {
    try {
      // Llamar al hook de mutación (ver sección de Hooks)
      await createOrderMutation(data)
      form.reset() // Limpiar después de éxito
      onSuccess(data)
    } catch (error) {
      // El hook maneja el error; aquí solo esperamos la propagación
      form.setError("root", { message: "Error al guardar" })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Campos delegados a subcomponente */}
        <CreateOrderFields form={form} />

        {/* Errores globales del formulario */}
        {form.formState.errors.root && (
          <Alert variant="destructive">
            {form.formState.errors.root.message}
          </Alert>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3 justify-end pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <ActionSlideButton
            type="submit"
            disabled={isSubmitting || !form.formState.isValid}
            loading={isSubmitting}
          >
            {initialData ? "Actualizar" : "Crear"}
          </ActionSlideButton>
        </div>
      </form>
    </Form>
  )
}
```

**CreateOrderFields.tsx — Campos Reutilizables:**

```tsx
import { UseFormReturn } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { CreateOrderInput } from "./schema"

interface CreateOrderFieldsProps {
  form: UseFormReturn<CreateOrderInput>
}

export function CreateOrderFields({ form }: CreateOrderFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="customer_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cliente</FormLabel>
            <FormControl>
              <CustomerComboBox {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Más campos... */}
    </>
  )
}
```

---

**Ciclo de Vida Completo:**

```
1. Usuario abre formulario
   ↓
2. initialData carga defaultValues
   ↓
3. Usuario edita campos → validación en tiempo real (mode: "onChange")
   ↓
4. Usuario presiona submit
   ↓
5. react-hook-form valida contra schema
   ↓
6. Si válido → onSubmit → llamar hook de mutación
   ↓
7. Hook mutación hace POST/PUT al backend
   ↓
8. Si exitoso → form.reset() → onSuccess() → cerrar modal
   ↓
9. Si error → form.setError("root", ...) → mostrar alert
```

---

**Props Estándar (Siempre Usar):**

```tsx
interface [Entity]FormProps {
  initialData?: Partial<[EntityInput]>
  onSuccess: (data: [EntityInput]) => void
  onCancel: () => void
  isSubmitting?: boolean
}
```

**Patrones Avanzados:**

1. **Formulario Dinámico (Array de Items):**
   ```tsx
   // En schema.ts
   const ItemsSchema = z.array(
     z.object({ product_id: z.string(), quantity: z.number().positive() })
   )

   // En form component
   const { fields, append, remove } = useFieldArray({
     control: form.control,
     name: "items",
   })

   return (
     <>
       {fields.map((field, index) => (
         <div key={field.id}>
           {/* Campo para item[index] */}
           <Button onClick={() => remove(index)}>Eliminar</Button>
         </div>
       ))}
       <Button onClick={() => append({ product_id: "", quantity: 1 })}>
         Agregar Item
       </Button>
     </>
   )
   ```

2. **Validación Dependiente de Otros Campos:**
   ```tsx
   const OrderSchema = z.object({
     payment_method: z.enum(["card", "transfer", "cash"]),
     card_token: z.string().optional(),
   }).refine(
     (data) => {
       if (data.payment_method === "card") {
         return !!data.card_token
       }
       return true
     },
     { message: "Token de tarjeta requerido", path: ["card_token"] }
   )
   ```

---

**Checklist de Forma:**

- [ ] Schema definido en `schema.ts` con Zod
- [ ] Tipo derivado vía `z.infer<typeof Schema>`
- [ ] Props incluyen `initialData`, `onSuccess`, `onCancel`
- [ ] Validación en tiempo real (`mode: "onChange"`)
- [ ] Campos delegados a subcomponente si hay muchos
- [ ] Botón submit deshabilitado si formulario inválido
- [ ] Errores globales mostrados en Alert
- [ ] Formulario se resetea después de éxito
- [ ] `isSubmitting` prop desactiva botones
```

---

## 6. NEW SECTION: Modal/Dialog Contract

### Ubicación
Agregar como **Sección 16** (después de DataCell)

### Texto Propuesto
```
## 16. Contrato de Modales — Dialog vs. Sheet

Dos componentes contrastados: `Dialog` para confirmaciones/acciones cortas, `Sheet` para paneles complejos.

### Dialog — Diálogos Breves

Uso: Confirmaciones, alertas, selecciones simples.

**Props Comunes:**
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Abrir</Button>
  </DialogTrigger>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Confirmar eliminación</DialogTitle>
      <DialogDescription>
        Esta acción no se puede deshacer.
      </DialogDescription>
    </DialogHeader>
    {/* Contenido simple */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Eliminar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Tamaños Estándar:**
- `max-w-xs`: Muy pequeño (confirmaciones breves, ~280px)
- `max-w-sm`: Pequeño (alertas, ~384px)
- `max-w-md`: Medio (formularios simples, ~448px)
- `max-w-lg`: Grande (formularios complejos, ~512px)

---

### Sheet — Paneles Deslizantes

Uso: Formularios complejos, configuración, análisis detallado.

**Props Comunes:**
```tsx
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetTrigger asChild>
    <Button>Abrir Panel</Button>
  </SheetTrigger>
  <SheetContent side="right" className="w-[480px]">
    <SheetHeader>
      <SheetTitle>Configuración</SheetTitle>
      <SheetDescription>
        Ajusta los parámetros del módulo
      </SheetDescription>
    </SheetHeader>
    {/* Contenido complejo: formularios, listas, etc. */}
    <SheetFooter>
      {/* Botones de acción */}
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**Sides (Lados) Estándar:**
- `left`: Panel desde la izquierda (uso raro)
- `right`: Panel desde la derecha (RECOMENDADO)
- `top`: Panel desde arriba (para móvil)
- `bottom`: Panel desde abajo (para móvil)

**Ancho (lado `right`):**
- `w-[400px]`: Compacto
- `w-[480px]`: Estándar (DEFAULT)
- `w-[600px]`: Amplio (para análisis complejos)
- `w-full`: Fullscreen en móvil, ancho máximo en desktop

---

### Contrato de SheetCloseButton

El cierre de sheets/modales siempre usa `SheetCloseButton` (ver sección 11).

```tsx
<SheetHeader className="flex justify-between items-center">
  <SheetTitle>Título</SheetTitle>
  <SheetCloseButton />
</SheetHeader>
```

---

### Cuándo Usar Dialog vs. Sheet

| Escenario | Componente | Razón |
|-----------|-----------|-------|
| Confirmar eliminación | Dialog | Breve, booleano |
| Seleccionar un item | Dialog | Rápido, pocos items |
| Formulario de creación | Sheet | Complejo, múltiples campos |
| Editar record | Sheet | Complejo, validación progresiva |
| Mostrar análisis / reportes | Sheet | Contenido denso, scrolleable |
| Alerta crítica | Dialog | Bloquea hasta resolución |
| Configuración de módulo | Sheet | Múltiples opciones, preview |
```

---

## 7. NEW SECTION: Selectors Contract

### Ubicación
Agregar como **Sección 17** (después de Modales)

### Texto Propuesto
```
## 17. Contrato de Selectores — Select, ComboBox, AutoComplete

Componentes para permitir al usuario seleccionar de una lista. Cada uno tiene un propósito específico.

### Select Nativo (Shadcn)

Uso: Opciones limitadas (5-20 items), sin búsqueda.

```tsx
<Select value={selectedId} onValueChange={setSelectedId}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Selecciona un cliente" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Cliente A</SelectItem>
    <SelectItem value="2">Cliente B</SelectItem>
    <SelectItem value="3">Cliente C</SelectItem>
  </SelectContent>
</Select>
```

**Cuándo Usar:**
- Opciones estáticas o muy pocas
- Sin búsqueda
- Menú simple

---

### ComboBox (Búsqueda + Selección)

Uso: Muchas opciones (20+), búsqueda en tiempo real.

```tsx
<ComboBox
  items={customers}
  value={selectedId}
  onSelect={setSelectedId}
  searchKey="name"
  placeholder="Busca cliente..."
/>
```

**Implementación (patrón):**
```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, ChevronsUpDown } from "lucide-react"

export function ComboBox<T extends { id: string; name: string }>({
  items,
  value,
  onSelect,
  searchKey = "name",
}: ComboBoxProps<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = items.filter((item) =>
    item[searchKey as keyof T]?.toString().toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox">
          {items.find((i) => i.id === value)?.[searchKey] || "Selecciona..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Input
          placeholder="Busca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-none border-b"
        />
        <div className="max-h-[200px] overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item.id)
                setOpen(false)
                setSearch("")
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2"
            >
              <Check
                className={cn(
                  "h-4 w-4",
                  value === item.id ? "opacity-100" : "opacity-0"
                )}
              />
              {item[searchKey as keyof T]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

---

### AutoComplete Asincrónica

Uso: Datos del backend, búsqueda mientras escribes.

```tsx
<AsyncComboBox
  onSearch={async (query) => {
    const results = await searchCustomers(query)
    return results
  }}
  value={selectedId}
  onSelect={setSelectedId}
  placeholder="Busca cliente..."
/>
```

**Patrón:**
- Debounce en búsqueda (300-500ms)
- Loading state mientras busca
- Caché de resultados previos
- Max 10-20 resultados por búsqueda

---

### Cuándo Usar Cada Una

| Tipo | Items | Búsqueda | Backend | Ejemplo |
|------|-------|---------|---------|---------|
| **Select** | 5-20 | No | No | Tipo de documento |
| **ComboBox** | 20-1000 | Sí (local) | No | Lista de clientes pequeña |
| **AsyncComboBox** | Ilimitado | Sí (servidor) | Sí | Clientes (gran base de datos) |
```

---

## CHECKLIST DE IMPLEMENTACIÓN

Una vez implementadas estas mejoras:

- [ ] Leer el documento de audit (`DESIGN_CONTRACTS_AUDIT.md`)
- [ ] Actualizar StatusBadge contract (Fix Type → Variant)
- [ ] Actualizar PageHeader contract (6 props nuevos)
- [ ] Actualizar Hooks contract (patrones detallados)
- [ ] Actualizar Forms contract (ciclo de vida completo)
- [ ] Crear DataCell section (15 variantes)
- [ ] Crear Modales section (16 Dialog vs. Sheet)
- [ ] Crear Selectores section (17 tipos)
- [ ] Ejecutar `npm run type-check` para verificar que nada se rompió
- [ ] Revisar cualquier componente que contradiga los nuevos contratos
- [ ] Actualizar MEMORY.md del proyecto con hallazgos

---

## PRÓXIMOS PASOS

1. **Este PR:** Aplica estos cambios a `component-contracts.md`
2. **Siguiente PR:** Refactor de componentes que no cumplan contratos
3. **Tercero:** Crear nuevos contratos para componentes huérfanos (TransactionViewModal, CommentSystem, etc.)

---

**Fecha de Revisión:** 2026-05-15 (en 30 días)  
**Responsable:** Mantener sincronización código ↔ documentación
