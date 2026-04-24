---
layer: 20-contracts
doc: component-input
status: active
owner: frontend-team
last_review: 2026-04-23
stability: beta
---

# LabeledInput — Contract

> 📄 Este documento cubre el primitivo `LabeledInput`. Para inputs especializados de negocio (folio DTE, fecha con validación de periodo), ver las entradas correspondientes en [component-contracts.md](./component-contracts.md).

## ¿Cuándo usar `LabeledInput`?

Usa `LabeledInput` siempre que necesites un **par label + campo** (input o textarea) simple. Es el reemplazo directo del patrón deprecated:

```tsx
// ❌ DEPRECATED — no usar en código nuevo
<FormLabel className={FORM_STYLES.label}>Nombre</FormLabel>
<Input className={FORM_STYLES.input} {...field} />

// ✅ CORRECTO
<LabeledInput label="Nombre" required {...field} error={fieldState.error?.message} />
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

## Relación con especializaciones

`LabeledInput` es el **primitivo genérico**. Las especializaciones del sistema usan internamente un patrón propio (label + control + validación asíncrona). Una futura fase puede migrar sus internos a `LabeledInput`, pero por ahora son independientes:

| Especialización | Cuándo usarla |
|----------------|---------------|
| [`FolioValidationInput`](./component-contracts.md#folio-validation-input) | Folio DTE con validación de unicidad asíncrona |
| [`PeriodValidationDateInput`](./component-contracts.md#period-validation-date-input) | Fecha con validación de periodo contable/tributario |
| [`DatePicker`](./component-contracts.md#datepicker) | Selector de fecha simple |

## Do / Don't

```tsx
// ✅ DO — dejar que el componente maneje el label y el error
<LabeledInput label="Ciudad" error={fieldState.error?.message} {...field} />

// ❌ DON'T — mezclar LabeledInput con FormLabel manual
<FormLabel className={FORM_STYLES.label}>Ciudad</FormLabel>
<LabeledInput label="Ciudad" {...field} />

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
