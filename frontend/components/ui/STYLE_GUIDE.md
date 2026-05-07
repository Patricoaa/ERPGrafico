# ERP Grafico Style Guide

This project uses a standardized set of Tailwind CSS classes for form elements to ensure consistency across the application.

## ⚠️ Deprecation Notice

`FORM_STYLES.label` and `FORM_STYLES.input` are **deprecated**. Do not use them in new code.
Use `<LabeledInput>` from `@/components/shared` instead. See [component-input.md](../../docs/20-contracts/component-input.md).

---

## LabeledInput (Recommended)

The `LabeledInput` component renders a `fieldset + legend` (Notched pattern). The label is embedded in the border with pure CSS — no JavaScript positioning.

```tsx
import { LabeledInput } from "@/components/shared"

// Simple input (react-hook-form)
<FormField
  control={form.control}
  name="name"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormControl>
        <LabeledInput
          label="Nombre"
          required
          placeholder="Ej: Juan Pérez"
          error={fieldState.error?.message}
          {...field}
        />
      </FormControl>
      {/* ⚠️ Do NOT add <FormMessage /> — LabeledInput already shows the error */}
    </FormItem>
  )}
/>

// Textarea
<LabeledInput label="Observaciones" as="textarea" rows={4} hint="Opcional" {...field} />
```

---

## Standard Styles (Legacy — still functional, do not use in new code)

| Component | Standard Style | Status |
|-----------|---------------|--------|
| **Label** | `FORM_STYLES.label` | ⚠️ Deprecated — use `LabeledInput` |
| **Input/Select** | `FORM_STYLES.input` | ⚠️ Deprecated — use `LabeledInput` |
| **Card** | *(Removed)* | **NO USAR**. Importar y usar `<Card variant="dashed" className="p-4">` |
| **Table Header** | `FORM_STYLES.tableHeader` | ⚠️ Deprecated — ver hierarchy contract |
| **Section Header** | `FORM_STYLES.sectionHeader` | ⚠️ Deprecated — usar `<FormSection />` |

---

## Best Practices

1. **Always use `LabeledInput`** for new forms — provides the notched Fieldset design pattern.
2. **Use `cn()`** to merge additional classes if needed:
   ```tsx
   <LabeledInput label="X" containerClassName={cn("col-span-2", someClass)} {...field} />
   ```
3. **Do not mix patterns** — do not add `<FormLabel>` above a `<LabeledInput>`.
4. **Error messages** — pass `error={fieldState.error?.message}`. No `<FormMessage>` needed.
