# Contrato de Componentes Shared — Frontend ERPGrafico

Este documento define la API pública, estilos y comportamientos esperados para los componentes de la capa `shared`. Estos componentes son la base de la gobernanza visual y funcional del sistema.

## 1. StatusBadge
Componente central para la representación de estados de entidades (pedidos, pagos, tareas).

- **Props**:
  - `status`: String (slug del estado, ej. `'DRAFT'`, `'PAID'`, `'CANCELLED'`). Case-insensitive.
  - `variant`: `'default' | 'hub' | 'dot'` (default: `'default'`).
    - `'default'`: Badge estándar con etiqueta de texto.
    - `'hub'`: Círculo con icono para dashboards (requiere prop `icon`).
    - `'dot'`: Punto pulsante + etiqueta compacta.
  - `label`: String (override de etiqueta automática, opcional).
  - `icon`: LucideIcon (requerido para `variant='hub'`).
  - `tooltip`: String (solo para `variant='hub'`, muestra Tooltip al hover).
  - `size`: `'sm' | 'md' | 'lg'` (default: `'md'`).
  - `className`: String (clases CSS adicionales).
- **Reglas**:
  - Debe mapear los estados a tokens semánticos: `success`, `warning`, `destructive`, `info`.
  - Nunca usar colores Tailwind hardcoded.
  - Ver [Inventario de Estados de Negocio](BUSINESS_STATES.md) para los valores aceptados por `status`.

## 2. EmptyState
Visualización estándar para listados, búsquedas y estados vacíos en cualquier parte de la interfaz.

- **Props**:
  - `icon`: LucideIcon (opcional, asignado automáticamente por `context`).
  - `title`: String (opcional, tiene valor por defecto según `context`).
  - `description`: String (opcional).
  - `context`: 'search' | 'inventory' | 'finance' | 'users' | 'generic' | 'database' | 'production' (default 'generic').
  - `variant`: 'full' | 'compact' | 'minimal' (default 'full').
  - `entityName`: String (ej. "Orden #1234").
  - `action`: ReactNode (Primario).
  - `secondaryAction`: ReactNode (Secundario).
  - `className`: String (clases CSS adicionales para el contenedor).
- **Reglas**:
  - **Uso Obligatorio**: Debe usarse en lugar de cualquier `div` o `p` con mensajes "No hay datos".
  - **Contexto**:
    - `search`: Usa `SearchX`. Título por defecto: "Sin resultados".
    - `finance`: Usa `Receipt`. Título por defecto: "Sin movimientos financieros".
    - `inventory`: Usa `Package`. Título por defecto: "Sin stock / productos".
  - **Tipografía**: Títulos siempre en `font-heading` + `uppercase` + `extrabold`.
  - **Variante Compact**: Usar dentro de modales pequeños o dropdowns, eliminando el padding excesivo y reduciendo el icono.

## 3. IndustrialCard & BaseModal
Contenedores unificados que definen la jerarquía visual del sistema.

- **Variantes de IndustrialCard**:
  - `industrial`: Card con stripe superior y **sombra profunda (shadow-2xl)**.
  - `list`: Variante minimalista para listados, con **sombra 2xl solo en hover**.
  - `standard`: Card con borde discontinuo para estados secundarios.
  - `glass`: Variante translúcida con efecto glassmorphism, para overlays y paneles flotantes.
- **Reglas Visuales**:
  - **Radio de Borde**: **`rounded-none`** siempre. El sistema es zero-radius.
  - **Marcas de Corte**: `IndustrialCard` incluye `<IndustryMark variant="crop" />` de forma nativa. El contenedor usa `overflow-visible` para permitir la proyección externa de las marcas.
  - **Sombras**: Utilizar sombras pronunciadas (`shadow-xl` o `shadow-2xl`) para elevar los contenedores sobre el fondo.
  - **Requiere `overflow-visible`**: Si el contenedor padre tiene `overflow-hidden`, las marcas de corte serán recortadas. Asegurarse de que ninguna ancestro corte el overflow.

