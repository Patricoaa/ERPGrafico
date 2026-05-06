---
layer: 20-contracts
doc: component-table-cell-input
status: active
owner: frontend-team
last_review: 2026-05-06
stability: beta
changelog:
  - 2026-05-06: Creado a partir de auditoría masiva de inputs — formaliza el patrón "spreadsheet inline" detectado en 11 archivos de features.
---

# Table Cell Input — Contrato

Patrón de entrada de datos **dentro de celdas de tabla editables** (estilo spreadsheet). Es la excepción documentada al patrón Notched: la propia celda actúa como contenedor visual, por lo que el `fieldset + legend` sería ruido.

> 📄 Para inputs dentro de formularios modales o páginas, ver **[component-input.md](./component-input.md)**.
> Para la tabla shell genérica, ver **[`FormLineItemsTable`](./component-contracts.md#formlineitemstable)**.

---

## ¿Cuándo aplica este patrón?

Usa `<Input>` de shadcn **directamente** (sin `LabeledInput`) si y solo si:

1. El input está dentro de un `<TableCell>` o `<td>`, **y**
2. La tabla es editable (el usuario ingresa o modifica valores por fila), **y**
3. La columna tiene encabezado propio (`<TableHead>` / `<th>`) que actúa como label implícito.

```
┌──────────┬──────────┬──────────┬──────────┐
│ Producto │  Cant.   │  P.Unit  │  Total   │  ← labels viven en el header
├──────────┼──────────┼──────────┼──────────┤
│ Harina   │ [  2.0 ] │ [ 1500 ] │  $3.000  │  ← inputs en celdas, sin label
└──────────┴──────────┴──────────┴──────────┘
```

---

## Clases CSS canónicas

### Input numérico (cantidad, precio, monto)

```tsx
<Input
    type="number"
    className="h-8 text-xs font-mono text-right"
    value={value}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    onFocus={(e) => e.target.select()}
/>
```

### Input de texto corto (notas, glosa, código)

```tsx
<Input
    type="text"
    className="h-8 text-xs"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Notas opcionales..."
/>
```

### Input con estado de validación visual

Cuando el valor difiere del esperado (ej. rectificación de materiales, cantidad > stock):

```tsx
<Input
    type="number"
    className={cn(
        "h-8 text-xs font-mono text-right",
        hasChange && "border-warning focus-visible:ring-warning",
        isError && "border-destructive focus-visible:ring-destructive",
    )}
    ...
/>
```

### Input numérico con icono prefijo (moneda)

Para celdas de precio en tablas de notas o documentos:

```tsx
<div className="relative">
    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
    <Input
        type="number"
        className="h-8 pl-5 text-xs font-mono text-right"
        ...
    />
</div>
```

---

## Tabla de props relevantes

| Prop | Valor estándar | Notas |
|------|---------------|-------|
| `type` | `"number"` o `"text"` | Siempre especificar explícitamente |
| `className` | `"h-8 text-xs font-mono text-right"` (numérico) | Ver variantes arriba |
| `onFocus` | `(e) => e.target.select()` | Recomendado para numéricos — mejora UX |
| `min` | `0` o `0.001` | Siempre definir para numéricos de cantidad |
| `step` | `"any"` o `1` | `"any"` para decimales libres, `1` para enteros |

---

## Altura de fila — invariante

La altura canónica del input en tabla es **`h-8` (32px)**. Nunca `h-9` (36px) ni `h-10` (40px) dentro de celdas, ya que incrementa innecesariamente la densidad vertical.

| Contexto | Altura | Clase |
|----------|--------|-------|
| Tabla de líneas estándar | 32px | `h-8` |
| Tabla compacta (muy densa) | 28px | `h-7` |
| Fuera de tabla (standalone) | → usar `LabeledInput` | — |

---

## Select en tabla (variante dropdown)

Para celdas que requieren un select (ej. UoM, tipo):

```tsx
<Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-8 text-xs w-[120px]">
        <SelectValue placeholder="—" />
    </SelectTrigger>
    <SelectContent>
        {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
            </SelectItem>
        ))}
    </SelectContent>
</Select>
```

> [!NOTE]
> Para UoM, preferir `UoMSelector variant="inline"` si las opciones vienen del backend y son > 5.
> Para listas estáticas cortas (< 5 opciones), el `<Select>` raw con `h-8` es correcto.

---

## Integración con `react-hook-form` + `useFieldArray`

El patrón estándar para tablas editables con RHF:

```tsx
const { fields, append, remove } = useFieldArray({ control, name: "lines" })

// En cada fila:
<FormField
    control={control}
    name={`lines.${index}.quantity`}
    render={({ field }) => (
        <FormItem>
            <FormControl>
                <Input
                    {...field}
                    type="number"
                    className="h-8 text-xs font-mono text-right"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                />
            </FormControl>
            {/* NO usar <FormMessage /> en tabla — mostrar errores en el footer o con border-destructive */}
        </FormItem>
    )}
/>
```

> [!IMPORTANT]
> **No usar `<FormMessage />`** dentro de celdas de tabla. Los errores de validación deben expresarse:
> 1. Con `border-destructive` en el input, **y**
> 2. Un resumen de errores en el footer de la tabla o en el footer del modal.

---

## Componentes shell que usan este patrón

| Componente | Archivo |
|------------|---------|
| `FormLineItemsTable` | `components/shared/FormLineItemsTable.tsx` |
| `AccountingLinesTable` | `components/shared/AccountingLinesTable.tsx` |

Los dos componentes proveen el **shell** (header + footer + botón add). El caller inyecta las celdas con sus inputs vía `children`.

---

## Forbidden patterns

- ❌ **`LabeledInput` en celdas de tabla** — el `fieldset + legend` no encaja en la densidad de una tabla.
- ❌ **`h-9` o `h-10`** dentro de celdas — rompería la densidad de la fila estándar.
- ❌ **`<FormMessage />`** inline en celdas — sobrecarga visual; usar estados visuales del input.
- ❌ **Label ad-hoc flotante manual** (`<label className="absolute -top-2 left-2 px-1 bg-background">`) — si necesitas un label flotante fuera de la tabla, usá `LabeledInput` directamente.
- ❌ **`<Input>` sin altura explícita** en tabla — siempre definir `h-8`.
