# DESIGN — ERPGrafico

Design source of truth para ERPGrafico. Este documento es la **puerta de entrada única** al sistema de diseño: qué es, qué principios lo gobiernan, y **dónde vive cada detalle** (los contratos de la Capa 20 son la autoridad normativa).

> Lee esto primero. Luego abre el contrato relevante de `docs/20-contracts/`. No duplicamos especificaciones aquí — este archivo consolida y referencia.

---

## 1. Concepto

ERPGrafico es un **ERP contable para imprenta**: los operadores viven en la app todo el día, procesando pedidos, planchas, costos y estados en alta frecuencia. El sistema de diseño se construye sobre la identidad de la industria: **CMYK, tinta y procesos de imprenta** como metáfora visual y operativa.

**Mantra del operador:** *"Speed and data density — every pixel should make their job faster."*
Cada decisión de diseño se evalúa contra este criterio: ¿este píxel ayuda al operador a ir más rápido?

### Criterios de diseño (en orden)

1. **Velocidad** — acciones a 1 clic, foco inmediato, cero fricción.
2. **Densidad de datos** — compacto por defecto; el operador debe ver más filas, no menos.
3. **Consistencia industrial** — tokens semánticos, cero valores mágicos, cero colores raw.
4. **Jerarquía clara** — placa Key (K100) para acción, cyan para énfasis, neutros para estructura.

---

## 2. Principios (invariantes de diseño)

1. **Tinta (Layer 1) vs. intención (Layer 2).** Las tintas de proceso CMYK son fijas e identificables; los intents semánticos (`primary`, `info`, `success`…) adaptan su valor al modo claro/oscuro. Nunca confundir los niveles. → [color-system.md](docs/20-contracts/color-system.md)
2. **Primary = Process Black K100 (placa Key).** La acción primaria, el foco (`ring`) y el ítem activo del sidebar (`sidebar-primary`) van en K100, que se invierte a casi-blanco en modo oscuro. `accent` es una superficie neutra de hover/selección, **no** un color de énfasis. Las tintas CMYK aparecen como identidad, no como estado: cinta CMYK de selección, `--chart-1…4` y ColorBar. → [ADR-0070](docs/10-architecture/adr/0070-primary-process-black.md) · [color-system.md](docs/20-contracts/color-system.md)
3. **Compact es el default.** Todas las superficies de datos (tablas, listas, kanban) nacen compactas. `comfortable` es opt-out explícito. → [density-system.md](docs/20-contracts/density-system.md)
4. **Onest para la UI, JetBrains Mono para los datos.** Onest es la única fuente de texto (no existe `font-heading`); JetBrains Mono (bundleada vía `next/font`) es solo para cifras, códigos, IDs y valores KPI. La escala es fluida entre 1024 y 1440 px (ADR-0142). → [typography-scale.md](docs/20-contracts/typography-scale.md)
5. **Movimiento con propósito.** Entradas solo vía `<FadeIn>` o su receta `fadeInClass()`; cero `animate-in` a mano y cero framer-motion directo en páginas; nada que frene al operador. → [component-animation.md](docs/20-contracts/component-animation.md)
6. **Esquinas anidadas, bordes de panel planos.** Radio 8 px para lo atómico y los items interactivos, 12 px para contenedores, 16 px para overlays flotantes; el shell y los paneles de borde (`Drawer`, `CollapsibleSheet`) son planos (`flush-panel`). → [geometry-surfaces.md](docs/20-contracts/geometry-surfaces.md)
7. **Semántico sobre estético.** Nunca tokens raw de Tailwind (`bg-red-500`); siempre tokens semánticos (`bg-destructive`). → [GOVERNANCE.md](docs/90-governance/GOVERNANCE.md)
8. **Las cards se eligen por rol, no por aspecto.** `choice` (elegir uno), `item` (abrir un registro), `nav` (ir a un módulo), `metric` (un dato: `Metric`, `MetricStrip`) y `panel` (agrupar contenido) comparten una sola anatomía (lead, código, título, descripción, pie, riel) y dos superficies: 8px para lo interactivo, 12px para contenedores. La cinta CMYK marca "elegido": se previsualiza al hover y queda fija al elegir (en `choice` y en las cards de entity-view; en bandeja y kanban solo seleccionada); el estado nunca lo lleva solo el color. Ninguna card se arma a mano con `border rounded bg-card`. → [component-card-family.md](docs/20-contracts/component-card-family.md) · [ADR-0097](docs/10-architecture/adr/0097-card-family-roles-and-surface-tokens.md)
9. **Primitivas shadcn intactas.** `components/ui/` no se edita para lógica de dominio; se envuelve en `components/shared/`. Avisos = `Banner`; estados = `StatusBadge`. → [geometry-surfaces.md §7](docs/20-contracts/geometry-surfaces.md) · [ADR-0004](docs/10-architecture/adr/0004-shadcn-ui-base-components.md)

---

## 3. Mapas de referencia

