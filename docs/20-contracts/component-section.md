---
layer: 20-contracts
doc: component-section
status: stable
owner: frontend-team
last_review: 2026-11-12
---

# `Section` — sección reutilizable (cabecera + filas)

`@/components/shared` → `Section` (ADR-0136). Reemplaza a `FormSection`, `SummarySection/Row/Note` y `PendingChecklist`.
Sirve para checklists, resúmenes de wizard, pestañas de perfil/drawers (datos financieros, contables o de negocio, botones de redirección) y separadores de formulario. **No** es para colecciones de entidades (eso es `entity-view`).

## Compuesto

| Pieza | Uso |
|-------|-----|
| `Section` | Cabecera opcional (`title`) + lista de filas. Resuelve `isLoading` / `isError` / `isEmpty`. |
| `Section.Header` | Cabecera suelta (separador de formulario, encabezado de tab). `spaced` agrega aire superior. |
| `Section.Row` | Fila con slots. `variant="stat"` = clave–valor; `variant="total"` = cifra destacada (saldo final, efectivo esperado). |
| `Section.Note` | Nota con icono (`warning` / `success`). |
| `Section.Action` | Botón o enlace compacto: **ghost por defecto**, icono opcional, `href` para redirigir. |
| `Section.Checklist` | Preset de checklist previo a un cierre (estado, CTA, documentos pendientes desplegables). |

## Props

`Section`: `title?` `description?` `icon?` `count?` `actions?` `as?` (`h2|h3|h4`) `isLoading?` `isError?` `isEmpty?` `emptyTitle?` `emptyDescription?` `onRetry?` `className?`.

`Section.Row`: `title` `description?` `meta?` `leading?` `value?` `valueClassName?` `strong?` `plain?` `control?` `actions?` `expand?` `onClick?` `pressed?` `variant?`.

- `control`: selector o input **con etiqueta y lógica propia**, controlado por quien lo usa (la fila no guarda estado ni valida).
- `expand`: `{ label, expanded, onToggle, content }`; el estado de expansión es del llamador.
- `onClick` + `pressed`: fila pulsable (opciones seleccionables, p. ej. tema).

## Reglas

- **Una sola cabecera:** título a la izquierda con línea inferior. No hay variante «tarjeta con fondo»; los títulos sobre `bg-muted` (modales de préstamos) migran a esta cabecera.
- **Un solo hijo es válido:** `Section` con una única `Section.Note` (o una fila) es el reemplazo de un aviso suelto; no hace falta otro componente.

- Título N1 fijo: `text-2xs font-bold uppercase tracking-[0.25em]` (lo verifica `typography.contract.test`). Sin variantes de tamaño.
- Colores solo con tokens (`text-warning`, `text-success`…).
- Formularios con inputs: `Section.Header` + formulario propio; no forzar `Section.Row`.
- Tablas de entidades: `entity-view`, no filas de `Section`.

## Ejemplo

```tsx
<Section title="Resumen" count="2 de 5" actions={<Section.Action text="Ver todo" href="/x" />}>
  <Section.Row variant="stat" title="Capital pagado" value={formatCurrency(n)} />
  <Section.Row title="Moneda" control={<LabeledSelect … />} />
  <Section.Note tone="success">Todo en orden.</Section.Note>
</Section>
```
