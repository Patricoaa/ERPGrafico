# Color Tokens & Design System — ERPGrafico

> **Fuente de verdad:** `src/app/globals.css`
> Este documento es el mapa oficial entre los tokens CSS del sistema y su uso semántico en componentes.
> **Regla absoluta:** Nunca usar valores de color hardcoded (hex, rgb, oklch directo) en componentes.
> Siempre usar las clases de Tailwind v4 que mapean a estas variables.

---

## Arquitectura Visual: Regla 60-30-10

El sistema de color se rige por proporciones armónicas para garantizar un entorno industrial limpio y profesional:

*   **60% - Dominante (Neutrales):** Fondo de página (`--background`), superficies de cards (`--card`) y textos principales (`--foreground`). Define la atmósfera del sistema.
*   **30% - Secundario (Bordes y Superficies):** Bordes (`--border`), fondos de inputs (`--input`) y estados muted (`--muted`). Aporta estructura y profundidad.
*   **10% - Acento y Marca (Acciones):** Violeta Eléctrico (`--primary`) y Ámbar Industrial (`--accent`). Reservados exclusivamente para acciones críticas, estados activos y feedback directo. El ámbar evoca los colores de seguridad y señalización de planta industrial.

---

## Sistema de Espaciado (8pt Grid)

Todo el ERP se construye sobre una rejilla de **8px** (0.5rem). El ritmo vertical y horizontal es sagrado para la consistencia visual.

| Token Tailwind | Valor CSS | Píxeles | Uso recomendado |
|----------------|-----------|---------|-----------------|
| `spacing-r-xs`   | `0.25rem` | 4px     | Micro-ajustes de iconos y textos |
| `spacing-r-sm`   | `0.5rem`  | 8px     | Gaps internos de grupos, paddings pequeños |
| `spacing-r-md`   | `1rem`    | 16px    | Gaps entre secciones, padding estándar de cards |
| `spacing-r-lg`   | `1.5rem`  | 24px    | Márgenes entre grandes bloques |
| `spacing-r-xl`   | `2rem`    | 32px    | Espaciado externo de contenedores maestros |

**Regla:** El uso de valores arbitrarios (ej. `m-[7px]`) está estrictamente prohibido. Si un diseño requiere un ajuste, debe aproximarse al múltiplo de 4px o 8px más cercano.

---

## Jerarquía de Interacción (Ley de Fitts)

Para garantizar la usabilidad en entornos industriales de alta velocidad, los objetivos táctiles y de clic siguen estándares mínimos:

| Elemento | Altura Base | Token Tailwind | Justificación |
|----------|-------------|----------------|---------------|
| Botón / Input (Base) | **40px** | `h-10` | Estándar de interacción rápida |
| Botón / Input (Compacto) | **36px** | `h-9` | Zonas de alta densidad |
| Botón / Input (Grande) | **48px** | `h-12` | Acciones principales o modales destacados |

**Regla:** Ningún elemento interactivo (excepto links y menús ultra-compactos) debe tener un área de clic menor a **40px** en su dimensión principal.

---

## Tipografía

| Rol | Variable CSS | Clase Tailwind | Uso |
|-----|-------------|----------------|-----|
| Body / UI | `--font-sans` → `Onest` | `font-sans` | Todo el texto de interfaz |
| Headings | `--font-heading` → `Syne` | `font-heading` | Títulos de página, sección |
| Código | `--font-mono` | `font-mono` | Valores técnicos, IDs, código |

**Regla:** Los headings (`h1`–`h6`) tienen `font-extrabold tracking-tighter uppercase` aplicado globalmente. No sobreescribir salvo excepción documentada.

---

## Tokens Base (Light Mode)

Estos son los tokens fundamentales del sistema. Se auto-adaptan al modo oscuro si se activa `.dark`.

### Superficie y Fondo

