# Estándares de Diseño: Formularios Premium

Este documento resume las reglas de diseño aplicadas de forma consistente para estandarizar la experiencia de usuario (UX/UI) en los formularios de la aplicación.

## 1. Encabezado Premium (Header)
- **Patrón**: `Icono` + `Título Principal` + `Descripción de Contexto` o `Badges`.
- **Estilo**: El icono se ubica en un contenedor con fondo suave (`bg-primary/10`).
- **Padding**: Usar siempre `p-2` con `rounded-xl` para el contenedor de icono (ej: Contactos, Productos, BOM).
- **Título**: El título principal debe usar `font-bold tracking-tight`.
- **Descripción**: Texto pequeño (`text-xs`) o `Badge` (ej: "BOM", "Variante") que muestra metadatos relevantes.
### 1. Header (Premium Style)
- **Component**: `BaseModal` header sections.
- **Alignment**: Use the default (left-aligned) header. Avoid `variant="wizard"` unless a centered layout is explicitly required for a simplified flow.
- **Icon Container**: `p-2 rounded-xl bg-primary/10 text-primary`.
- **Description**: Use the `description` prop in `BaseModal`. Wrapper: `div` with `flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest`.
- **Description Separators**: Use `<span className="opacity-30">|</span>` between metadata items.

### 2. Buttons & Actions
- **Placement**: Footer should use `flex justify-end gap-3 w-full px-6 py-4` (add `border-t border-border/40` if not in Wizard mode).
- **Style**: All buttons in footer must use `rounded-xl text-xs font-bold`.
- **Cancel Button**: `variant="outline"` with `border-primary/20 hover:bg-primary/5`.
- **Submit Button**: Standard primary variant (or `success` variant if using a specialized library, but generally standard primary). Avoid over-styling with `font-black` or custom gradients unless explicitly needed for a "Hero" action.

### 3. Layout & Separators
- **Grid**: Use `grid-cols-12` for responsive layouts.
- **Row Alignment**: Common related fields (like Month/Year) should be on the same row as their primary selector (like Supplier) when possible.
- **Section Dividers**:
  ```tsx
  <div className="flex items-center gap-2 pt-2 pb-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        Section Title
      </span>
      <div className="flex-1 h-px bg-border" />
  </div>
  ```

### 4. Interactive Elements
- **Switches**: Use `p-4 border rounded-xl` containers for main toggles (e.g., Active/Inactive).
- **Inputs**: Use `FORM_STYLES.input` (usually `rounded-xl`).
- **Labels**: Use `FORM_STYLES.label` (usually `text-xs font-bold uppercase tracking-wider`).

## 5. Sidebar de Actividad (Audit)
- **Visibilidad**: Solo en modo **Edición** (`initialData` presente).
- **Renderizado**: Lado derecho del formulario dentro de un contenedor con borde izquierdo.
- **Tamaño del Modal**: Se incrementa automáticamente (ej: de `lg` a `xl`) para mantener el área del formulario cómoda al aparecer el sidebar.

## 6. Sincronización de Precios
- **Lógica**: Sincronización bidireccional inmediata entre campos **Neto** y **Bruto** usando `PricingUtils`.
- **Feedback**: Pequeñas etiquetas de ayuda (`text-[10px]`) para aclarar el cálculo (ej: "Precio UNITARIO bruto").

## 7. Estado Activo/Inactivo
- **Componente**: `Switch` para estados operativos (Habilitar Venta, Activo). `Checkbox` para selecciones en listas o grids.
- **Contexto**: Se prefieren los switches con iconos descriptivos (ej: `ShoppingCart`, `Truck`) y colores temáticos (`emerald` para éxito/venta, `amber` para compra).
- **Contenedor**: Enmarcado en un recuadro suave (`p-4 border rounded-xl bg-muted/5`) o alineado en rejillas de configuración de tipo de producto.

## 8. Uso de Colores (Botones, Switches y Badges)
- **Consistencia Visual**: Los elementos interactivos deben seguir una paleta de aplicación controlada y atenuada.
- **Botones Secundarios**: Deben usar bordes transparentes/suaves con efectos de interacción sutiles: `border-primary/20 hover:bg-primary/5 rounded-xl text-xs font-bold`.
- **Switches y Feedback de Estado**: 
  - Estados Inactivos/Borrador: Tonos atenuados `text-muted-foreground` o bordes sutiles.
  - Estados Activos/Exitosos: Utilizar la paleta Esmeralda (`text-emerald-700`, `bg-emerald-50`, `border-emerald-200`) para denotar confirmación o activación de estado base de un registro u operación.
- **Contenedores de Agrupación**: Los "Cards" internos o de advertencia ligera deben usar `bg-primary/5` o `bg-muted/5` con bordes suaves que resalten pero no saturen la pantalla.

## 9. Grid de Precios e Impuestos
En formularios comerciales, los precios se agrupan en una fila de 4 columnas:
1. **Neto**: `Input` editable.
2. **IVA**: `div` lectura con `bg-muted/20 border-dashed rounded-xl`.
3. **Bruto**: `Input` editable con borde destacado (`border-primary/30`).
4. **Margen**: Tarjeta de feedback visual (`bg-emerald-500/10`) con badge de porcentaje.

## 10. Sistema de Pestañas (Tabs)
Los formularios e interfaces deben usar un diseño de pestañas adaptado a la naturaleza de la vista:
- **Formularios de Entidades Complejas (Ej: Formulario de Productos)**: 
  - Utilizan una estructura interna de pestañas (`Tabs`, `TabsList`, `TabsContent`) dentro del componente modal.
  - **Estilo de la lista:** `bg-transparent p-0`.
  - **Estilo de los gatillos:** `border-b-2 border-transparent data-[state=active]:border-primary` apoyado con `text-[11px] uppercase font-bold tracking-wider` y un icono asociado.
- **Formularios o Vistas de Registros/Documentos Transaccionales (Ej: Movimientos de Tesorería, Ajuste de Stock)**: 
  - Se utiliza una navegación más macro mediante pestañas estilo píldora usando `<ServerPageTabs>`.
  - Este estilo permite alternar entre vistas afines de un mismo módulo (similar a cómo `/inventory/products` agrupa Productos, Categorías y Reglas de Precio) liberando el interior de los formularios transaccionales que usualmente son flujos lineales o secuenciales en vez de múltiples módulos de configuración.
