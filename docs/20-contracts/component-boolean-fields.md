# Boolean Fields: Switches & Checkboxes

This contract defines how binary selection controls must be implemented to maintain visual consistency with the "Industrial Premium" aesthetic.

## General Rule: No Naked Controls

Switches and Checkboxes MUST NOT be placed directly on the form surface. They must always be wrapped in a `LabeledContainer` (via `LabeledSwitch` or `LabeledCheckbox`) to ensure they share the same border and legend architecture as text inputs and selectors.

---

## The "Dashed-to-Solid" State Pattern (Standard)

This is the **required visual pattern** for all `LabeledSwitch` instances. It communicates state through border style transitions:

| State | Border Style | Background | Shadow |
| :--- | :--- | :--- | :--- |
| **Off** | `border-dashed` | transparent | none |
| **On** | `border-X/20` (solid, semantic color) | `bg-X/5` | `shadow-sm` |

The semantic color `X` should match the feature's purpose:
- `primary` — general features (inventory tracking, BOM, price rules)
- `success` (green) — activation states (active user, active rule)
- `warning` (amber) — caution states (indefinite contract, deferred emission)
- `emerald` / `amber` — sales/purchase toggles (Venta, Compra)

---

## Component Specs

### LabeledSwitch

**Props:**
| Prop | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | ✅ | Legend displayed in the notch |
| `description` | `string` | — | Inner text left of the switch. Use reactive text: `field.value ? "On text" : "Off text"` |
| `checked` | `boolean` | ✅ | Current value |
| `onCheckedChange` | `(v: boolean) => void` | ✅ | Change handler |
| `icon` | `ReactNode` | — | Icon left of description. Color should be reactive to `checked` |
| `className` | `string` | — | Applied to the outer fieldset border. Use reactive `cn()` |
| `disabled` | `boolean` | — | Disables interaction |
| `error` / `hint` | `string` | — | Validation / helper messages |

**Standard Usage:**
```tsx
<LabeledSwitch
  label="Lista de Materiales"
  description={field.value ? "Habilitado." : "Habilitar receta de fabricación."}
  checked={field.value}
  onCheckedChange={field.onChange}
  icon={<Layers className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
  className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed")}
/>
```

**Rules:**
- Icon color MUST be reactive: `field.value ? "text-X" : "text-muted-foreground/30"`
- `className` MUST use `cn(field.value ? "bg-X/5 border-X/20 shadow-sm" : "border-dashed")` — never hardcode a fixed className
- Description MUST reflect state: use ternary text or omit when label is self-explanatory
- Full row is clickable — do NOT wrap in an extra click handler div

### LabeledCheckbox
- **Use for**: marking items, multi-select, terms of service (not on/off binary states)
- **Height**: Minimum `1.5rem` internal area
- **Consistency**: Use the same vertical alignment as `LabeledSwitch`

---

## Usage Guidelines

| Control | When to use | Example |
| :--- | :--- | :--- |
| **Switch** | Binary status, on/off settings, immediate system states | Inventory tracking, Auto-save, Dark mode |
| **Checkbox** | Marking items, lists, multi-select, terms of service | Select all, Newsletter opt-in, Delete confirmation |

---

## Anti-Patterns ❌

```tsx
// ❌ WRONG — hardcoded active style, no dashed fallback
className="bg-primary/5 border-primary/20"

// ❌ WRONG — no icon, no reactive description
<LabeledSwitch label="Active" checked={v} onCheckedChange={f} />

// ❌ WRONG — naked switch without LabeledContainer
<div className="flex justify-between">
  <span>Enable feature</span>
  <Switch checked={v} onCheckedChange={f} />
</div>
```
