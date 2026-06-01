---
id: 0028
title: Global entity-drawer registry + dual-mode drawers (replaces TransactionViewModal)
status: Accepted
date: 2026-05-28
author: core-team
---

# 0028 — Global entity-drawer registry + dual-mode drawers

**Related:** ADR-0020 (URL-state edit), ADR-0027 (BaseDrawer for CRUD forms)

---

## Context

Hasta F9 el sistema abría el detalle de un documento con `TransactionViewModal` (un modal de
solo lectura) cableado al query param `?detail={id}` vía `useEntityRouteActions`. Tenía dos límites:

1. **Una superficie por intención.** `?detail` solo abría una vista de lectura; editar requería
   otra ruta (`?selected`, ADR-0020). Ver y editar el mismo documento eran dos componentes.
2. **Apertura solo por URL.** Para abrir el detalle de un documento *origen* desde dentro de otro
   (ej. el `SaleOrder` que originó un `JournalEntry`, un link en el libro mayor) había que navegar
   o reimplementar el modal localmente. No existía un "abrir esta entidad" invocable desde
   cualquier componente sin tocar la URL.

Mientras tanto, ADR-0027 promovió `BaseDrawer` como superficie de formularios CRUD, y los drawers
por entidad (`ContactDrawer`, `SaleOrderDrawer`, `ProductDrawer`, …) ya soportan **modo dual**:
un mismo componente renderiza lectura o edición según un prop `mode`.

## Decision

Adoptar un **registro global de drawers de entidad** + un **opener imperativo**, reemplazando a
`TransactionViewModal`.

### D-01: Modos de drawer — `DrawerMode`

Tipo canónico en `frontend/features/_shared/drawer/types.ts`:

```ts
export type DrawerMode = 'create' | 'edit' | 'view'

export interface DrawerBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: DrawerMode
  onSuccess?: () => void
}
```

Un drawer de entidad deriva el modo por defecto de su input (`initialData ? 'edit' : 'create'`) y
acepta `'view'` para lectura. Esto unifica lo que antes eran dos componentes (modal de lectura +
form de edición) en uno. Hoy ~25 features adoptan `DrawerMode`.

### D-02: Registro `ENTITY_DRAWERS`

`frontend/lib/entity-drawers.tsx` exporta un mapa `label → adaptador`:

```ts
export interface EntityDrawerProps {
  id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  data?: unknown        // datos pre-fetcheados opcionales (evita round-trip)
  onSuccess?: () => void
}

export const ENTITY_DRAWERS: Record<string, (props: EntityDrawerProps) => ReactNode>
export function hasEntityDrawer(label: string | undefined | null): boolean
```

Cada entrada es un **adaptador** que mapea las props genéricas a la forma específica del componente
(`orderId`, `invoiceId`, etc.) y lo carga con `next/dynamic` (code-splitting + skeleton). Hoy hay
34 entidades registradas, incluidas las "Transaction Drawers (Phase 2 — dual-mode view/edit)".

### D-03: Opener imperativo — `GlobalModalProvider`

`frontend/components/providers/GlobalModalProvider.tsx` mantiene una sola instancia montada y expone:

```ts
openEntity(label: string, id: number, data?: unknown): void   // abre el drawer registrado
closeEntity(): void
hasEntityDrawer(label): boolean                                // re-exportado del registry
// hooks
useGlobalModals()         // acciones + estado de stacking de sheets
useGlobalModalActions()   // solo acciones
```

`openEntity` advierte (no rompe) si no hay drawer registrado para el label. Los openers específicos
(`openWorkOrder`, `openContact`, `openTreasuryAccount`) quedan `@deprecated` — delegan en `openEntity`.

### D-04: `SourceDocumentLink` (drill-down de documentos origen)

`components/shared/SourceDocumentLink` es el reemplazo directo del rol de "ver documento origen" que
tenía `TransactionViewModal`. Resuelve en 3 niveles:

1. **Drawer drill-down (preferido):** si `hasEntityDrawer(doc.type)` → `openEntity(doc.type, doc.id, doc)`.
2. **Navegación:** si hay `doc.url` → `<Link>`.
3. **Texto plano:** sin interacción.

### D-05: Relación con `?selected` (ADR-0020) y `?detail`

- **`?selected={id}`** (ADR-0020) sigue siendo el mecanismo **deep-linkeable** para edición desde
  lista / Universal Search. El drawer/modal que monta es surface-agnostic (ADR-0027).
- **`openEntity`** es el mecanismo **imperativo, en memoria** (no URL) para abrir un drawer de
  entidad desde cualquier componente (badges, links de documento origen, acciones de fila que no
  necesitan deep-link).
- **`?detail={id}`** (que cableaba `TransactionViewModal`) queda **deprecado**: su intención —
  abrir la vista de lectura de un documento — la cubre `openEntity(label, id)` con `mode='view'`.

## Consequences

### Positivas
- Una sola superficie por entidad (view/edit/create vía `mode`) — menos componentes, menos drift.
- Abrir cualquier entidad registrada desde cualquier punto con una sola llamada (`openEntity`),
  sin reimplementar modales locales ni navegar.
- Code-splitting por drawer vía `dynamic()` — no infla el bundle inicial.
- `SourceDocumentLink` da drill-down consistente a documentos origen (GFK de ADR-0016).

### Negativas / Riesgos
- El registro `ENTITY_DRAWERS` es un punto central a mantener: agregar una entidad implica registrar
  su adaptador. Mitigación: `hasEntityDrawer` + fallback a navegación en `SourceDocumentLink`/`EntityBadge`.
- `openEntity` abre **una** entidad a la vez (estado singleton). Anidar drill-downs no está soportado hoy.
- Los adaptadores acoplan el registry a las props de cada drawer; un cambio de props del componente
  exige actualizar su adaptador (el `EntityDrawerProps` genérico aísla parcialmente).

### Neutras
- El patrón URL-state de ADR-0020 no cambia; `openEntity` lo complementa, no lo reemplaza.

## Alternatives considered

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Mantener `TransactionViewModal` + `?detail` | Una superficie de solo lectura por entidad duplica el form de edición; no permite abrir el origen desde dentro de otro documento sin URL. |
| Modal de lectura genérico dirigido por schema | Mismo problema que `EntityForm` (ADR-0025 §2.2): los documentos ricos no caben en un schema lineal. |
| Abrir todo vía `?selected` (URL) | El drill-down a documento origen no siempre debe cambiar la URL ni romper el contexto de la lista actual. |

## References

- Contrato: [component-entity-drawers.md](../../20-contracts/component-entity-drawers.md)
- Implementación: `frontend/lib/entity-drawers.tsx`, `frontend/components/providers/GlobalModalProvider.tsx`, `frontend/components/shared/SourceDocumentLink.tsx`
- Tipos de modo: `frontend/features/_shared/drawer/types.ts`
- ADR-0027 (BaseDrawer CRUD), ADR-0020 (URL-state), ADR-0016 (GFK source documents)

## Changelog

- **2026-05-28**: ADR creado. `TransactionViewModal` retirado; reemplazado por el registry
  `ENTITY_DRAWERS` + `openEntity` + `SourceDocumentLink`. Documenta el subsistema dual-mode ya en
  uso (Phase 2 de transaction drawers en estabilización).
