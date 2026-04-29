# Button

El sistema de botones de ERPGrafico es una **jerarquía de 3 capas**. Elegir la capa correcta es obligatorio; crear un botón ad-hoc con estilos en línea está **prohibido**.

**Layer**: 20-contracts
**Owner**: frontend-team
**Status**: active
**Last review**: 2026-04-23

---

## 1. Jerarquía de 3 Capas

```
Capa 1 — Primitiva base:   components/ui/button.tsx          (shadcn/ui)
Capa 2 — Acciones de ERP:  components/shared/ActionButtons.tsx (Submit/Cancel/Danger)
                           components/shared/ActionSlideButton.tsx (Premium Kinetic)
Capa 3 — Acciones de toolbar: components/shared/ToolbarCreateButton.tsx
```

**Regla de uso:** Usar siempre la capa **más específica** que aplique. Solo bajar a la capa anterior cuando la superior no cubre el caso.

---

## 2. Capa 1 — Primitiva `Button` (`@/components/ui/button`)

Variantes disponibles (definidas por CVA):

| Variante       | Visual                                | Cuándo usar en ERP |
|----------------|---------------------------------------|--------------------|
| `default`      | Fondo `primary`, texto blanco         | Acción principal de una vista (Crear, Confirmar, Procesar) cuando **no** hay un wrapper de Capa 2 |
| `destructive`  | Fondo rojo, texto blanco              | Eliminar (sólo si no se puede usar `DangerButton`) |
| `outline`      | Borde, fondo transparente             | Acción secundaria neutral (Cancelar **sólo si** no se usa `CancelButton`) |
| `secondary`    | Fondo `secondary`                     | Acción alternativa de menor jerarquía (ej. "Vista previa") |
| `ghost`        | Sin fondo, hover suave                | Acciones terciarias en tablas, íconos de contexto |
| `link`         | Solo texto subrayado                  | Navegación en línea dentro de texto corrido |

Tamaños disponibles:

| Size       | Altura | Uso típico                      |
|------------|--------|---------------------------------|
| `default`  | 40px   | Botones estándar en modales/forms |
| `sm`       | 36px   | Toolbars, filtros, acciones de fila |
| `lg`       | 48px   | CTAs destacadas de página       |
| `icon`     | 40×40  | Botón cuadrado con solo ícono   |
| `icon-sm`  | 36×36  | Ícono en tabla/sidebar          |
| `icon-lg`  | 48×48  | Ícono en hero                   |

> **Nota:** `asChild` permite delegar el renderizado a un componente hijo (ej. `Link`). Solo usar para casos de navegación.

---

## 3. Capa 2 — `ActionButtons` (`@/components/shared`)

**Importación única:** `import { SubmitButton, CancelButton, DangerButton, IconButton } from "@/components/shared"`

Estos wrappers son la **forma correcta** de manejar acciones semánticas de ERP. Adoptan automáticamente la estética **Industrial Premium**: altura `h-9`, tipografía `text-[10px]`, peso `font-black`, `uppercase` y `tracking-widest`. Incluyen spinner automático, íconos de precisión y `type` correcto.

### `SubmitButton` — Guardar / Procesar / Confirmar

```tsx
// Caso más simple
<SubmitButton loading={isPending}>Guardar</SubmitButton>

// Con texto personalizado y sin ícono de disco
<SubmitButton loading={isCreating} icon={<PlusCircle className="w-4 h-4" />}>
  Crear Orden
</SubmitButton>

// Procesar — cambia el label pero mismo componente
<SubmitButton loading={isProcessing} icon={<Zap className="w-4 h-4" />}>
  Procesar Producción
</SubmitButton>
```

| prop      | tipo           | default      | notas |
|-----------|----------------|--------------|-------|
| `loading` | `boolean`      | `false`      | Muestra spinner, deshabilita el botón |
| `icon`    | `ReactNode`    | `<Save />`   | Se oculta mientras `loading=true` |
| `children`| `ReactNode`    | `'Guardar'`  | Texto del botón |
| `type`    | `string`       | `'submit'`   | Atributo nativo |

### `DangerButton` — Eliminar / Anular

```tsx
<DangerButton loading={isDeleting} onClick={handleDelete} />
<DangerButton loading={isVoiding} onClick={handleVoid}>Anular Orden</DangerButton>
```

| prop      | tipo        | default      | notas |
|-----------|-------------|--------------|-------|
| `loading` | `boolean`   | `false`      | Spinner durante la operación |
| `children`| `ReactNode` | `'Eliminar'` | |
| `type`    | `string`    | `'button'`   | Evita submit accidental |

### `CancelButton` — Cancelar / Cerrar

```tsx
<CancelButton onClick={onClose} />
<CancelButton onClick={onClose}>Volver</CancelButton>
```

> Internamente usa `variant="outline"`. NO reimplementar con `<Button variant="outline">Cancelar</Button>`.

### `IconButton` — Editar / Expandir / Acción inline de tabla

```tsx
<IconButton onClick={() => setEditMode(true)}>
  <Edit2 className="w-4 h-4" />
</IconButton>
```