### BaseModal — Props Completas

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `open` | boolean | — | Requerido |
| `onOpenChange` | `(open: boolean) => void` | — | Requerido |
| `title` | `string \| ReactNode` | — | Requerido |
| `description` | `string \| ReactNode` | — | Opcional |
| `children` | ReactNode | — | Requerido |
| `footer` | ReactNode | — | Área de botones inferior |
| `headerActions` | ReactNode | — | Acciones en el header |
| `size` | string | `'default'` | Vía `dialogContentVariants` |
| `variant` | `'default' \| 'transaction' \| 'wizard' \| 'raw'` | `'default'` | Estilo visual |
| `showCloseButton` | boolean | `true` | Muestra X de cierre |
| `hideScrollArea` | boolean | `false` | Desactiva scroll interno |

**Variantes de BaseModal:**
- `'default'`: Header con borde inferior, fondo estándar.
- `'transaction'`: Header `bg-primary text-primary-foreground`, sin borde, sombra `shadow-2xl`.
- `'wizard'`: Header con borde inferior más delgado.
- `'raw'`: Sin bordes en header/footer, sin scroll-area automático.

## 4. FORM_STYLES & Acciones
Conjunto de tokens para elementos operativos que requieren precisión visual.

- **Reglas Visuales**:
  - **Radio de Borde: CERO**. El mandato de "Industrial Premium" establece **zero-radius (bordes rectos de 90°)** en **todos** los elementos del sistema sin excepción. Esto aplica a botones, inputs, cards, modales, popovers y contenedores.
  - Para botones de acción principal (como el `+` de creación), se utiliza el `ActionFoldButton`, el cual mantiene de forma estricta los bordes cuadrados pero añade un feedback kinético (un "doblez" o pliegue en la esquina superior derecha) en estado interactivo.
  - **Tipografía**: Labels en uppercase con extra-tracking.

> [!IMPORTANT]
> **Prohibido**: Usar `rounded-sm`, `rounded-md`, `rounded-lg` o cualquier variante diferente de `rounded-none` en componentes de negocio. El token CSS `--radius: 0` en `globals.css` es la fuente de verdad. No sobreescribir.

- **Tokens**:
  - `input`: `rounded-none`, border-solid, h-10.
  - `button`: `rounded-none`, transiciones suaves.
  - **Botones Principales de Proceso**: Para acciones primarias ("Guardar", "Siguiente", "Ejecutar") en áreas transaccionales como Modales, Wizards o Sheets, se **exige** el uso del componente estandarizado `ActionSlideButton` (`components/shared/ActionSlideButton`). 
    - Este botón utiliza una variante "Outline/Ghost" en reposo y aplica un deslizamiento táctico (Slide-Fill in) magnético desde la izquierda al apuntar, conservando el espíritu kinético sin añadir saturación estática.
  - `sectionHeader`: Industrial separator style. Puede usar `.die-cut-separator` como alternativa a bordes sólidos.

## 5. CONTRATO DE HOOKS — Patrones de Data Fetching

Existen 3 patrones según el contexto. Elegir el patrón correcto según el caso de uso.

### Patrón A — `useSuspenseQuery` (TanStack Query) — PREFERIDO para listas

Usar cuando el componente se envuelve en un `<Suspense>` boundary (lo cual es obligatorio en toda page route).

```tsx
function useOrders(filters?: OrderFilters) {
  const { data: orders, refetch } = useSuspenseQuery({
    queryKey: [...ORDERS_QUERY_KEY, filters],
    queryFn: () => ordersApi.getOrders(filters),
  })

  const createMutation = useMutation({
    mutationFn: ordersApi.createOrder,
    onSuccess: () => refetch(),
    onError: showApiError,   // ← errores como toast, no como estado
  })

  return {
    orders,                                  // T[] directamente
    refetch,
    createOrder: createMutation.mutateAsync, // acción nombrada
    isCreating: createMutation.isPending,    // isPending → isCreating
  }
}
```

