---
layer: 20-contracts
doc: component-modal
status: active
owner: frontend-team
last_review: 2026-04-25
stability: contract-changes-require-ADR
---

# Modal Components

Jerarquía de modales del proyecto. Todos los diálogos deben construirse sobre esta familia; **nunca usar `Dialog` de shadcn directamente** en features.

```
BaseModal  (primitiva)
├── ActionConfirmModal   — confirmación de acción (destructiva o no)
├── GenericWizard        — flujo paso a paso
└── DocumentCompletionModal — completar factura con folio + adjunto

BaseDrawer (primitiva)   — panel inferior (bottom drawer) para contexto amplio
```

> **Regla de selección:** usa siempre la especialización más específica.
>
> | Necesito… | Componente |
> |-----------|-----------|
> | Confirmar una acción (destructiva o no) | `ActionConfirmModal` |
> | Flujo paso a paso | `GenericWizard` |
> | Completar factura con folio + adjunto | `DocumentCompletionModal` (ver `component-contracts.md`) |
> | Subvista tabular con contexto visual | `BaseDrawer` |
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
| `hideScrollArea` | `boolean` | ❌ | `false` | Desactiva `ScrollArea`; obligatorio cuando se usa `FormTabs` vertical |
| `allowOverflow` | `boolean` | ❌ | `false` | Permite que el contenido sobresalga (ej. para rieles de pestañas negativos) |
| `className` | `string` | ❌ | — | Clases para `DialogContent` |
| `contentClassName` | `string` | ❌ | — | Clases para el área de contenido (scroll o div) |
| `headerClassName` | `string` | ❌ | — | Clases para el `DialogHeader`. Usar `sr-only` para ocultar cabecera original en vertical tabs. |
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

Todo modal que contenga un formulario **debe** pasar un `FormFooter` en la prop `footer`. Nunca usar `<div>` raw.

```tsx
footer={
  <FormFooter
    actions={
      <>
        <CancelButton onClick={() => onOpenChange(false)} />
        <SubmitButton loading={isPending} form="my-form-id">
          Guardar
        </SubmitButton>
      </>
    }
  />
}
```

Para modales de solo lectura (sin formulario) se acepta un `<Button>Cerrar</Button>` directo.

> Ver [component-button.md](./component-button.md) para la API completa de `CancelButton` y `SubmitButton`.
> Ver [form-layout-architecture.md §5](./form-layout-architecture.md) para la API completa de `FormFooter`.

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

---

## BaseDrawer 🟢

Primitiva para subvistas modales que se despliegan desde abajo ("Bottom Drawer"). Se utiliza **exclusivamente** para subvistas ricas en datos (tablas, históricos, libros mayores) que necesitan preservar el contexto visual del componente que los invocó.

```tsx
<BaseDrawer
  open={open}
  onOpenChange={setOpen}
  title="Libro Auxiliar"
  subtitle="Socio: Juan Pérez"
  icon={History}
  height="default"
>
  <DataTable columns={columns} data={data} />
</BaseDrawer>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `title` | `ReactNode \| string` | ✅ | — | Título principal en la cabecera |
| `subtitle` | `ReactNode \| string` | ❌ | — | Subtítulo en mayúsculas pequeñas bajo el título |
| `icon` | `React.ElementType` | ❌ | — | Icono junto al título |
| `headerActions` | `ReactNode` | ❌ | — | Slot derecho del header (ej. botones de filtro o acciones contextuales) |
| `children` | `ReactNode` | ✅ | — | Contenido deslizable (generalmente una tabla) |
| `height` | `'default' \| 'full' \| string` | ❌ | `'default'` | `'default'` = `75vh`, `'full'` = `90vh`, o clase Tailwind custom (ej. `'h-[60vh]'`) |
| `className` | `string` | ❌ | — | Clases adicionales para el `SheetContent` |
| `contentClassName` | `string` | ❌ | — | Clases adicionales para el área de contenido scrollable |

### Alturas (`height`)

| Valor | Altura | Cuándo usar |
|-------|--------|-------------|
| `'default'` | `75vh` | Tablas y listas normales — valor recomendado por defecto |
| `'full'` | `90vh` | Contenido muy denso que necesita máximo espacio |
| string custom | cualquier clase Tailwind | Casos edge; no es el estándar |

> **Altura máxima**: El drawer nunca debe superar `90vh`. No usar valores mayores; `BaseModal` es la alternativa correcta para contenido que necesita pantalla completa.

