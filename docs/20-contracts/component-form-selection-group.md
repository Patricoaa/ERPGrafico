---
layer: 20-contracts
doc: component-form-selection-group
status: active
owner: frontend-team
last_review: 2026-11-02
stability: beta
---

# FormSelectionGroup

Selector común de opciones tipo card para **formularios CRUD**. Un solo componente cubre selección `single` (radio) y `multiple` (checkbox), con un encabezado suelto por encima de las opciones (icono requerido + label + suffix), eyebrow/descripción, estado de selección e indicador CMYK. No usa `LabeledContainer`.

Import: `import { FormSelectionGroup } from '@/components/shared'`

No reemplaza `ChoiceCard`/`ChoiceGroup` en wizards y checkout (mantienen su cinta CMYK y navegación de radio), ni `MultiSelectTagInput` (selección de valores compacta en un campo desplegable). Tampoco es para selección masiva de filas/entity-view; usar `SelectionRing` allí.

## API

`mode` discrimina el tipo de `value` y `onChange`:

| prop | tipo | req | notas |
|---|---|---:|---|
| `mode` | `single \| multiple` | ✅ | Semántica ARIA radio o checkbox |
| `label` | `string` | ✅ | Encabezado visible y nombre accesible del grupo |
| `items` | `FormSelectionOption[]` | ✅ | Opciones presentadas como cards |
| `icon` | `ReactNode` | ✅ | Icono decorativo junto al encabezado |
| `value` | `string \| number \| null` en `single`; `(string \| number)[]` en `multiple` | ✅ | Controlado por el formulario |
| `onChange` | `(value) => void` | ✅ | Emite un valor o la lista seleccionada según `mode` |
| `disabled` | `boolean` | — | Deshabilita grupo y opciones |
| `error` / `hint` | `string` / `ReactNode` | — | Mensajes debajo de las opciones |
| `suffix` / `footer` | `ReactNode` | — | Resumen a la derecha del encabezado / contenido inferior |
| `columns` | `1 \| 2 \| 3` | — | Grid responsive; default 1 |
| `maxHeight` | `string` | — | Limita el área desplazable de opciones |
| `selectAll` / `selectAllLabel` | `boolean` / `string` | — | Solo `multiple`; preserva valores seleccionados fuera de las opciones visibles |
| `isLoading` / `loadingLabel` | `boolean` / `string` | — | Estado de carga |
| `emptyLabel` | `string` | — | Estado vacío |
| `className` / `containerClassName` | `string` | — | Layout del grupo contenedor |

`FormSelectionOption`: `value` y `label` requeridos; `title`, `eyebrow`, `description`, `icon`, `suffix` opcionales; `description`, `icon` y `suffix` aceptan `ReactNode`; `disabled` deshabilita una opción.

## Interacción y visual

- `single`: `role="radiogroup"` con `role="radio"`, solo una opción en el orden de tabulación y flechas para mover foco y selección.
- `multiple`: `role="group"` con `role="checkbox"`; espacio/Enter activan la card, selección independiente y opción de seleccionar todo.
- La card se implementa sobre `CardSurface`; seleccionado usa borde/ring semántico y `CmykRing` como indicador. La cinta queda oculta para este patrón de formulario.
- No anidar controles interactivos en `suffix` salvo acciones que detengan propagación; usarlo para acciones auxiliares, por ejemplo, ayuda contextual.

## Ejemplo

```tsx
import { ShieldCheck } from "lucide-react"

<FormSelectionGroup
  mode="multiple"
  label="Roles disponibles"
  icon={<ShieldCheck className="h-4 w-4" />}
  items={roles.map((role) => ({ value: role.name, label: role.name, description: role.description }))}
  value={field.value ?? []}
  onChange={field.onChange}
/>
```

## Fuera de alcance

- `ChoiceCard` / `ChoiceGroup` en wizards y checkout.
- `MultiSelectTagInput` y selectores de valores/entidades.
- Checkboxes de booleanos independientes (`LabeledCheckbox`), acciones de tabla/entity-view, y bulk selection de colecciones.
