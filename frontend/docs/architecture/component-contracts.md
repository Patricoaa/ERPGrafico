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

## 3. BaseModal
Contenedor unificado para diálogos del sistema.

- **Props**:
  - `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full'.
  - `title`: ReactNode.
  - `description`: ReactNode.
  - `footer`: ReactNode.
- **Reglas**:
  - Debe usar `Dialog` de shadcn/ui.
  - Aplicar `industrial` card styling por defecto.

## 4. FORM_STYLES
Conjunto de tokens de Tailwind para formularios unificados.

- **Tokens**:
  - `label`: Bolds, uppercase, extra-tracking.
  - `input`: Rounded-XL, border-dashed, h-10.
  - `textarea`: Min-h-100, transition focus.
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