| Token | Variable CSS | Clase Tailwind | Descripción |
|-------|-------------|----------------|-------------|
| Fondo de página | `--background` | `bg-background` | `oklch(0.99 0.005 240)` — blanco-azulado |
| Card / Panel | `--card` | `bg-card` | `oklch(1 0 0)` — blanco puro |
| Popover / Dropdown | `--popover` | `bg-popover` | `oklch(1 0 0)` — blanco puro |
| Muted (sutil) | `--muted` | `bg-muted` | `oklch(0.95 0.01 240)` — gris muy claro |

### Texto

| Token | Variable CSS | Clase Tailwind | Descripción |
|-------|-------------|----------------|-------------|
| Texto principal | `--foreground` | `text-foreground` | `oklch(0.12 0.02 240)` — casi negro industrial |
| Texto en card | `--card-foreground` | `text-card-foreground` | Igual a foreground |
| Texto secundario | `--muted-foreground` | `text-muted-foreground` | `oklch(0.40 0.02 240)` — gris medio |

### Marca y Acción

| Token | Variable CSS | Clase Tailwind | Descripción |
|-------|-------------|----------------|-------------|
| Primary | `--primary` | `bg-primary` / `text-primary` | `oklch(62% 0.244 301)` — violeta eléctrico |
| Primary foreground | `--primary-foreground` | `text-primary-foreground` | Texto sobre fondo primary |
| Secondary | `--secondary` | `bg-secondary` | `oklch(0.90 0.03 240)` — gris-azul claro |
| Secondary foreground | `--secondary-foreground` | `text-secondary-foreground` | Texto sobre fondo secondary |
| Accent | `--accent` | `bg-accent` | `oklch(0.72 0.14 55)` — ámbar industrial cálido |
| Accent foreground | `--accent-foreground` | `text-accent-foreground` | Texto sobre fondo accent |

### Bordes y Formularios

| Token | Variable CSS | Clase Tailwind | Descripción |
|-------|-------------|----------------|-------------|
| Borde estándar | `--border` | `border-border` | `oklch(0.12 0.02 240 / 15%)` — translúcido |
| Input background | `--input` | `border-input` | `oklch(0.12 0.02 240 / 10%)` — muy sutil |
| Focus ring | `--ring` | `ring` / `outline-ring` | `oklch(0.65 0.25 310 / 40%)` — violeta difuso |
| Border radius base | `--radius` | `rounded-sm` | `0.125rem` — micro-radius industrial (2px) |

**Sistema de Radius (Industrial Micro-Radius):**

El sistema usa esquinas casi rectas (`0.125rem` / 2px) que mantienen la identidad industrial
pero permiten mejor rendering subpixel. Bordes visualmente rectos pero técnicamente suavizados.

Las variantes de Tailwind escaladas:
- `rounded-sm` → `var(--radius)` (2px) — Inputs, botones, badges, chips
- `rounded-md` → `calc(var(--radius) + 2px)` (4px) — Cards, containers
- `rounded-lg` → `calc(var(--radius) + 4px)` (6px) — Modals, sheets
- `rounded-xl` → `calc(var(--radius) + 8px)` (10px) — Solo casos especiales documentados
- `rounded-2xl` → `calc(var(--radius) + 14px)` (16px) — Prohibido en componentes estándar

**Regla de uso por tipo de elemento:**

| Tipo de elemento | Clase de radio | Valor | Justificación |
|---|---|---|---|
| Inputs, Selects, Buttons | `rounded-sm` | 2px | Precisión operativa, evoca controles de máquina |
| Cards, Containers | `rounded-md` | 4px | Equilibrio industrial |
| Modals, Sheets, Overlays | `rounded-lg` | 6px | Separación visual de capas |
| Logo, Avatar, FAB | `rounded-xl` o `rounded-full` | 10px / full | Excepción documentada |
| Badges, Chips | `rounded-sm` | 2px | Compacto e industrial |

> **Prohibido:** Usar `rounded-2xl` o `rounded-3xl` en componentes estándar. Esos valores rompen la coherencia industrial.