| Interés | Contrato / ADR |
|---------|----------------|
| Colores, intents, tintas CMYK, sidebar, charts, chips | [color-system.md](docs/20-contracts/color-system.md) |
| Switches y campos booleanos: presets semánticos, fondo transparente y ring por estado | [component-boolean-fields.md](docs/20-contracts/component-boolean-fields.md) |
| Inputs notched: capa y fondo opaco del legend por encima de rings | [component-input.md](docs/20-contracts/component-input.md) |
| Tipografía, escala fluida 1024→1440px (ADR-0142), mono | [typography-scale.md](docs/20-contracts/typography-scale.md) |
| Espaciado y densidad (compact/comfortable) | [density-system.md](docs/20-contracts/density-system.md) |
| Animación y transiciones | [component-animation.md](docs/20-contracts/component-animation.md) |
| Componentes compartidos (qué usar en cada caso) | [component-decision-tree.md](docs/20-contracts/component-decision-tree.md) |
| Selección radio/checkbox tipo card en formularios CRUD | [component-form-selection-group.md](docs/20-contracts/component-form-selection-group.md) · [ADR-0110](docs/10-architecture/adr/0110-crud-form-selection-group.md) |
| Shell, sidebar de módulos y navegación (patrón ERPNext v16) | [module-layout-navigation.md](docs/20-contracts/module-layout-navigation.md) · [ADR-0079](docs/10-architecture/adr/0079-module-navigation-sidebar-erpnext-v16.md) |
| Cards: roles, superficies, `CardLead`/`CardRail`/`cardAnatomy`, ratchet | [component-card-family.md](docs/20-contracts/component-card-family.md) · [ADR-0097](docs/10-architecture/adr/0097-card-family-roles-and-surface-tokens.md) |
| Datos, KPI y gráficos con cabecera: `Metric`, `MetricStrip`, `ChartCard` (valores en JetBrains Mono, tono solo con significado) | [component-metric.md](docs/20-contracts/component-metric.md) · [ADR-0149](docs/10-architecture/adr/0149-metric-card-system.md) |
| Radios, superficies (`surface-item`/`surface-panel`/`flush-panel`), sombras, cinta CMYK | [geometry-surfaces.md](docs/20-contracts/geometry-surfaces.md) |
| Chips, badges y etiquetas | [component-chip.md](docs/20-contracts/component-chip.md) |
| Avisos y bandas de estado | [component-banner.md](docs/20-contracts/component-banner.md) |
| Primary = K100 (ADR) | [ADR-0070](docs/10-architecture/adr/0070-primary-process-black.md) |
| DataTable compact variant (ADR) | [ADR-0030](docs/10-architecture/adr/0030-datatable-compact-variant.md) |
| Sistema de color robustecido (ADR) | [ADR-0029](docs/10-architecture/adr/0029-color-system-robustening.md) |
| Reglas que hacen fallar el PR | [GOVERNANCE.md](docs/90-governance/GOVERNANCE.md) |

---

## 4. Fuente de verdad técnica

Los tokens viven en **`frontend/app/globals.css`** (bloque `@theme inline` + `:root`/`.dark`). Este documento y los contratos describen; `globals.css` decide. Los tests de contrato de `frontend/lib/__tests__/` hacen cumplir el sistema y deben estar en verde:

| Test | Qué protege |
|---|---|
| `color-system.contract.test.ts` · `intent-text-contrast.contract.test.ts` | intents, paridad claro/oscuro, contraste de los tokens `*-text` |
| `typography.contract.test.ts` · `selector-typography.contract.test.ts` | escala fluida, roles N0–N4 y chrome del shell |
| `density-controls.contract.test.ts` | dial `--k`, alturas por rol, variante `touch:` |
| `card-family.contract.test.ts` | ninguna card hecha a mano (baseline que solo encoge) |
| `metric-family.contract.test.ts` | `Metric`/`MetricStrip`/`ChartCard`; `StatCard` no vuelve |
| `animate-in.contract.test.ts` | `FadeIn` como único primitivo de entrada |
| `banner.contract.test.ts` · `notched-field*.contract.test.ts` | avisos y campos con legend |

Si algo cambia en `globals.css` o en la escala tipográfica, el test, el contrato y este documento quedan en sync en el mismo PR.

## 5. Cambiar el design system

- **Cualquier cambio de contrato (capa 20), API pública o invariante global exige ADR.** Ver [GOVERNANCE.md](docs/90-governance/GOVERNANCE.md) y [docs/README.md](docs/README.md).
- Si el cambio toca color, tipografía, densidad, geometría o animación: actualizar el contrato correspondiente, su test de contrato **y** este DESIGN.md en el mismo PR. No hay un segundo documento de design system: `docs/10-architecture/design-system.md` se retiró en [ADR-0157](docs/10-architecture/adr/0157-design-system-doc-consolidation.md).
- Auditoría DOC→APP (docs vs. código) se ejecuta periódicamente; un design system con docs stale rompe la consistencia de todo el equipo.
