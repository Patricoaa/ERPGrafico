# ERP Grafico Style Guide

This project uses a standardized set of Tailwind CSS classes for form elements to ensure consistency across the application.

## Usage

Import the `FORM_STYLES` constant from `@/lib/styles` and apply it to your components.

```tsx
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

// ...

<FormLabel className={FORM_STYLES.label}>My Label</FormLabel>
<Input className={FORM_STYLES.input} />
```

## Standard Styles

| Component | Standard Style | Description |
|-----------|---------------|-------------|
| **Label** | `text-[10px] font-black uppercase tracking-widest text-muted-foreground` | Small, bold, uppercase labels for forms. |
| **Input/Select** | `h-10 rounded-xl border-dashed bg-background focus-visible:ring-primary` | Inputs with dashed borders and rounded corners. |
| **Card** | *(Deprecado)* | **NO USAR**. Importar y usar `<Card variant="dashed" className="p-4">` desde `@/components/ui/card`. |
| **Table Header** | `px-3 py-2 font-black text-[10px] uppercase tracking-widest text-muted-foreground` | Consistent table headers. |
| **Section Header** | `text-[10px] font-black uppercase tracking-widest text-muted-foreground` | Headers for sections within forms. |

## Examples

### Form Field
```tsx
<FormItem>
    <FormLabel className={FORM_STYLES.label}>Name</FormLabel>
    <FormControl>
        <Input className={FORM_STYLES.input} {...field} />
    </FormControl>
</FormItem>
```

### Card Section
```tsx
<Card variant="dashed" className="p-4">
    <h3 className={FORM_STYLES.sectionHeader}>Details</h3>
    {/* Content */}
</Card>
```

## Best Practices
1. **Always use `FORM_STYLES`** for new forms to ensure they match the design system.
2. **Use `cn()`** to merge additional classes if needed (e.g., conditional colors or width adjustments).
   ```tsx
   className={cn(FORM_STYLES.input, isError && "border-destructive")}
   ```
3. **Avoid arbitrary values** (like `text-[11px]`) unless absolutely necessary. Stick to the standard constants.