### Elevation System (Profundidad)

| Token CSS | Clase sugerida | Uso |
|-----------|---------------|-----|
| `--shadow-card` | `shadow-[var(--shadow-card)]` | Cards en reposo, contenedores estándar |
| `--shadow-elevated` | `shadow-[var(--shadow-elevated)]` | Cards destacadas, métricas KPI, `IndustrialCard variant="elevated"` |
| `--shadow-floating` | `shadow-[var(--shadow-floating)]` | Dropdowns, popovers, tooltips |
| `--shadow-overlay` | `shadow-[var(--shadow-overlay)]` | Modales, sheets, wizards |

> Las sombras usan `oklch(0.12 0.02 240 / X%)` para producir sombras tintadas que coinciden con la paleta industrial.

### Motion Tokens (Animación)

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--ease-premium` | `cubic-bezier(0.16, 1, 0.3, 1)` | Overshoot para paneles, sheets, modales |
| `--ease-micro` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Hover, focus, cambios de estado sutiles |
| `--ease-enter` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Elementos que entran (fade-in, slide-in) |
| `--ease-exit` | `cubic-bezier(0.4, 0.0, 1, 1)` | Elementos que salen (fade-out, slide-out) |
| `--duration-fast` | `150ms` | Hover, focus, micro-interacciones |
| `--duration-normal` | `250ms` | Transiciones estándar, cambios de estado |
| `--duration-slow` | `400ms` | Paneles, modales, animaciones complejas |

---

## Tokens Semánticos (Estados de UI)

Estos tokens representan significado de negocio. Son los únicos colores válidos para estados en `StatusBadge`, alertas, y feedback al usuario.

| Semántica | Token CSS | Foreground | Uso en negocio |
|-----------|-----------|------------|----------------|
| **success** | `--success` `oklch(0.65 0.20 145)` | `--success-foreground` | Completado, pagado, despachado, publicado |
| **warning** | `--warning` `oklch(0.75 0.20 85)` | `--warning-foreground` | En curso, pendiente de acción, en revisión |
| **destructive** | `--destructive` | `--destructive-foreground` | Cancelado, rechazado, error crítico |
| **info** | `--info` `oklch(0.65 0.20 240)` | `--info-foreground` | Borrador, inicial, sin acción requerida |

**Regla de uso en Tailwind:**
```tsx
// ✅ Correcto
<span className="bg-success text-success-foreground" />
<span className="bg-warning text-warning-foreground" />
<span className="bg-destructive text-destructive-foreground" />
<span className="bg-info text-info-foreground" />
<span className="bg-neutral text-neutral-foreground" />

// ✅ Correcto (Expansión Semántica - Naturaleza Financiera)
<span className="bg-income text-income-foreground" />
<span className="bg-expense text-expense-foreground" />
<span className="bg-asset text-asset-foreground" />
<span className="bg-liability text-liability-foreground" />

