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
1. **Botones de Creación**: Deben ser circulares (`circular`), usar el icono `Plus` y tener fondo sólido `bg-primary` cuando se sitúan en `titleActions`.
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
  - **Radio de Borde**: Debe usar **`rounded-md`** (8px) vía el token `CARD_TOKENS.container`. Prohibido usar `rounded-2xl` o `rounded-xl` en cards estándar.
  - **Sombras**: Utilizar sombras pronunciadas (`shadow-xl` o `shadow-2xl`) para elevar los contenedores sobre el fondo.
  - **Registration Marks**: Para cards de alto impacto (dashboards, landing sections), se puede agregar `IndustryMark` como child o la clase CSS `.registration-marks`.

## 4. FORM_STYLES & Acciones
Conjunto de tokens para elementos operativos que requieren precisión visual.

- **Reglas Visuales**:
  - **Radio de Borde**: Debe ser estrictamente **`rounded-sm`** (6px) para botones, inputs y selectores. Refuerza la precisión industrial.
  - **Tipografía**: Labels en uppercase con extra-tracking.
- **Tokens**:
  - `input`: Rounded-sm (6px), border-solid, h-10.
  - `button`: Rounded-sm (6px), transiciones suaves.
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
- **Atributos de Categoría (e.g., Tipos DTE)**: Despojados de fondos de color. Deben renderizarse `font-bold text-[10px] uppercase text-muted-foreground ml-2` acompañados del ícono `text-muted-foreground/70`.
- **`StatusBadge`**: Es el **único** elemento de la columna con permiso para inyectar fondos de color (`primary`, `warning`, `destructive`, `success`) basados en `BUSINESS_STATES.md`.

## 9. IndustryMark («Marcas de Registro»)

Componente decorativo que agrega marcas de registro (crop/registration marks) propias de la industria gráfica a cualquier contenedor.

**Props:**
- `positions`: Array de `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'` (default: all 4).
- `variant`: `'corner'` (L-shaped) | `'crosshair'` (cruceta) | `'target'` (círculo) (default: `'corner'`).
- `active`: Boolean — usa `--mark-color-active` (primary) en vez del color sutil.

**Reglas de Uso:**
1. El contenedor padre **debe** tener `position: relative` (o usar la clase `.registration-marks` como alternativa CSS-only).
2. Usar con moderación: solo en contenedores principales, modales de transacción, y vistas de alto impacto.
3. **Prohibido** usar en celdas de tabla, badges, o componentes pequeños.
4. Para contenedores simples sin necesidad de control por props, preferir la clase CSS `.registration-marks`.

**Ejemplo:**
```tsx
// Con componente (más control):
<div className="relative">
  <IndustryMark variant="corner" />
  {children}
</div>

// Con clase CSS (cero JS):
<div className="registration-marks">
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
