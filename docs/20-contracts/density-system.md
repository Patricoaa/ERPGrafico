---
layer: 20-contracts
doc: density-system
status: active
owner: frontend-team
last_review: 2026-08-04
stability: stable
---

# Contrato de Arquitectura: Sistema de Espaciado y Densidad

Este contrato define la escala de ritmo (`--spacing-r-*`), los tokens de densidad de tabla (`--table-cell-*`, `--table-header-*`) y los modos de densidad (`compact` / `comfortable`) que todo el frontend debe consumir. No inventa componentes nuevos: formaliza lo que `globals.css` ya implementa para que la densidad no dependa de valores mágicos ad-hoc.

**Regla de oro:** ERPGrafico es una herramienta para operadores que la usan todo el día. **`compact` es el default** de todas las superficies de datos (ADR-0070, mantra del operador: "cada píxel debe hacer su trabajo más rápido"). `comfortable` es un opt-out explícito, nunca el default.

---

## 1. Escala de ritmo (`--spacing-r-*`)

Prefijo `r-` para evitar colisión con la escala estándar de Tailwind. Definida en `:root` de `globals.css`.

| Token | Valor | Uso |
|-------|-------|-----|
| `--spacing-r-xs` | `0.25rem` (4px) | gaps mínimos entre elementos íntimamente ligados |
| `--spacing-r-sm` | `0.5rem` (8px) | gaps internos compactos, chips, badges |
| `--spacing-r-md` | `1rem` (16px) | spacing estándar entre bloques de contenido |
| `--spacing-r-lg` | `1.5rem` (24px) | secciones mayores, separación de tarjetas |
| `--spacing-r-xl` | `2rem` (32px) | márgenes de página / paneles amplios |

**Regla invariante (PR Reject):** nunca usar un valor de spacing "en bruto" (`p-2.5`, `gap-3.5`) para un ritmo que ya cubre la escala. Si necesitas un valor fuera de la escala (p. ej. `6px`), usa `calc()` sobre el token más cercano con un comentario de contexto.

---

## 2. Tokens de densidad de tabla

Definidos en `:root` de `globals.css`. Son la única fuente de verdad para el padding/altura de las filas y cabeceras de tabla — ninguna variante de tabla puede usar padding ad-hoc.

| Token | Default (compact) | Descripción |
|-------|-------------------|-------------|
| `--table-cell-py` | `0.5rem` (py-2) | Padding vertical de celda |
| `--table-cell-px` | `0.75rem` (px-3) | Padding horizontal de celda |
| `--table-header-py` | `0.25rem` (py-1) | Padding vertical de cabecera |
| `--table-header-px` | `0.5rem` (px-2) | Padding horizontal de cabecera |
| `--table-header-h` | `2.25rem` (~h-9) | Altura de cabecera |
| `--table-row-hover` | `oklch(var(--muted-raw) / 0.5)` | Fondo hover de fila |
| `--table-header-bg` | `transparent` | Fondo de cabecera |
| `--table-footer-bg` | `oklch(var(--muted-raw) / 0.5)` | Fondo de footer |
| `--table-expanded-bg` | `oklch(var(--muted-raw) / 0.3)` | Fondo de fila expandida |
| `--table-row-border` | `oklch(var(--border-raw) / 0.4)` | Borde entre filas |

### Clases de utilidad

| Clase | Efecto |
|-------|--------|
| `.table-cell` | Aplica `padding: var(--table-cell-py) var(--table-cell-px)` |
| `.table-header` | Aplica `height: var(--table-header-h)` + padding de cabecera |
| `.table-row-hover` | Transición + hover con `--table-row-hover` |
| `.table-footer` | Fondo con `--table-footer-bg` |
| `.table-header-compact` | Cabecera extra-densa (`--table-header-h: 2rem`) para vistas de lista |
| `.table-compact` | Scope que fija `--table-cell-py`/`--table-header-h` a los valores compact |
| `.table-comfortable` | Scope que afloja: `--table-cell-py: 0.75rem`, `--table-header-h: 2.75rem` |

**Regla invariante (PR Reject):** toda variante de tabla (DataTable, FormLineItemsTable, ReportTable, `variant="minimal"`) debe consumir `.table-cell`/`.table-header` en vez de clases de padding sueltas.

---

## 3. Modos de densidad

### 3.1 Default: `compact`

- Es la configuración por defecto de `:root` (los tokens base ya son compact).
- `DataTable` acepta `density?: 'compact' | 'comfortable'` con **default `'compact'`**.
- Justificación: operadores de imprenta con alta densidad de datos — ver ADR-0070 y `DESIGN.md`.

### 3.2 Opt-out: `comfortable`

- Se activa explícitamente con `density="comfortable"` en DataTable (aplica el scope `.table-comfortable`).
- Uso previsto: contextos de "audiencia mixta" (reportes leídos de forma esporádica, settings, onboarding) donde la densidad máxima dificulta la lectura.
- **Nunca** es el default.

```tsx
// Default es compact — no hace falta nada
<DataTable columns={columns} data={data} />

// Opt-out explícito para audiencia mixta
<DataTable columns={columns} data={data} density="comfortable" />
```

---

## 4. Referencias

- [ADR-0070 — Primary = Process Black K100](../10-architecture/adr/0070-primary-process-black.md) (criterio de densidad operativa)
- [ADR-0030 — DataTable compact variant](../10-architecture/adr/0030-datatable-compact-variant.md)
- [component-datatable-views.md](component-datatable-views.md) — contratos de las variantes de DataTable
- [component-skeleton.md](component-skeleton.md) — estados de carga con densidad consistente
- Implementation: `frontend/app/globals.css` (`:root`, sección "RHYTHM & SPACING" / "TABLE SYSTEM" / "DENSITY MODES") y `frontend/components/shared/DataTable.tsx` (prop `density`)