> Aplica `variant="ghost"`, `size="icon"` y `hover:scale-110`. No usar `<Button size="icon" variant="ghost">` directamente para acciones de tabla. Usar el prop `circular` para iconografía redonda.

```tsx
<IconButton circular>
  <Settings className="w-4 h-4" />
</IconButton>
```

---

## 4. Capa 3 — `ToolbarCreateButton` (`@/components/shared`)

Para el botón **"+ Nueva entidad"** en toolbars de listas.

```tsx
// Abre modal
<ToolbarCreateButton label="Nueva Orden" icon={PlusCircleIcon} onClick={handleOpen} />

// Navega a una ruta
<ToolbarCreateButton label="Nuevo Producto" href="/inventory/products/new" />
```

> Ya incluye estilos de `h-9`, `uppercase`, `tracking-widest` y `font-bold`. No pasar `className` para sobreescribir estos estilos salvo casos excepcionales.

---

## 5. Matriz: Acción ERP → Componente correcto

| Acción ERP                | Componente correcto              | Variante/Config               |
|---------------------------|----------------------------------|-------------------------------|
| Crear entidad (toolbar)   | `ToolbarCreateButton`            | default                       |
| Crear entidad (modal)     | `ActionSlideButton`              | `variant="primary"`           |
| Guardar formulario        | `SubmitButton`                   | `icon=<Save/>` (default)      |
| Procesar / Confirmar      | `SubmitButton`                   | `icon=<Zap/>` o `<Check/>`   |
| Eliminar entidad          | `DangerButton`                   | default                       |
| Anular documento          | `DangerButton`                   | `children="Anular"`           |
| Cancelar / Cerrar modal   | `CancelButton`                   | default                       |
| Editar inline (tabla)     | `IconButton`                     | con `<Edit2/>`                |
| Expandir fila             | `IconButton`                     | con `<ChevronDown/>`          |
| Acción navigation link    | `Button asChild` + `<Link>`      | `variant="link"` o `"ghost"`  |
| Acción secundaria de vista| `Button`                         | `variant="outline"`           |
| Acción terciaria / ghost  | `Button`                         | `variant="ghost" size="sm"`   |
| CTA final de wizard       | `Button`                         | `variant="default"` (directo) |

---

## 6. Uso en modales — footer estándar

El footer de todos los modales que usan `BaseModal` debe seguir este patrón:

```tsx
footer={
  <div className="flex justify-end gap-2">
    <CancelButton onClick={() => onOpenChange(false)} />
    <SubmitButton loading={isPending} form="my-form-id">
      Guardar
    </SubmitButton>
  </div>
}
```

---

## 7. Anti-Patrones a Evitar 🚫

### ❌ Nunca usar `<button>` nativo en features

```tsx
// MAL — sin accesibilidad, sin design system
<button className="bg-blue-500 text-white px-4 py-2" onClick={save}>Guardar</button>

// BIEN
<SubmitButton loading={isSaving}>Guardar</SubmitButton>
```

### ❌ Nunca replicar el estado de carga manualmente

```tsx
// MAL — 4 líneas innecesarias, inconsistencia de animación
<Button disabled={loading}>
  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
  Guardar
</Button>

// BIEN — 1 línea
<SubmitButton loading={loading}>Guardar</SubmitButton>
```

### ❌ Nunca crear `CustomButton` locales

Si un botón tiene un estilo recurrente que no existe en las 3 capas, proponer su adición a `ActionButtons.tsx` (requiere ADR). No crear `MyFeatureButton.tsx`.

### ❌ Prohibido re-estilizar variantes con `className` largas

```tsx
// MAL — rompe la consistencia; esta es la variante "ghost" disfrazada
<Button variant="outline" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest 
  bg-transparent border border-primary/30 text-primary hover:bg-primary/10 
  transition-all rounded-full shadow-none">
  Agregar
</Button>

// BIEN — si el botón es "crear" en toolbar
<ToolbarCreateButton label="Agregar" onClick={...} />
```

### ❌ Prohibido usar `variant="ghost"` para "Cancelar"

```tsx
// MAL — "ghost" no tiene suficiente contraste semántico para cancelar
<Button variant="ghost" onClick={onClose}>Cancelar</Button>

// BIEN
<CancelButton onClick={onClose} />
```

---

## 8. Checklist pre-PR

- [ ] ¿Usé `SubmitButton` para acciones afirmativas con estado de carga?
- [ ] ¿Usé `DangerButton` para eliminar/anular?
- [ ] ¿Usé `CancelButton` para cerrar/cancelar modales?
- [ ] ¿Usé `IconButton` para acciones inline de tablas?
- [ ] ¿Usé `ToolbarCreateButton` para el CTA de crear en toolbars?
- [ ] ¿No hay `<button>` nativo en ningún `.tsx` de features?
- [ ] ¿No hay `Loader2` ad-hoc dentro de un `<Button>`?
- [ ] ¿No hay `className` con más de 3 utilidades de estilo en un `<Button>`?
