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

---
*Documento generado automáticamente como parte del Sprint 6 - Gobernanza y Estandarización.*
