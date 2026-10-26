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
2. **Primary = Process Black K100 (placa Key).** La acción primaria y el foco van en negro (K100), no en un color de marca. Cyan es el color de **énfasis** (sidebar, ring, chart-1). → [ADR-0070](docs/10-architecture/adr/0070-primary-process-black.md)
3. **Compact es el default.** Todas las superficies de datos (tablas, listas, kanban) nacen compactas. `comfortable` es opt-out explícito. → [density-system.md](docs/20-contracts/density-system.md)
4. **Una fuente sans (Onest) + una fuente mono real (JetBrains Mono).** Onest para UI; JetBrains Mono (bundleado vía `next/font`) para cifras, códigos y datos tabulares. → [typography-scale.md](docs/20-contracts/typography-scale.md)
5. **Movimiento con propósito.** Transiciones locales vía `<FadeIn>`, sin framer-motion directo en páginas, sin animaciones que frenen al operador. → [component-animation.md](docs/20-contracts/component-animation.md)
6. **Esquinas e industriales.** Jerarquía de radio 8/12/16/20 con anidamiento de esquinas. → [design-system.md](docs/10-architecture/design-system.md)
7. **Semántico sobre estético.** Nunca tokens raw de Tailwind (`bg-red-500`); siempre tokens semánticos (`bg-destructive`). → [GOVERNANCE.md](docs/90-governance/GOVERNANCE.md)
8. **Las cards se eligen por rol, no por aspecto.** `choice` (elegir uno), `item` (abrir un registro), `nav` (ir a un módulo), `metric` (un dato) y `panel` (agrupar contenido) comparten una sola anatomía (lead, código, título, descripción, pie, riel) y dos superficies: 8px para lo interactivo, 12px para contenedores. La cinta CMYK marca "elegido": se previsualiza al hover y queda fija al elegir (en `choice` y en las cards de entity-view; en bandeja y kanban solo seleccionada); el estado nunca lo lleva solo el color. Ninguna card se arma a mano con `border rounded bg-card`. → [component-card-family.md](docs/20-contracts/component-card-family.md) · [ADR-0097](docs/10-architecture/adr/0097-card-family-roles-and-surface-tokens.md)

---

## 3. Mapas de referencia

| Interés | Contrato / ADR |
|---------|----------------|
| Colores, intents, tintas CMYK, sidebar, charts, chips | [color-system.md](docs/20-contracts/color-system.md) |
| Tipografía, escala fluid, mono | [typography-scale.md](docs/20-contracts/typography-scale.md) |
| Espaciado y densidad (compact/comfortable) | [density-system.md](docs/20-contracts/density-system.md) |
| Animación y transiciones | [component-animation.md](docs/20-contracts/component-animation.md) |
| Componentes compartidos (qué usar en cada caso) | [component-decision-tree.md](docs/20-contracts/component-decision-tree.md) |
| Shell, sidebar de módulos y navegación (patrón ERPNext v16) | [module-layout-navigation.md](docs/20-contracts/module-layout-navigation.md) · [ADR-0079](docs/10-architecture/adr/0079-module-navigation-sidebar-erpnext-v16.md) |
| Cards: roles, superficies, `CardLead`/`CardRail`/`cardAnatomy`, ratchet | [component-card-family.md](docs/20-contracts/component-card-family.md) · [ADR-0097](docs/10-architecture/adr/0097-card-family-roles-and-surface-tokens.md) |
| Arquitectura del design system, radios | [design-system.md](docs/10-architecture/design-system.md) |
| Primary = K100 (ADR) | [ADR-0070](docs/10-architecture/adr/0070-primary-process-black.md) |
| DataTable compact variant (ADR) | [ADR-0030](docs/10-architecture/adr/0030-datatable-compact-variant.md) |
| Sistema de color robustecido (ADR) | [ADR-0029](docs/10-architecture/adr/0029-color-system-robustening.md) |
| Reglas que hacen fallar el PR | [GOVERNANCE.md](docs/90-governance/GOVERNANCE.md) |

---

## 4. Fuente de verdad técnica

Los tokens viven en **`frontend/app/globals.css`** (bloque `@theme inline` + `:root`/`.dark`). Los tests de contrato **`frontend/lib/__tests__/color-system.contract.test.ts`** y **`frontend/lib/__tests__/typography.contract.test.ts`** verifican invariantes (color, y escala/tokens tipográficos + roles del chrome del shell). **`frontend/lib/__tests__/card-family.contract.test.ts`** impide nuevas cards armadas a mano (baseline que solo puede encoger). Si algo cambia en globals.css o en la escala tipográfica, el test y este documento deben quedar en sync.

---

## 5. Cambiar el design system

- **Cualquier cambio de contrato (capa 20), API pública o invariante global exige ADR.** Ver [GOVERNANCE.md](docs/90-governance/GOVERNANCE.md) y [docs/README.md](docs/README.md).
- Si el cambio toca color, tipografía, densidad o animación: actualizar el contrato correspondiente **y** este DESIGN.md en el mismo PR.
- Auditoría DOC→APP (docs vs. código) se ejecuta periódicamente; un design system con docs stale rompe la consistencia de todo el equipo.