// ❌ Prohibido
<span className="bg-green-500 text-white" />
<span className="bg-yellow-400" />
```

---

## Tokens de Sidebar

El sidebar tiene su propio sistema de tokens porque opera sobre fondo oscuro (`oklch(0.10 0.02 240)`) independientemente del modo del resto de la app.

| Token | Variable CSS | Clase Tailwind | Descripción |
|-------|-------------|----------------|-------------|
| Fondo sidebar | `--sidebar` | `bg-sidebar` | `oklch(0.10 0.02 240)` — casi negro azulado |
| Texto sidebar | `--sidebar-foreground` | `text-sidebar-foreground` | `oklch(0.90 0.02 240)` — casi blanco |
| Ítem activo | `--sidebar-primary` | `bg-sidebar-primary` | Hereda de `--primary` (violeta) |
| Hover de ítem | `--sidebar-accent` | `bg-sidebar-accent` | `oklch(1 0 0 / 5%)` — blanco muy translúcido |
| Borde sidebar | `--sidebar-border` | `border-sidebar-border` | `oklch(1 0 0 / 10%)` — línea sutil |

**Importante:** El sidebar es la única superficie que opera siempre en modo oscuro. No usar tokens de `--background` o `--foreground` dentro del sidebar.

---

## Mapa de Estados de Negocio → Tokens Semánticos

Este mapa es la implementación concreta del contrato de `StatusBadge`. Ver `component-contracts.md` para la API del componente.

### Sales — SaleOrder.Status

| Estado backend | Token semántico | Justificación |
|---------------|-----------------|---------------|
| `DRAFT` | `info` | Estado inicial, sin acción urgente |
| `CONFIRMED` | `warning` | Requiere acción (facturar/producir) |
| `INVOICED` | `warning` | Pendiente de pago total |
| `PAID` | `success` | Flujo completado con éxito |
| `CANCELLED` | `destructive` | Anulado, flujo detenido |

### Sales — SaleOrder.DeliveryStatus

| Estado backend | Token semántico | Justificación |
|---------------|-----------------|---------------|
| `PENDING` | `info` | Sin acción de despacho aún |
| `PARTIAL` | `warning` | Despacho incompleto, requiere atención |
| `DELIVERED` | `success` | Entrega completada |

### Production — WorkOrder.Status

| Estado backend | Token semántico | Justificación |
|---------------|-----------------|---------------|
| `DRAFT` | `info` | En preparación |
| `PLANNED` | `info` | En cola, sin acción activa aún |
| `IN_PROGRESS` | `warning` | En máquina/diseño, activo |
| `FINISHED` | `success` | Listo para despacho |
| `CANCELLED` | `destructive` | Anulado |

### Production — WorkOrder.Stage

Las etapas de taller son un flujo lineal. Se muestran como texto plano o stepper, no como `StatusBadge`. Si se requiere badge de etapa, usar `info` para todas las etapas intermedias y `success` solo para `FINISHED`.

| Etapa | Token semántico |
|-------|-----------------|
| `MATERIAL_ASSIGNMENT` → `OUTSOURCING_VERIFICATION` | `info` |
| `RECTIFICATION` | `warning` |
| `FINISHED` | `success` |

### Treasury — TreasuryMovement.Status

| Estado backend | Token semántico | Justificación |
|---------------|-----------------|---------------|
| `PENDING` | `warning` | Requiere registro en banco/caja |
| `COMPLETED` | `success` | Efectivo, conciliado |
| `CANCELLED` | `destructive` | Anulado |

### Treasury — BankStatementLine.ReconciliationStatus

| Estado backend | Token semántico | Justificación |
|---------------|-----------------|---------------|
| `UNRECONCILED` | `info` | Sin acción aún |
| `MATCHED` | `warning` | Sugerencia encontrada, pendiente confirmar |
| `RECONCILED` | `success` | Conciliado correctamente |
| `DISPUTED` | `destructive` | En disputa, requiere revisión manual |
| `EXCLUDED` | `info` | Excluido manualmente, estado neutro |

### Accounting — Period.Status

| Estado backend | Token semántico | Justificación |
|---------------|-----------------|---------------|
| `OPEN` | `success` | Periodo vigente y operable |
| `UNDER_REVIEW` | `warning` | En proceso de cierre |
| `CLOSED` | `info` | Bloqueado (solo lectura), estado neutro |

### Accounting — Account Types (Tipo de Cuenta)

Este mapa define la codificación de color por naturaleza de cuenta contable para facilitar el análisis visual del balance y estado de resultados.

| Tipo backend | Token semántico | Justificación | Color visual |
|-------------|-----------------|---------------|-------------|
| `ASSET` | `asset` | Recursos, liquidez y estabilidad | Azul/Cian (`--info`) |
| `LIABILITY` | `liability` | Obligaciones y compromisos (riesgo) | Ámbar (`--warning`) |
| `EQUITY` | `neutral` | Valor residual, core de la empresa | Gris Industrial |
| `INCOME` | `income` | Flujo positivo, éxito comercial | Verde (`--success`) |
| `EXPENSE` | `expense` | Salida de recursos, consumo | Rojo (`--destructive`) |

---

## Reglas Anti-Patrón

```tsx
// ❌ PROHIBIDO: Color hardcoded
<div style={{ color: '#2563EB' }} />
<div className="text-blue-600" />