**Retorno estándar Patrón A:**
- `[entities]`: Array de la entidad (nunca `data`)
- `refetch`: Función de recarga
- `[verbEntity]`: Mutaciones como `createOrder`, `updateOrder`, `deleteOrder`
- `is[Verbing]`: Flags `isCreating`, `isUpdating`, `isDeleting`, `isAnnulling`
- **Sin `isLoading`** (lo maneja Suspense)
- **Sin `error`** (se despacha como toast internamente)

---

### Patrón B — `useQuery` regular — Para datos opcionales / con fallback

Usar cuando el componente NO tiene Suspense boundary, o cuando el dato puede estar ausente sin bloquear el render.

```tsx
function useTreasuryAccounts(): UseTreasuryAccountsReturn {
  const { data: accounts = [], isLoading, refetch } = useQuery({ ... })
  return { accounts, isLoading, refetch, createAccount, isCreating }
}
```

**Retorno estándar Patrón B:**
- `[entities]`: Array con default `[]` en destructuring
- `isLoading`: Boolean
- `refetch`
- Mutaciones y flags de mutación

---

### Patrón C — `useState` + fetch manual — Para reportes y operaciones complejas

Usar para reportes on-demand, operaciones con lógica de negocio compleja, o fetch que no es automático al montar.

```tsx
function useTrialBalance() {
  const [data, setData] = useState<TrialBalanceReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchTrialBalance = async (params: TrialBalanceParams) => {
    try {
      setIsLoading(true)
      const res = await accountingApi.getTrialBalance(params)
      setData(res.data)
    } catch (error) {
      showApiError(error)  // ← toast, no estado
    } finally {
      setIsLoading(false)
    }
  }

  return { data, isLoading, fetchTrialBalance }
}
```

---

### Regla de Errores (Todos los Patrones)

**Los hooks NUNCA exponen `error` como campo del return.**

- Los errores se manejan internamente con `showApiError(error)` de `lib/errors.ts`.
- `showApiError()` dispara un toast de error automáticamente.
- El componente consumidor no necesita manejar errores del hook.
- Para errores críticos que deban bloquear el render, usar un `ErrorBoundary`.

### Naming Convention

```
use[Entity][Action]  →  useProductSearch, useOrderDetails
use[Entity]s         →  useOrders, useInvoices, useProducts
```

## 6. CONTRATO DE FORMULARIOS

### Patrón A — react-hook-form + Zod (formularios complejos)

El schema Zod se define **inline** en el archivo del componente (no en `schema.ts` separado).

**Estructura:**
```tsx
// Schema + Type derivado (en el mismo archivo)
const orderSchema = z.object({
  customer_id: z.string().min(1, "Requerido"),
  lines: z.array(lineSchema).min(1, "Al menos un item"),
})
type OrderFormValues = z.infer<typeof orderSchema>

// Props estándar
interface CreateOrderFormProps {
  initialData?: Partial<OrderFormValues>
  onSuccess?: (data: OrderFormValues) => void
  onCancel: () => void
}

// Form
const form = useForm<OrderFormValues>({
  resolver: zodResolver(orderSchema) as any,
  defaultValues: initialData ?? { lines: [defaultLine] },
})

// Estado de carga — usar useState local, NO form.formState.isSubmitting
const [loading, setLoading] = useState(false)

const onSubmit = async (data: OrderFormValues) => {
  try {
    setLoading(true)
    await createOrderMutation(data)
    form.reset()
    onSuccess?.(data)
  } catch (error) {
    showApiError(error)
  } finally {
    setLoading(false)
  }
}
```

**Reglas:**
- Tipo derivado con `z.infer<typeof schema>` — PROHIBIDO tipado manual.
- Estado de carga con `useState`, no `form.formState.isSubmitting`.
- `form.reset()` después del éxito.
- Errores de red vía `showApiError()` (toast), no `form.setError`.

