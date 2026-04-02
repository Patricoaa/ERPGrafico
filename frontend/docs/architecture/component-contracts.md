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
Visualización estándar para listados y estados vacíos.

- **Props**:
  - `icon`: LucideIcon.
  - `title`: String.
  - `description`: String.
  - `action`: ReactNode (opcional).
- **Reglas**:
  - Debe usarse en todas las `DataTable` cuando no hay datos.
  - El diseño debe ser centrado con tipografía `muted-foreground`.

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


