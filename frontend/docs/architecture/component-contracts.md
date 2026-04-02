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
  - **Radio de Borde**: Debe ser siempre **`rounded-2xl`** (1rem) para todos los contenedores y modales.
  - **Sombras**: Utilizar sombras pronunciadas (`shadow-xl` o `shadow-2xl`) para elevar los contenedores sobre el fondo.

## 4. FORM_STYLES & Acciones
Conjunto de tokens para elementos operativos que requieren precisión visual.

- **Reglas Visuales**:
  - **Radio de Borde**: Debe ser estrictamente **`rounded`** (0.25rem) para botones, inputs y selectores.
  - **Tipografía**: Labels en uppercase con extra-tracking.
- **Tokens**:
  - `input`: Rounded (0.25rem), border-solid, h-10.
  - `button`: Rounded (0.25rem), transiciones suaves.
  - `sectionHeader`: Industrial separator style.

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