### Patrón B — Estado local (formularios simples)

Para formularios de 2–4 campos sin validación compleja:

```tsx
const [amount, setAmount] = useState("")
const [loading, setLoading] = useState(false)

const handleSubmit = async () => {
  if (!amount) return
  try {
    setLoading(true)
    await createRecord({ amount: Number(amount) })
    onSuccess()
  } catch (error) {
    showApiError(error)
  } finally {
    setLoading(false)
  }
}
```

**Cuándo usar cada patrón:**

| Patrón | Cuándo Usar |
|--------|------------|
| rhf + Zod | Formularios con 4+ campos, validación cruzada, arrays dinámicos |
| Estado local | Formularios de 2-3 campos, confirmaciones, inputs numéricos simples |

## 7. CONTRATO DE SKELETONS Y ESTADOS DE CARGA
La experiencia "Industrial Premium" exige que no existan saltos visuales bruscos.

- **LoadingFallback**: Es el componente estándar para `Suspense`. 
  - Por defecto renderiza una **Tabla** (`variant="table"`).
  - Soporta `variant="card"` para vistas de rejilla.
  - La variante `spinner` queda delegada solo a procesos de fondo o elementos muy pequeños.
- **Animación**: Todo esqueleto debe usar la clase `.skeleton` que implementa el **shimmer lineal**.
- **Regla de Oro**: El esqueleto debe aproximar la altura y estructura del contenido final para minimizar el Layout Shift (CLS).

## 8. CONTRATO DE DATA-CELLS (DataTables)

Todos los sub-componentes están en `@/components/ui/data-table-cells` como el objeto `DataCell`.

La visualización de celdas debe seguir estrictamente la regla 60-30-10 de *Industrial Premium*, evitando la "saturación de badges". Todas las celdas y headers deben estar alineados usando `flex justify-center items-center` para mantener un balance armónico.

| Sub-componente | Props Clave | Uso |
|---|---|---|
| `DataCell.Text` | `children`, `className` | Texto general, truncado, centrado |
| `DataCell.Secondary` | `children` | Texto secundario `text-xs text-muted-foreground` |
| `DataCell.Code` | `children` | Monoespaciado `font-mono`, fallback a "-" |
| `DataCell.DocumentId` | `type?`, `number`, `className` | Folio formateado vía `formatDocumentId()` |
| `DataCell.ContactLink` | `children`, `contactId?`, `onClick?` | Nombre clickeable con `ExternalLink`. Abre `GlobalModals`. |
| `DataCell.Link` | `children`, `href?`, `onClick?`, `external?` | Enlace de documento |
| `DataCell.Number` | `value`, `suffix?`, `prefix?`, `decimals?` | Número con separadores de locale |
| `DataCell.Currency` | `value`, `currency?` (default CLP), `digits?` | Wrapper de `MoneyDisplay`, centrado |
| `DataCell.Variance` | `value`, `currency?` | Como Currency con `showColor=true` (rojo/verde) |
| `DataCell.NumericFlow` | `value`, `unit?`, `showSign?` | Flujo +/-, `font-mono font-black` |
| `DataCell.Progress` | `value`, `max?` (default 100), `label?` | Barra de progreso con etiqueta |
| `DataCell.Date` | `value`, `showTime?` (default false) | Fecha vía `formatPlainDate()`, `tabular-nums` |
| `DataCell.Status` | `status`, `label?`, `map?`, `variant?` | Wrapper de `StatusBadge` |
| `DataCell.Badge` | `children`, `variant?` | Label informacional (no estado) |
| `DataCell.Icon` | `icon`, `color?` | Icono con fondo circular muted |
| `DataCell.Action` | `icon`, `onClick?`, `title?`, `compact?` | Botón con `CropFrame` + `Tooltip` |
| `DataCell.ActionGroup` | `children` | Contenedor con `stopPropagation` |

> [!WARNING]
> `DataCell.Status` acepta `variant="subtle"` que **no existe en StatusBadge**. Evitar ese valor hasta que se implemente en StatusBadge.