// ❌ PROHIBIDO: Inventar variantes semánticas
<span className="bg-orange-400" /> // No existe token para naranja

// ❌ PROHIBIDO: Usar primary como estado de negocio
<span className="bg-primary" /> // Primary es para acciones de marca, no estados

// ✅ CORRECTO: Siempre token semántico para estados
<span className="bg-success text-success-foreground" />

// ✅ CORRECTO: Tokens de superficie para layout
<div className="bg-card border-border" />
<p className="text-muted-foreground" />
```

---

## Fondo de Página — Efecto Noise

El `body` tiene un `background-image` con un SVG de ruido fractal (`opacity: 0.02`) aplicado como `background-attachment: fixed`. Este efecto es parte del diseño industrial del sistema.

**Regla:** No replicar este efecto en componentes individuales. Solo existe a nivel de `body` en `globals.css`.

---

## Vocabulario Visual de la Industria Gráfica

Estos tokens y clases CSS formalizan la identidad visual que diferencia a ERPGrafico de ERPs genéricos. Se inspiran en los elementos reales de la producción gráfica: marcas de registro, guías de sangrado, líneas de corte.

### Tokens CSS

| Token | Variable CSS | Valor (Light) | Uso |
|---|---|---|---|
| Color de marca | `--mark-color` | `oklch(0.12 0.02 240 / 0.08)` | Color de registration marks y crop marks |
| Marca activa | `--mark-color-active` | `var(--primary)` | Para marcas en estado activo/hover |
| Color de grilla | `--grid-line-color` | `oklch(0.12 0.02 240 / 0.04)` | Líneas de guía tipo bleed |
| Tamaño de grilla | `--grid-line-size` | `80px` | Tamaño de celda de la grilla decorativa |
| Separador industrial | `--separator-industry` | `2px dashed ...` | Línea punteada tipo die-cut |

### Clases CSS Utilitarias

| Clase | Descripción | Uso recomendado |
|---|---|---|
| `.registration-marks` | Agrega marcas de esquina (crop marks) via `::before`/`::after` | Contenedores principales, modales de transacción |
| `.bleed-guides` | Superpone una grilla decorativa que evoca guías de sangrado | Paneles de fondo, contenedores vacíos |
| `.die-cut-separator` | Línea horizontal punteada tipo perforación | Separadores de secciones, alternativa a `<hr>` |

### Componente: IndustryMark

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `positions` | `MarkPosition[]` | `['top-left', 'top-right', 'bottom-left', 'bottom-right']` | Esquinas a decorar |
| `variant` | `'corner' \| 'crosshair' \| 'target'` | `'corner'` | Estilo visual de la marca |
| `active` | `boolean` | `false` | Usa `--mark-color-active` (primary) |

---

## Tokens de Alto Contraste (Specialized UI)

Tokens reservados para interfaces que requieren lectura por máquina (escáneres de código de barras, OCR) o accesibilidad extrema.

| Token | Variable CSS | Valor | Uso |
|-------|-------------|-------|-----|
| High Contrast BG | `--high-contrast-bg` | `oklch(1 0 0)` | Fondo para códigos de barras / QR |
| High Contrast FG | `--high-contrast-fg` | `oklch(0 0 0)` | Color de barras / texto OCR |

**Regla:** No usar estos tokens para elementos decorativos. Su propósito es funcional y de legibilidad técnica.

**Regla de uso:** Las marcas de registro son decorativas y sutiles. No abusar — usarlas solo en contenedores principales y modales de alto impacto visual.
