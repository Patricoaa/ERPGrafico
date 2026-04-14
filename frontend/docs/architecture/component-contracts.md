# Contrato de Componentes Shared — Frontend ERPGrafico

Este documento define la API pública, estilos y comportamientos esperados para los componentes de la capa `shared`. Estos componentes son la base de la gobernanza visual y funcional del sistema.

## 1. StatusBadge
Componente central para la representación de estados de entidades (pedidos, pagos, tareas).

- **Props**:
  - `status`: String (slug del estado).
  - `type`: 'order' | 'payment' | 'generic'.
  - `showLabel`: Boolean (default true).
- **Reglas**:
  - Debe mapear los estados a tokens semánticos: `success`, `warning`, `destructive`, `info`.
  - Nunca usar colores Tailwind hardcoded.
  - Ver [Inventario de Estados de Negocio](BUSINESS_STATES.md) para los valores aceptados por `status`.

### 7. PageHeader y PageLayout (`shared/PageHeader`, `shared/PageTabs`)

Contrato visual para todas las vistas principales del sistema.

**PageHeader Props:**
- `title`: String principal.
- `description`: Subtítulo explicativo.
- `variant`: `default` | `minimal` (minimal quita padding inferior para integrarse con tabs).
- `isLoading`: Muestra esqueletos de carga.
- `titleActions`: Espacio para botones de acción al lado del título (ej: botón Plus circular).

**PageTabs Props:**
- `tabs`: Array de `{ label, value, iconName, href }`.
- `activeValue`: El valor de la pestaña seleccionada.

**Reglas de Diseño (Industrial Premium):**
1. **Botones de Creación**: Se renderizan mediante el componente `ActionFoldButton` (un botón cuadrado de borde duro con esquina dinámica animada). **Prohibido** usar botones circulares.
2. **Estilo de Pestañas**: Usar el estilo **Industrial Underline** (borde inferior de `2px` con color `primary` al estar activo). No usar píldoras redondeadas.
3. **Contenedor**: Toda vista debe estar envuelta en `LAYOUT_TOKENS.view`.

## 2. EmptyState
Visualización estándar para listados, búsquedas y estados vacíos en cualquier parte de la interfaz.

- **Props**:
  - `icon`: LucideIcon (opcional, asignado automáticamente por `context`).
  - `title`: String (opcional, tiene valor por defecto según `context`).
  - `description`: String (opcional).
  - `context`: 'search' | 'inventory' | 'finance' | 'users' | 'generic' (default 'generic').
  - `variant`: 'full' | 'compact' | 'minimal' (default 'full').
  - `entityName`: String (ej. "Orden #1234").
  - `action`: ReactNode (Primario).
  - `secondaryAction`: ReactNode (Secundario).
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
- **Reglas Visuales**:
  - **Radio de Borde**: **`rounded-none`** siempre. El sistema es zero-radius.
  - **Marcas de Corte**: `IndustrialCard` incluye `<IndustryMark variant="crop" />` de forma nativa. El contenedor usa `overflow-visible` para permitir la proyección externa de las marcas.
  - **Sombras**: Utilizar sombras pronunciadas (`shadow-xl` o `shadow-2xl`) para elevar los contenedores sobre el fondo.
  - **Requiere `overflow-visible`**: Si el contenedor padre tiene `overflow-hidden`, las marcas de corte serán recortadas. Asegurarse de que ninguna ancestro corte el overflow.

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

## 5. CONTRATO DE HOOKS (Data Fetching)
Todo hook de feature debe seguir este patrón:

- **Naming**: `use[Entity][Action]` (ej. `useProductSearch`, `useOrderDetails`).
- **Retorno Obligatorio**: 
  - `data`: El resultado tipado (vía Zod).
  - `isLoading`: Estado de carga inicial.
  - `error`: Error formateado vía `showApiError`.
- **Regla**: Prohibido usar `useQuery` directamente en componentes UI; siempre envolver en un hook de feature.

## 6. CONTRATO DE FORMULARIOS
- **Biblioteca**: `react-hook-form` + `zod`.
- **Estructura**:
  - Carpeta `[Feature]/components/forms/`.
  - Archivo `schema.ts`: Definición única del Zod schema y el Type derivado.
- **Props Estándar**:
  - `initialData?: T`: Datos para modo edición.
  - `onSuccess: (data: T) => void`: Callback tras guardado exitoso.
  - `onCancel: () => void`: Cerrar modal o volver atrás.

## 7. CONTRATO DE SKELETONS Y ESTADOS DE CARGA
La experiencia "Industrial Premium" exige que no existan saltos visuales bruscos.

- **LoadingFallback**: Es el componente estándar para `Suspense`. 
  - Por defecto renderiza una **Tabla** (`variant="table"`).
  - Soporta `variant="card"` para vistas de rejilla.
  - La variante `spinner` queda delegada solo a procesos de fondo o elementos muy pequeños.
- **Animación**: Todo esqueleto debe usar la clase `.skeleton` que implementa el **shimmer lineal**.
- **Regla de Oro**: El esqueleto debe aproximar la altura y estructura del contenido final para minimizar el Layout Shift (CLS).

## 8. CONTRATO DE DATA-CELLS (DataTables)
La visualización de celdas en el `DataTable` debe seguir estrictamente la regla 60-30-10 de *Industrial Premium*, evitando la "saturación de badges". Todas las celdas y headers deben estar alineados usando `flex justify-center items-center` para mantener un balance armónico.

- **`DataCell.Text`**: `font-sans text-sm font-medium text-foreground truncate flex justify-center items-center`. Para texto general.
- **`DataCell.DocumentId`**: `font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary flex justify-center items-center transition-colors`. Sin fondos de colores.
- **`DataCell.ContactLink`**: `font-sans text-sm font-medium text-primary hover:underline cursor-pointer flex justify-center items-center`. Convierte la identidad humana en interactiva. **Incluye obligatoriamente un icono `ExternalLink` (h-3 w-3) a su derecha** para otorgar feedback visual rápido de que es un ancla. Detiene la propagación (`e.stopPropagation()`) de la fila al ser presionado.
- **`DataCell.Date`**: `tabular-nums text-sm text-foreground/80 flex justify-center items-center`.
- **`DataCell.Currency`** (vía `MoneyDisplay`): El dinero debe ir centrado como norma general de balance horizontal o derecha financiera, sin prop `showColor=true` salvo para riesgo comercial o deudas.

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