## 9. IndustryMark («Marcas de Registro»)

Componente decorativo que agrega marcas de registro (crop/registration marks) propias de la industria gráfica a cualquier contenedor.

**Props**:
- `positions`: Array de `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'` (default: all 4).
- `variant`: `'crop'` (abiertas, default) | `'corner'` (cerradas, legacy) | `'crosshair'` (cruceta) | `'target'` (círculo).
- `active`: Boolean — usa `--mark-color-active` (primary) en vez del color sutil.

**Variante `crop` (Actualización Técnica):**
Esta variante emula las marcas de corte profesionales de imprenta. Posee un desplazamiento (offset) hacia el **exterior** del contenedor (gap de 2px a 4px) para encuadrar el contenido desde fuera. Sus líneas son segmentos independientes de **6px** a **12px** de longitud, reforzando la identidad de precisión industrial.

**Reglas de Uso:**
1. El contenedor padre **debe** tener `position: relative` (o usar la clase `.registration-marks` como alternativa CSS-only).
2. Usar con moderación: solo en contenedores principales, modales de transacción, y vistas de alto impacto.
3. **Prohibido** usar en celdas de tabla, badges, o componentes pequeños.
4. Para contenedores simples sin necesidad de control por props, preferir la clase CSS `.registration-marks`.

**Ejemplo:**
```tsx
<div className="relative">
  <IndustryMark />
  {children}
</div>
```

## 10. Vocabulario Visual de Industria Gráfica

Estos elementos formalizan la identidad visual que conecta al ERP con el mundo de la imprenta y la producción gráfica.

| Elemento | Clase CSS / Componente | Descripción | Uso recomendado |
|---|---|---|---|
| Marcas de registro | `.registration-marks` / `IndustryMark` | Crop marks en esquinas | Contenedores principales, modales |
| Guías de sangrado | `.bleed-guides` | Grilla decorativa 80px | Paneles de fondo, vistas vacías |
| Separador die-cut | `.die-cut-separator` | Línea punteada | Separadores de secciones |
| Textura de ruido | `body` background (globals.css) | SVG noise fractal | Solo a nivel body, no replicar |
| Barras de color CMYK | `ColorBar` (Componente) | Tira de control de densidades | Márgenes, informes, dashboards técnicos |

**Regla de proporcionalidad:** El vocabulario gráfico es decorativo y sutil (opacidades del 3-8%). No debe competir con el contenido funcional. Si un usuario no nota conscientemente las marcas, están funcionando correctamente.

## 11. SheetCloseButton

El cierre estandarizado para Sheets y Modales de alta gama. Este componente sustituye al botón de cierre por defecto de Radix/shadcn cuando el diseño requiere una interacción más integrada y refinada.

**Visual Design:**
- **Forma**: Circular (`rounded-full`).
- **Variante**: `ghost`.
- **Icono**: `X` (size-4).
- **Dimensiones**: `h-8 w-8` (o `h-9 w-9` en modales expandidos).
- **Comportamiento**: Debe centrar el icono perfectamente y usar transiciones suaves de opacidad y color de fondo.

**Reglas de Uso:**
1. **Uso Obligatorio**: En `ModuleSettingsSheet` y paneles de análisis laterales.
2. **Posición**: Top-right con suficiente padding (normalmente `top-4 right-4` o dentro de un `flex` header).
3. **Consistencia**: No usar variantes de color (`destructive`, `primary`) para el botón de cierre. Debe ser siempre neutral (`text-muted-foreground`).
4. **Accesibilidad**: Incluir siempre un `span.sr-only` con el texto "Cerrar".

## 12. ColorBar

Componente que emula las barras de control de tinta CMYK (Cian, Magenta, Amarillo, Negro) fundamentales en la industria gráfica.

**Props:**
- `orientation`: `'horizontal' | 'vertical'`.
- `showScales`: `boolean` (muestra la gradación de densidades 100% a 0%).
- `className`: Estilos adicionales.

