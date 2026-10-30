---
layer: 20-contracts
doc: component-boolean-fields
status: active
owner: frontend-team
last_review: 2026-10-30
stability: stable
---

# Boolean Fields: Switches & Checkboxes

This contract defines how binary selection controls must be implemented to maintain visual consistency.

Visual preset decision: [ADR-0104](../10-architecture/adr/0104-labeled-switch-transparent-container-presets.md).

## General Rule: No Naked Controls

Switches and Checkboxes MUST NOT be placed directly on the form surface. They must always be wrapped in a `LabeledContainer` (via `LabeledSwitch` or `LabeledCheckbox`) to ensure they share the same border and legend architecture as text inputs and selectors.

---

## The "Dashed-to-Solid" State Pattern (Standard)

This is the **required visual pattern** for all `LabeledSwitch` instances. It communicates state through border style transitions:

| State | Border Style | Background | Ring |
| :--- | :--- | :--- | :--- |
| **Off** | `border-dashed` | transparent | `ring-1 ring-X/10` |
| **On** | `border-X/30` (solid, semantic color) | transparent | `ring-1 ring-X/20` |

The semantic color `X` should match the feature's purpose:
- `primary` — general features (inventory tracking, BOM, price rules)
- `success` (green) — activation states (active user, active rule)
- `warning` (amber) — caution states (indefinite contract, deferred emission)
- `success` — sales toggle (Venta); `warning` — purchase toggle (Compra). Never use `emerald` / `amber` raw — use semantic tokens only.

---

## Component Specs

### LabeledSwitch

**Color presets:** `primary` (default), `success`, `warning`, `destructive`, and `info`. The selected preset colors the switch, thumb, icon, active border, and the container ring in both states. The container background remains transparent in both states; the inactive border stays dashed.

**Props:**
| Prop | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | ✅ | Legend displayed in the notch |
| `description` | `string` | — | Inner text left of the switch. Use reactive text: `field.value ? "On text" : "Off text"` |
| `checked` | `boolean` | ✅ | Current value |
| `onCheckedChange` | `(v: boolean) => void` | ✅ | Change handler |
| `icon` | `ReactNode` | — | Icon left of description. The component colors its wrapper reactively from the selected preset |
| `color` | `primary \| success \| warning \| destructive \| info` | — | Semantic color preset. Defaults to `primary` |
| `className` | `string` | — | Additional classes for the outer fieldset; use for layout/custom overrides, not to repeat the preset colors |
| `disabled` | `boolean` | — | Disables interaction |
| `error` / `hint` | `string` | — | Validation / helper messages |

**Standard Usage:**
```tsx
<LabeledSwitch
  label="Lista de Materiales"
  description={field.value ? "Habilitado." : "Habilitar LdM de fabricación."}
  checked={field.value}
  onCheckedChange={field.onChange}
  color="primary"
  icon={<Layers className="h-4 w-4" />}
/>
```

**Rules:**
- The component colors the icon wrapper reactively from the selected preset; don't add a competing color class to the icon.
- Keep `className` for layout or intentional visual overrides. The default container background is transparent in both states, and preset rings are tinted in both states.
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
// ❌ WRONG — hardcoded active style bypasses the semantic preset and has no dashed fallback
className="bg-primary/5 border-primary/20"

// ❌ WRONG — no icon, no reactive description
<LabeledSwitch label="Active" checked={v} onCheckedChange={f} />

// ❌ WRONG — naked switch without LabeledContainer
<div className="flex justify-between">
  <span>Enable feature</span>
  <Switch checked={v} onCheckedChange={f} />
</div>
```
