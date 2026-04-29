---
layer: 20-contracts
doc: component-input
status: active
owner: frontend-team
last_review: 2026-04-23
stability: beta
---

# LabeledInput y LabeledSelect — Contracts

> 📄 Este documento cubre el primitivo `LabeledInput`. Para inputs especializados de negocio (folio DTE, fecha con validación de periodo), ver las entradas correspondientes en [component-contracts.md](./component-contracts.md).

## ¿Cuándo usar `LabeledInput`?

Usa `LabeledInput` o `LabeledSelect` siempre que necesites un **par label + campo** simple. Es el reemplazo directo del patrón deprecated:

```tsx
// ❌ DEPRECATED — no usar en código nuevo
<FormLabel className={FORM_STYLES.label}>Nombre</FormLabel>
<Input className={FORM_STYLES.input} {...field} />

// ✅ CORRECTO
<LabeledInput label="Nombre" required {...field} error={fieldState.error?.message} />

// ✅ CORRECTO para Selects
<LabeledSelect
  label="Tipo de Documento"
  options={[{ value: 'RUT', label: 'RUT' }, { value: 'PASSPORT', label: 'Pasaporte' }]}
  value={field.value}
  onChange={field.onChange}
  error={fieldState.error?.message}
/>
```

## Implementación técnica

El componente usa `<fieldset class="notched-field"> + <legend>` nativo. No hay JavaScript de posicionamiento.

- El `border` lo provee el `fieldset` — la `legend` "rompe" el borde visualmente (comportamiento HTML estándar).
- El `input`/`textarea` interno no tiene border ni outline propios.
- Los estados (focus, error, disabled) se controlan con `data-*` attrs que activan reglas CSS en `globals.css`.

## Prop Table 🟡

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | Texto del `<legend>`. Siempre uppercase por CSS. |
| `as` | `'input' \| 'textarea'` | ❌ | `'input'` | Cambia el elemento interno. |
| `required` | `boolean` | ❌ | `false` | Muestra `*` rojo junto al label. No setea `required` HTML — hacerlo explícitamente si se necesita validación nativa. |
| `error` | `string` | ❌ | — | Mensaje de error. Activa estado visual rojo + `role="alert"`. |
| `hint` | `string` | ❌ | — | Texto de ayuda. Visible solo cuando no hay `error`. |
| `containerClassName` | `string` | ❌ | — | Clases en el `<div>` wrapper externo. |
| `className` | `string` | ❌ | — | Clases en el `<input>` o `<textarea>` interno. |
| `rows` | `number` | ❌ | `3` | Solo para `as="textarea"`. |
| `disabled` | `boolean` | ❌ | `false` | Deshabilita el control y activa estado visual apagado. |
| `...rest` | `InputHTMLAttributes \| TextareaHTMLAttributes` | ❌ | — | Todos los atributos HTML nativos se pasan al elemento interno. |

`LabeledInput` soporta `forwardRef` — compatible con `react-hook-form` via `{...field}`.

### LabeledSelect Props 🟡

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | Texto del `<legend>`. |
| `options` | `{ value: string, label: string \| ReactNode }[]` | ✅ | — | Arreglo de opciones a renderizar. |
| `value` | `string` | ❌ | — | Valor actual seleccionado. |
| `onChange` | `(value: string) => void` | ❌ | — | Callback al cambiar selección. |
| `placeholder` | `string` | ❌ | `"Seleccione..."` | Texto cuando no hay nada seleccionado. |
| `required` | `boolean` | ❌ | `false` | Muestra `*` rojo junto al label. |
| `error` | `string` | ❌ | — | Mensaje de error visual. |
| `disabled` | `boolean` | ❌ | `false` | Deshabilita el control. |
| `containerClassName` | `string` | ❌ | — | Clases en el wrapper externo. |
| `className` | `string` | ❌ | — | Clases en el SelectTrigger interno. |

## Integración con `react-hook-form`

### Patrón recomendado (RHF + Zod)

```tsx
<FormField
  control={form.control}
  name="name"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormControl>
        <LabeledInput
          label="Nombre / Razón Social"
          required
          placeholder="Ej: Juan Pérez"
          error={fieldState.error?.message}
          {...field}
        />
      </FormControl>
      {/* NO agregar <FormMessage /> — LabeledInput ya muestra el error */}
    </FormItem>
  )}
/>
```