**Reglas de Uso:**
2. **Proporción**: Debe mantenerse pequeño (`w-4` o `h-4`) para no distraer de la información operativa.

## 13. CropFrame (Interacciones de Estado y Hover)

Componente de interacción dinámica diseñado específicamente para dar feedback visual (hover/focus) mediante un "encuadre" animado. Funciona proyectando líneas de corte dinámicas hacia el exterior de un contenedor interactivo.

**Reglas de Uso (Prevención de Saturación Visual):**
1. **Ratio 1:1 Exclusivo (Botones Cuadrados)**: Su uso está **restringido** a elementos cuadrados cuyo contenido sea íntegramente de naturaleza iconográfica (ej: `w-8 h-8` o `w-10 h-10`). Ideal para barras de navegación laterales (`MiniSidebar`), acciones flotantes, y acciones globales del header (`UserActions`).
2. **Prohibición en Botones Estándar**: **NO DEBE USARSE** en botones rectangulares o de texto extenso (ej. "Guardar", "Cancelar"). Aplicarlo a estos elementos deforma la escala de las marcas de corte y causa alta saturación visual. Para botones regulares, se deben usar cambios de color de fondo (`hover:bg-primary/90`) o flat Ghost buttons standard.
3. **Restricción de Anidamiento Masivo**: Nunca debe iterarse dentro de listas muy densas de datos (por ejemplo, en celdas de un `DataTable` o un `ReportTable`). Para tablas o áreas de datos, la interacción principal es el subrayado (`hover:underline`) o color (`hover:text-primary`).

**Implementación Arquitectónica:**
- Todos los usos interactivos de `<CropFrame>` deben ir acompañados de un `Tooltip` semántico.
- Soporta variantes:
    - `"default"`: (size=6, gap=2) - Equilibrio estándar para botones de acción.
    - `"compact"`: (size=4, gap=1) - Tighter look para áreas de alta densidad (DataTables, MiniSidebar).
- El componente `CropFrame` utiliza internamente dependencias de `framer-motion` y expone un `forwardRef`. Por esta razón, el componente debe envolver un elemento que *reenvíe explícitamente el ref* o se integrará directamente de forma correcta con `TooltipTrigger asChild`.
- **Aviso de Overflow**: Contenedores anfitriones flotantes deben utilizar `overflow-x-hidden` si el efecto rebote (`spring`) del frame corre el riesgo de desbordar la caja global y provocar un salto de layout (layout shift por aparición de scrollbar horizontal).

## 14. createActionsColumn (Columna de Acciones Reutilizable)

Función factory que genera la columna estándar de acciones para cualquier `DataTable`. **Obligatorio** usar en lugar de definir manualmente `{ id: "actions", header: ..., cell: ... }`.

**Ubicación:** `@/components/ui/data-table-cells` (exportación nombrada).

**API:**
```tsx
createActionsColumn<TData>({
  renderActions: (item: TData) => ReactNode,  // Obligatorio
  headerLabel?: string,                        // Default: "Acciones"
})
```

**Ejemplo de uso:**
```tsx
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"

const columns = [
  // ...data columns,
  createActionsColumn<Product>({
    renderActions: (item) => (
      <>
        <DataCell.Action icon={Pencil} title="Editar" onClick={() => edit(item)} />
        <DataCell.Action icon={Trash2} title="Eliminar" onClick={() => del(item)} />
      </>
    ),
  }),
]
```

**Lo que encapsula automáticamente:**
- `id: "actions"` estandarizado.
- Header con tipografía industrial (`text-[10px] font-bold uppercase tracking-widest`).
- `<DataCell.ActionGroup>` como wrapper con `stopPropagation` integrado.
- `enableSorting: false` y `enableHiding: false`.

