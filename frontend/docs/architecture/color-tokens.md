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
*   **10% - Acento y Marca (Acciones):** Violeta Eléctrico (`--primary`) y Safety Orange (`--accent`). Reservados exclusivamente para acciones críticas, estados activos y feedback directo.

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
| Accent | `--accent` | `bg-accent` | `oklch(70% 0.049 234)` — gris-azul medio |
| Accent foreground | `--accent-foreground` | `text-accent-foreground` | Texto sobre fondo accent |

### Bordes y Formularios

| Token | Variable CSS | Clase Tailwind | Descripción |
|-------|-------------|----------------|-------------|
| Borde estándar | `--border` | `border-border` | `oklch(0.12 0.02 240 / 15%)` — translúcido |
| Input background | `--input` | `border-input` | `oklch(0.12 0.02 240 / 10%)` — muy sutil |
| Focus ring | `--ring` | `ring` / `outline-ring` | `oklch(0.65 0.25 310 / 40%)` — violeta difuso |
| Border radius base | `--radius` | `rounded-md` | `0.75rem` — esquinas soft/premium (12px) |

**Nota de radio:** El sistema usa esquinas suaves y redondeadas (`0.75rem` / 12px) para botones y tarjetas. Las variantes relativas de Tailwind en el sistema son:
- `rounded-sm` → `calc(var(--radius) - 2px)` (aprox 10px)
- `rounded-md` → `var(--radius)` (12px)
- `rounded-lg` → `calc(var(--radius) + 2px)` (aprox 14px)

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
| `ASSET` | `info` | Recursos, liquidez y estabilidad | Azul/Cian |
| `LIABILITY` | `warning` | Obligaciones y compromisos (riesgo) | Ámbar |
| `EQUITY` | `neutral` | Valor residual, core de la empresa | Gris |
| `INCOME` | `success` | Flujo positivo, éxito comercial | Verde |
| `EXPENSE` | `destructive` | Salida de recursos, consumo | Rojo |

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