> [!IMPORTANT]
> **No uses `<FormLabel>` ni `<FormMessage>`** cuando uses `LabeledInput`. El label va en la prop `label` y el error en la prop `error`. Usar ambos genera UI duplicada.

### Patrón controlado (sin RHF)

```tsx
<LabeledInput
  label="Observaciones"
  as="textarea"
  rows={4}
  value={obs}
  onChange={(e) => setObs(e.target.value)}
  hint="Máximo 500 caracteres"
/>
```

## Variantes visuales

### Input simple

```tsx
<LabeledInput label="Nombre" placeholder="Juan Pérez" />
```

### Con error

```tsx
<LabeledInput label="RUT" error="RUT inválido" value="99.999.999-X" />
```

### Requerido

```tsx
<LabeledInput label="Email" required type="email" />
```

### Textarea

```tsx
<LabeledInput label="Descripción" as="textarea" rows={5} hint="Descripción detallada del producto" />
```

### Deshabilitado

```tsx
<LabeledInput label="Código interno" disabled value="PRD-0042" />
```

---

## LabeledContainer

Wrapper `fieldset + legend` para controles que **no son** `<input>` nativos (date pickers, dropzones, selectores custom).

```tsx
<LabeledContainer label="Fecha" icon={<CalendarIcon className="h-4 w-4 opacity-50" />} error={error}>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" className="w-full text-left border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent h-[1.5rem] p-0 text-sm">
        {value ? format(value, "PPP") : <span>Seleccione fecha</span>}
      </Button>
    </PopoverTrigger>
    ...
  </Popover>
</LabeledContainer>
```

### Invariante de altura

`LabeledContainer` garantiza `min-h-[1.5rem]` en el área de contenido — igual que `LabeledInput`. Para mantener alineación visual con los demás campos del formulario:

> **El trigger interno debe usar `h-[1.5rem] p-0`**, no `h-auto py-2`.  
> CSS en `globals.css` normaliza `fieldset.notched-field button:not([role="combobox"])` automáticamente,  
> pero declarar la altura explícitamente es más claro y evita override accidental.

### Do / Don't

```tsx
// ✅ DO — botón de trigger compacto
<Button className="... h-[1.5rem] p-0 text-sm">...</Button>

// ❌ DON'T — py-2 rompe la alineación con LabeledInput
<Button className="... h-auto py-2">...</Button>
```

| prop | type | required | notes |
|------|------|----------|-------|
| `label` | `ReactNode` | ❌ | Texto del `<legend>`. |
| `required` | `boolean` | ❌ | Muestra `*` rojo. |
| `error` | `string` | ❌ | Borde destructivo + mensaje. |
| `hint` | `string` | ❌ | Ayuda (visible solo si no hay `error`). |
| `icon` | `ReactNode` | ❌ | Ícono prefijo dentro del fieldset. |
| `suffix` | `ReactNode` | ❌ | Elemento sufijo. |
| `disabled` | `boolean` | ❌ | Opacidad + `pointer-events: none`. |
| `containerClassName` | `string` | ❌ | Clases en el `<div>` wrapper. |
| `className` | `string` | ❌ | Clases en el `<fieldset>`. |

---

## Relación con especializaciones

`LabeledInput` es el **primitivo genérico**. Las especializaciones del sistema usan internamente un patrón propio (label + control + validación asíncrona). Una futura fase puede migrar sus internos a `LabeledInput`, pero por ahora son independientes:

| Especialización | Cuándo usarla |
|----------------|---------------|
| [`FolioValidationInput`](./component-contracts.md#folio-validation-input) | Folio DTE con validación de unicidad asíncrona |
| [`PeriodValidationDateInput`](./component-contracts.md#period-validation-date-input) | Fecha con validación de periodo contable/tributario |
| [`DatePicker`](./component-contracts.md#datepicker) | Selector de fecha simple |
| [`MultiTagInput`](#multitaginput) | Entrada de múltiples etiquetas (tags) con estilo notched |

---

## MultiTagInput 🟡

Componente de entrada múltiple que permite añadir valores escribiendo y pulsando `Enter`. Los valores aparecen como etiquetas (badges) dentro del propio campo.

```tsx
<MultiTagInput
  label="Etiquetas"
  values={tags}
  onAdd={(newTag) => setTags([...tags, newTag])}
  onRemove={(tag) => setTags(tags.filter(t => t !== tag))}
  placeholder="Escribe y pulsa Enter..."
  hint="Ej: Rojo, Azul, XL"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ❌ | — | Texto del legend. |
| `values` | `string[]` | ✅ | — | Arreglo de strings con los valores actuales. |
| `onAdd` | `(val: string) => void` | ✅ | — | Callback invocado al pulsar `Enter`. |
| `onRemove` | `(val: string) => void` | ✅ | — | Callback invocado al eliminar una etiqueta o pulsar `Backspace`. |
| `placeholder` | `string` | ❌ | — | Texto mostrado cuando la lista de `values` está vacía. |
| `required` | `boolean` | ❌ | `false` | Muestra `*` rojo. |
| `error` | `string` | ❌ | — | Mensaje de error visual. |
| `hint` | `string` | ❌ | — | Texto de ayuda debajo del campo. |
| `disabled` | `boolean` | ❌ | `false` | Deshabilita el control. |

### Comportamiento de teclado

- **Enter**: Procesa el texto actual, invoca `onAdd` y limpia el input.
- **Backspace**: Si el input está vacío, invoca `onRemove` con el último elemento del arreglo.

---

## MultiSelectTagInput 🟡

Variante del selector múltiple que utiliza un dropdown para elegir entre opciones predefinidas. Ideal para categorías, etiquetas de sistema o selecciones de una lista cerrada.

```tsx
<MultiSelectTagInput
  label="Categorías"
  options={[
    { label: 'Electrónica', value: 'elec' },
    { label: 'Hogar', value: 'home' }
  ]}
  value={selectedIds}
  onChange={setSelectedIds}
  placeholder="Seleccione categorías..."
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ❌ | — | Texto del legend. |
| `options` | `MultiSelectOption[]` | ✅ | — | `{ label: string, value: string }[]`. |
| `value` | `string[]` | ✅ | — | Arreglo de valores (values) seleccionados. |
| `onChange` | `(vals: string[]) => void` | ✅ | — | Callback con el nuevo arreglo de valores. |
| `placeholder` | `string` | ❌ | `"Seleccionar..."` | Texto cuando no hay selección. |
| `required` | `boolean` | ❌ | `false` | Muestra `*` rojo. |
| `error` | `string` | ❌ | — | Mensaje de error visual. |
| `hint` | `string` | ❌ | — | Texto de ayuda. |
| `disabled` | `boolean` | ❌ | `false` | Deshabilita el control. |

---

## Do / Don't

```tsx
// ✅ DO — dejar que el componente maneje el label y el error
<LabeledInput label="Ciudad" error={fieldState.error?.message} {...field} />

// ❌ DON'T — mezclar LabeledInput con FormLabel manual
<FormLabel className={FORM_STYLES.label}>Ciudad</FormLabel>
<LabeledInput label="Ciudad" {...field} />

// ✅ DO — usar LabeledSelect para selects simples nativos
<LabeledSelect label="Región" options={[{value: "RM", label: "RM"}]} value={val} onChange={setVal} />

// ✅ DO — usar containerClassName para ajustar el grid
<LabeledInput label="Código" containerClassName="col-span-2" {...field} />

// ❌ DON'T — pasar clases de borde al input interno (el fieldset maneja el borde)
<LabeledInput label="X" className="border rounded-md" {...field} />
```

## Accessibility

- `fieldset + legend` es semánticamente correcto para groupar un label con su control (WCAG 1.3.1 Info and Relationships).
- El error usa `role="alert"` — anunciado automáticamente por screen readers al aparecer.
- El asterisco `*` tiene `aria-hidden="true"` — el carácter requerido debe comunicarse también via `required` attr en el input o validation message.

## Estados manejados

| Estado | Cómo se activa | Visual |
|--------|----------------|--------|
| Default | — | Borde `--border` |
| Focus | `:focus-within` | Borde `--primary` + ring 3px |
| Error | `error` prop presente | Borde + legend `--destructive` |
| Disabled | `disabled` prop | Opacidad 50%, `pointer-events: none` |