**Reglas:**
1. **Uso Obligatorio**: Toda tabla que tenga acciones por fila **debe** usar `createActionsColumn`. Crear columnas de acciones manuales está **prohibido**.
2. **Contenido de `renderActions`**: Solo debe contener componentes `<DataCell.Action>`. No mezclar con otros elementos.
3. **Acciones Condicionales**: Se permiten expresiones condicionales (`{condition && <DataCell.Action ... />}`) dentro de `renderActions`.

> [!IMPORTANT]
> **Anti-patrón**: Definir `{ id: "actions", header: () => ..., cell: ({ row }) => ... }` manualmente en una tabla. Usar siempre `createActionsColumn`.

---

## 15. PageHeader — Encabezado de Página (HeaderProvider)

**Arquitectura:** `PageHeader` **retorna null**. Sincroniza su estado al `HeaderProvider` global vía `useHeader()`. El render visible ocurre en `DashboardShell`. Esto permite actualizar el header desde cualquier profundidad del árbol de componentes sin teleportación de DOM.

**Props:**
- `title`: String — requerido.
- `description`: String — subtítulo opcional.
- `icon`: LucideIcon — icono a la izquierda del título (opcional).
- `iconName`: String — nombre de icono vía `DynamicIcon` (alternativa a `icon`).
- `titleActions`: ReactNode — acciones junto al título (usar `ActionFoldButton` para el botón "+").
- `isLoading`: Boolean — esqueletos en el header.
- `status`: `PageHeaderStatus` — indicador de estado de sincronización.
  - Tipo: `{ label: string; type?: 'synced' | 'saving' | 'error' | 'warning' | 'info'; icon?: LucideIcon; iconName?: string }`
- `variant`: `'default' | 'minimal'` — `minimal` elimina borde inferior (para integración con tabs).
- `children`: ReactNode — controles del área derecha (exportar, filtrar, etc.).
- `configHref`: String — URL de configuración; agrega ícono de engranaje automáticamente.
- `className`: String — clases adicionales.

**Reglas:**
1. Usar `variant='minimal'` cuando la página integra `PageTabs` debajo del header.
2. Usar `titleActions` con `ActionFoldButton` para botones de creación.
3. Usar `status` para autosave o cambios pendientes.
4. `PageHeaderButton` con `circular=true` renderiza `ActionFoldButton`. Sin `circular`, renderiza un `Button` estándar `rounded-none`.

---

## 16. Modales — Dialog vs. Sheet

| Criterio | Dialog | Sheet |
|---------|--------|-------|
| Complejidad | Confirmaciones, alerts, selección simple | Formularios, análisis, configuración |
| Bloqueo | Sí (modal blocking) | No (puede coexistir) |
| Ancho | `max-w-xs` a `max-w-lg` | `w-[400px]` a `w-[600px]` |
| Scroll | No (contenido debe ser corto) | Sí (contenido largo nativo) |

**Cierres en Sheet:** Siempre usar `SheetCloseButton` (ver Sección 11).

**Tamaños estándar para Dialog:**
- `max-w-xs` (280px): confirmaciones breves
- `max-w-sm` (384px): alertas
- `max-w-md` (448px): formularios simples
- `max-w-lg` (512px): formularios complejos

**Anchos estándar para Sheet:**
- `w-[400px]`: compacto
- `w-[480px]`: estándar (DEFAULT)
- `w-[600px]`: análisis amplio

---

## 17. Selectores — Select vs. ComboBox

| Tipo | Ítems | Búsqueda | Cuándo Usar |
|------|-------|---------|-------------|
| `Select` (shadcn) | 5–20 | No | Opciones estáticas (tipo de doc, método de pago) |
| ComboBox (Popover + Input) | 20–500 | Local | Listas medianas cargadas al montar |
| ComboBox Async | Ilimitado | Servidor | Clientes, proveedores, productos (grandes catálogos) |

**Patrón ComboBox Async:** Debounce 300–500ms, máximo 20 resultados, loading skeleton mientras busca.

**Restricción:** Nunca usar `Select` para opciones que puedan crecer indefinidamente en producción.

