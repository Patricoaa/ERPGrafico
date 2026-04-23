---
layer: 20-contracts
doc: component-modal
status: active
owner: frontend-team
last_review: 2026-04-23
stability: contract-changes-require-ADR
---

# Modal Components

Jerarquía de modales del proyecto. Todos los diálogos deben construirse sobre esta familia; **nunca usar `Dialog` de shadcn directamente** en features.

```
BaseModal  (primitiva)
├── ActionConfirmModal   — confirmación de acción (destructiva o no)
├── GenericWizard        — flujo paso a paso
└── DocumentCompletionModal — completar factura con folio + adjunto
```

> **Regla de selección:** usa siempre la especialización más específica.
>
> | Necesito… | Componente |
> |-----------|-----------|
> | Confirmar una acción (destructiva o no) | `ActionConfirmModal` |
> | Flujo paso a paso | `GenericWizard` |
> | Completar factura con folio + adjunto | `DocumentCompletionModal` (ver `component-contracts.md`) |
> | Modal completamente custom | `BaseModal` (directo) |

---

## BaseModal 🟢

Primitiva base de todos los modales del proyecto. Wrappea `Dialog` de Shadcn con layout estructurado (header / scroll area / footer), botón de cierre integrado y variantes de estilo.

```tsx
<BaseModal
  open={open}
  onOpenChange={setOpen}
  title="Detalle de orden"
  description="Revisa los datos antes de confirmar"
  size="lg"
  footer={<Button onClick={() => setOpen(false)}>Cerrar</Button>}
>
  <p>Contenido aquí</p>
</BaseModal>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `title` | `string \| ReactNode` | ✅ | — | Si se omite se inyecta `sr-only` para a11y |
| `description` | `string \| ReactNode` | ❌ | — | `asChild` si no es string |
| `children` | `ReactNode` | ✅ | — | Cuerpo del modal |
| `footer` | `ReactNode` | ❌ | — | Renderizado en `DialogFooter` con fondo `muted/20` |
| `headerActions` | `ReactNode` | ❌ | — | Slot derecho del header (ej. botones de acción extra) |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl' \| 'full' \| 'default'` | ❌ | `'default'` | Ver tabla de anchos abajo |
| `variant` | `'default' \| 'transaction' \| 'wizard' \| 'raw'` | ❌ | `'default'` | Controla estilos de header/footer |
| `showCloseButton` | `boolean` | ❌ | `true` | Botón X en esquina superior derecha |
| `hideScrollArea` | `boolean` | ❌ | `false` | Desactiva `ScrollArea`; útil cuando el hijo gestiona su propio scroll |
| `className` | `string` | ❌ | — | Clases para `DialogContent` |
| `contentClassName` | `string` | ❌ | — | Clases para el área de contenido (scroll o div) |
| `headerClassName` | `string` | ❌ | — | Clases para el `DialogHeader` |
| `footerClassName` | `string` | ❌ | — | Clases para el `DialogFooter` |

### Tamaños (`size`)

| Valor | Ancho máximo |
|-------|-------------|
| `xs` | 400 px |
| `sm` | 500 px |
| `md` | 700 px |
| `default` | 512 px (Shadcn base, `sm:max-w-lg`) |
| `lg` | 900 px |
| `xl` | 1200 px |
| `2xl` | 1400 px |
| `full` | 98 vw × 95 vh |

### Variantes (`variant`)

| Valor | Efecto visual |
|-------|---------------|
| `default` | Header con borde inferior, footer con `bg-muted/20` |
| `transaction` | Header con `bg-primary text-primary-foreground` (sin borde). Usado en `TransactionViewModal` |
| `wizard` | Header con `border-b pb-2`. Usado internamente por `GenericWizard` |
| `raw` | Sin bordes en header ni footer; sin `ScrollArea`. Para layouts totalmente custom |

States handled: — (sin estado propio; estado lo gestiona el componente padre).

### Footer estándar

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

> Ver [component-button.md](./component-button.md) para la API completa de `CancelButton` y `SubmitButton`.

---

## ActionConfirmModal 🟢

Reusable confirmation dialog with variant styling and async confirmation support.

```tsx
<ActionConfirmModal
  open={open}
  onOpenChange={setOpen}
  onConfirm={handleDelete}
  title="Eliminar orden"
  description="Esta acción no se puede deshacer."
  variant="destructive"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `onConfirm` | `() => Promise<void> \| void` | ✅ | — | Shows spinner during async |
| `title` | `string` | ✅ | — | |
| `description` | `ReactNode` | ✅ | — | Accepts JSX |
| `confirmText` | `string` | ❌ | `'Confirmar'` | |
| `cancelText` | `string` | ❌ | `'Cancelar'` | |
| `variant` | `'default' \| 'destructive' \| 'warning' \| 'info' \| 'success'` | ❌ | `'default'` | Controls icon + button color |
| `icon` | `LucideIcon` | ❌ | — | Overrides default variant icon |

States handled: loading (during `onConfirm`), error (console only — caller manages toast).

---

## GenericWizard 🟢

Multi-step wizard modal. Handles step navigation, validation, and success screen.

```tsx
<GenericWizard
  open={open}
  onOpenChange={setOpen}
  title="Crear Orden"
  steps={[
    { id: 1, title: 'Datos', component: <Step1 />, isValid: step1Valid },
    { id: 2, title: 'Líneas', component: <Step2 />, onNext: validateStep2 },
  ]}
  onComplete={handleComplete}
  completeButtonLabel="Crear"
  isCompleting={isPending}
/>
```

```typescript
interface WizardStep {
  id: string | number
  title: string
  description?: string
  component: ReactNode
  isValid?: boolean               // disables Next when false
  onNext?: () => Promise<boolean | void>  // return false to block advance
}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `title` | `string \| ReactNode` | ✅ | — | Modal title |
| `steps` | `WizardStep[]` | ✅ | — | Min 1 step |
| `onComplete` | `() => Promise<void>` | ✅ | — | Called on last step confirm |
| `onClose` | `() => void` | ❌ | — | Called on cancel/close |
| `initialStep` | `number` | ❌ | `0` | Zero-indexed |
| `completeButtonLabel` | `string` | ❌ | `'Completar'` | |
| `completeButtonIcon` | `ReactNode` | ❌ | — | |
| `isCompleting` | `boolean` | ❌ | `false` | Spinner on complete button |
| `isLoading` | `boolean` | ❌ | `false` | Full wizard loading state |
| `successContent` | `ReactNode` | ❌ | — | Shown after `onComplete` resolves |
| `footerLeft` | `ReactNode` | ❌ | — | Left slot in footer |

Inherits `BaseModal` props except `children`, `title`, `description`, `footer`.

States handled: loading (isLoading), step blocked (isValid=false or onNext returns false), completing (isCompleting), success (successContent).
