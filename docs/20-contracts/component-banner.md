---
layer: 20-contracts
doc: component-banner
status: active
owner: frontend-team
last_review: 2026-11-19
stability: beta
---

# Banner — avisos y bandas de estado

Contrato único de los avisos del sistema. Sustituye a `InfoBlock` y al uso directo de `Alert` en features. Referencia canónica: las alertas del resumen de socio (`PartnerSummaryPanel`). Familia de cards: [component-card-family.md](./component-card-family.md) (ADR-0097).

Import: `import { Banner } from '@/components/shared'`

`Banner` **no es una card**: nada se abre desde él ni se selecciona. Es una banda plana que informa o pide una acción.

## 1. Anatomía

| Pieza | Regla |
|---|---|
| Banda | `rounded-none border-0`, fondo `bg-{tone}/5`, ancho completo del contenedor. Sin sombra ni borde. |
| Icono | 16px, color del tono. Es el único portador del tono además del fondo. |
| Título | Una línea, `text-sm font-medium`. Admite `value` (monto, conteo) en `tabular-nums` separado por `·`. |
| Texto de apoyo | `children`; `text-xs text-muted-foreground` con título, `text-sm` sin título. |
| Acciones | Zona derecha (`actions`): botón o par de botones. Baja de línea en anchos chicos. |
| Descarte | `onDismiss` agrega una X ghost con `aria-label` (`dismissLabel`). |

El texto **nunca** lleva color de tono: el contraste se resuelve con tokens neutros. El tono solo tiñe icono y fondo.

## 2. Tono

| `tone` | Icono por defecto | Fondo | Uso |
|---|---|---|---|
| `info` | `Info` | `bg-info/5` | contexto, datos, notas operativas |
| `warning` | `AlertTriangle` | `bg-warning/5` | datos cacheados, diferencia, deuda, atención |
| `success` | `CheckCircle2` | `bg-success/5` | confirmación de validación o aprobación |
| `destructive` | `AlertTriangle` | `bg-destructive/5` | error bloqueante, alerta de seguridad |
| `neutral` | `Info` | `bg-muted/40` | nota estática sin carga semántica |

`icon={null}` apaga el icono; `icon={X}` lo reemplaza. `iconClassName` ajusta animación (`animate-spin`) sin tocar el color.

## 3. Anuncio (`live`)

| `live` | Rol | Cuándo |
|---|---|---|
| `status` (default) | `role="status"` | aviso persistente, no interrumpe |
| `alert` | `role="alert"` | error que requiere atención inmediata (default de `destructive`) |
| `none` | sin rol | nota estática que no debe re-anunciarse |

## 4. Banda de borde a borde (`bleed`)

Cuando el contenedor padre tiene padding horizontal, `bleed` cancela ese padding y repite el mismo valor dentro, así la banda llega de borde a borde y el texto queda alineado con el contenido:

| `bleed` | Clases | Host típico |
|---|---|---|
| `none` (default) | `px-4` | contenedor sin padding |
| `sm` | `-mx-2 px-2` | `p-2` |
| `md` | `-mx-4 px-4` | `px-4` |
| `lg` | `-mx-6 px-6` | `p-6` / `px-6` (drawers, wizards, tabs) |

Regla: elige el `bleed` que coincide con el padding del contenedor padre, no con el tamaño de la banda.

## 5. Uso

```tsx
<Banner
    tone="warning"
    bleed="lg"
    title="Diferencia de caja"
    value="$ 12.000"
    actions={<Button size="sm" variant="outline" onClick={() => onGoTab("closing")}>Ir al cierre</Button>}
>
    El efectivo contado no coincide con el esperado.
</Banner>
```

Envoltorios con API propia (no reescribir sus call sites):
- `StaleDataBanner` — datos cacheados + reintento.
- `ApprovalRequestBanner` — máquina de estados `required | waiting | approved | rejected`.

## 6. Variantes de uso

- **Dentro de diálogos o descripciones** (confirmaciones, anulaciones): `live="none"`, el texto ya lo anuncia el diálogo.
- **Error de formulario a nivel raíz** (`rootError`): `tone="destructive" live="alert"`.
- **Error de carga de panel o sección**: `Banner` destructive; la acción de reintento va en `actions` (ver `SectionRoot`).
- **Con título y detalle**: `title` + `children`; no repetir el título dentro del texto.
- **Superficies táctiles (POS)**: el texto base es `text-sm`; se amplía con `className="py-4 [&_p]:text-base"` e `iconClassName="size-6"`. No se reemplaza el tono ni se agrega borde. Un monto protagonista va en `actions` (ver `CashDifferenceBanner`).
- **Tono `primary`**: no existe; un aviso con CTA que antes usaba `bg-primary/5` pasa a `info`.
- **Margen lateral**: `Banner` es `w-full`; para insertarlo con margen horizontal envolverlo en un contenedor con padding en vez de usar `mx-*` en el Banner.

## 7. Cuándo no usarlo

- Fila de campo o par etiqueta/valor → `SectionRow` / `DataCell`.
- Estado vacío con CTA → `EmptyState`.
- Confirmación efímera que no debe quedar en pantalla → `toast`.
- Error de validación junto a un campo → mensaje del campo.
- Error de carga centrado que ocupa todo el panel (`ActivitySidebar`, `CommentsPanel`) → `EmptyState` con variante de error.
- Panel de datos o stats (tiles, saldos, "Diferencia") con fondo tintado → card o stat; no es un aviso.
- Chip contador (`+N`) o estado de fila → `Chip` / `StatusBadge`.
- Franja global de sistema con fondo sólido (`DebugClockBanner`) → excepción documentada, no es un Banner.

## 8. Ratchet

`frontend/lib/__tests__/banner.contract.test.ts` falla si un archivo fuera de `components/ui/` importa `@/components/ui/alert`. El baseline está vacío (2026-11-13): no queda ningún consumidor de `Alert` en el producto.

- Una excepción legítima se marca con `banner-allow: <motivo>`.
- `InfoBlock` fue eliminado; su rol es `Banner`.
- `Banner.test.tsx` verifica render, tono, `live`, descarte y `bleed`.
