---
layer: 20-contracts
doc: component-animation
status: active
owner: frontend-team
last_review: 2026-05-21
stability: stable
---

# Contrato de Arquitectura: Animaciones y Transiciones de Vista

Este contrato define las reglas de gobernanza, criterios de uso, especificaciones técnicas y la guía de referencia módulo por módulo para la aplicación de animaciones de entrada locales en todo el ecosistema de **ERPGrafico** (excluyendo vistas del POS).

---

## 1. Declaración de Misiones (Gobernanza Visual)

El sistema visual de ERPGrafico está diseñado para transmitir una sensación **premium, fluida e industrial**. Para lograr esto de forma coherente sin penalizar el rendimiento ni cansar al usuario, dividimos el manejo de transiciones en dos capas estrictas:

```mermaid
graph TD
    A[Navegación en el Sistema] --> B{¿Cambia el Pathname?}
    B -- Sí (ej. /contacts a /profile) --> C[Animación Global - DashboardShell]
    B -- No (ej. /profile?tab=account a ?tab=personal) --> D[Animación Local - FadeIn]
    C --> E[Deslizamiento y Desvanecimiento del Canvas Completo]
    D --> F[Desvanecimiento y Elevación Sutil de Sub-vistas]
```

### Reglas Invariables (PR Reject si se violan)
1. **Cero imports directos de `framer-motion` en páginas**: Queda prohibido importar `motion` de `framer-motion` para animaciones de entrada de páginas o pestañas secundarias. Debe usarse obligatoriamente el componente compartido `<FadeIn>`.
2. **Cero duplicación de animación en páginas simples**: Las páginas que solo cambian de contenido mediante una ruta única no deben envolverse en ningún componente de animación local. La transición la realiza el [DashboardShell](../../frontend/components/layout/DashboardShell.tsx).
3. **Respeto Absoluto a Accesibilidad (Reduced Motion)**: Toda micro-animación local o global debe integrarse con las configuraciones de accesibilidad del sistema operativo para usuarios con sensibilidad al movimiento vestibular.

### §1.1 Lista de Prohibiciones (ADR-0075)

Se prohíbe, como PR Reject, en componentes de página/módulo:

- `animate-in` / `animate-*` (utilidades Tailwind de entrada) en grids, tarjetas o contenido de página.
- `animationDelay` / `animationFillMode` inline y `@keyframes` propios en contenido de página.
- Imports directos de `framer-motion` (regla 1, reafirmada).

La entrada de contenido se entrega solo vía: (a) transición global del `DashboardShell` al cambiar pathname, o (b) `<FadeIn>` para sub-vistas del mismo pathname (delay vía prop `delay`, GPU-only y reduced-motion aware).

### §1.2 Module Grids (ADR-0074 + ADR-0075)

Los grids de módulos (Dashboard y Settings) renderizan **tarjetas estáticas sin animación local** — el shell ya anima la vista completa. Cualquier entrada escalonada que se desee se aplica con un **único `<FadeIn>` del consumidor** que envuelve todo el grid, nunca per-card con `animationDelay` inline.

### §1.3 Micro-feedback (ADR-0075 §4)

Las pulsaciones/rebotes de atención (iconos de éxito/éxito-alerta, `animate-bounce`, `scale` de confirmación) están permitidas como **cue breve SOLO si**:

- se acompañan de `motion-reduce:animate-none`, o
- quedan cubiertas por el floor global de SC 2.3.3 (ver §1.4).

### §1.4 Floor Global Reduced Motion (WCAG 2.1 SC 2.3.3)

`frontend/app/globals.css` define el floor global (ADR-0075): bajo `prefers-reduced-motion: reduce`, cualquier elemento que aplique utilidades de entrada (`.animate-in`/`.animate-out`) o `animation-delay` inline colapsa a un único frame (`0.01ms`, sin delay, sin iteraciones extra, `transform: none`). Se mantienen además las reglas específicas de skeleton y sheets (100ms) y los pares `motion-reduce:` más fuertes donde existan (`DashboardShell`).

---

## 2. El Componente Compartido: `<FadeIn>`

El componente [FadeIn.tsx](../../frontend/components/shared/FadeIn.tsx) encapsula la lógica de transición optimizada para hardware, con soporte integrado de accesibilidad.

### Interfaz del Componente (`FadeInProps`)

```typescript
export interface FadeInProps {
    children: React.ReactNode
    className?: string   // Clases de Tailwind adicionales para diseño/grillas
    delay?: number       // Retardo antes de iniciar (en segundos)
    duration?: number    // Duración de la animación (por defecto 0.35s)
    yOffset?: number     // Distancia de elevación vertical (por defecto 8px)
}
```

### Ejemplo de Uso Básico (Pestañas Simples)

```tsx
import { FadeIn } from "@/components/shared"

function SalesTabView({ activeTab }: { activeTab: string }) {
    return (
        <div className="w-full">
            {activeTab === "orders" && (
                <FadeIn>
                    <OrdersTable />
                </FadeIn>
            )}
            
            {activeTab === "invoices" && (
                <FadeIn>
                    <InvoicesTable />
                </FadeIn>
            )}
        </div>
    )
}
```

### Ejemplo de Uso Avanzado (Grid estático — un solo FadeIn)

Per §1.2, un grid estático NO anima cada tarjeta: un único `<FadeIn>` del consumidor envuelve todo el grid.

```tsx
import { FadeIn } from "@/components/shared"

function DashboardWidgets() {
    return (
        <FadeIn>
            <ModuleGrid items={modules} />
        </FadeIn>
    )
}
```

---

## 3. Criterios Técnicos y Optimización de Rendimiento

Para asegurar que las animaciones locales se rendericen a **60-120 FPS** sin causar retardos perceptibles (*jank*), se imponen las siguientes reglas técnicas:

> [!IMPORTANT]
> **Propiedades Permitidas para Animar:**
> Únicamente se permite animar propiedades compuestas por la **GPU**: `opacity` y `transform` (desplazamientos `translateX/Y`, escala). 
> **Queda estrictamente prohibido** animar propiedades como `width`, `height`, `padding`, `margin`, `border` o `font-size`, ya que causan recalculaciones completas del flujo del documento (*CSS Reflow / Layout Thrashing*).

> [!TIP]
> **Transiciones de Salida:**
> En aplicaciones SPA complejas con alta concurrencia de datos, las animaciones de salida (`exit`) intensas bloquean la destrucción inmediata de elementos del DOM por parte de React. El componente `<FadeIn>` utiliza una salida de opacidad rápida y optimizada para asegurar que el DOM se libere al instante.

---

## 4. Evaluación Módulo por Módulo y Plan de Acción

A continuación se realiza una auditoría completa del árbol de páginas del frontend de ERPGrafico para categorizarlas bajo este contrato y definir en cuáles se debe implementar `<FadeIn>` local.

### Tabla General de Auditoría de Módulos

| Módulo / Ruta | Tipo de Navegación | Criterio de Animación Local | Estado | Archivos Clave a Modificar |
|---|---|---|---|---|
| **Mi Perfil** (`/profile`) | Pestañas y Sub-pestañas vía Query Params | **Requerido**. Mantiene el mismo pathname pero alterna sub-vistas pesadas. | 🟢 Implementado (`<FadeIn>` en `ProfileView.tsx`) | Ninguno |
| **Tablero** (`/`) | Ruta simple / Dashboards estáticos | **No Requerido**. El Shell maneja la entrada principal. | 🟢 Conforme | Ninguno |
| **Contactos** (`/contacts`) | Lista unificada con hojas colapsables | **No Requerido**. Usa Skeletons + hojas laterales dinámicas. | 🟢 Conforme | Ninguno |
| **Ventas** (`/sales`) | Pestañas múltiples (`orders`, `quotes`, `customers`) | **Requerido**. Cambia de sub-tablas pesadas sin cambiar de ruta. | 🔴 Pendiente | `app/(dashboard)/sales/page.tsx` o vistas de pestañas. |
| **Compras** (`/purchasing`) | Pestañas múltiples (`orders`, `requisitions`) | **Requerido**. Evitará el salto seco entre tablas de compras. | 🔴 Pendiente | `app/(dashboard)/purchasing/page.tsx` |
| **Inventario** (`/inventory`) | Pestañas múltiples (`products`, `adjustments`, `warehouses`) | **Requerido**. Dinamiza el cambio de fichas de bodega y productos. | 🔴 Pendiente | `app/(dashboard)/inventory/page.tsx` |
| **Tesorería** (`/treasury`) | Pestañas de movimientos y cuentas | **Requerido**. Muy útil al cambiar entre cuentas de caja y transacciones. | 🔴 Pendiente | `app/(dashboard)/treasury/page.tsx` |
| **Producción** (`/production`) | Wizard / Flujos secuenciales | **Requerido**. Para las transiciones entre fases del asistente de órdenes. | 🟡 Parcial | Componentes del Wizard de Producción. |
| **Facturación** (`/billing`) | Vistas de tarjetas y listas rápidas | **Requerido** (al cambiar tipo de vista o de tipo de documento). | 🔴 Pendiente | `app/(dashboard)/billing/page.tsx` |
| **Contabilidad** (`/accounting`) | Pestañas de libros, diarios y balances | **Requerido**. Suaviza el cambio entre el Libro Diario, Mayor y Balances. | 🔴 Pendiente | `app/(dashboard)/accounting/page.tsx` |

---

## 5. Próximos Pasos de Implementación

Para ejecutar la unificación estética módulo a módulo con el menor riesgo:

1. **Refactorizar el módulo Perfil** — ✅ **Completado**: los `<motion.div>` manuales de `ProfileView.tsx` fueron reemplazados por `<FadeIn>` (sirvió de PoC del contrato).
2. **Implementar en Ventas y Compras**: Identificar los archivos contenedores de pestañas y envolverlos en `<FadeIn>`.
3. **Auditar Rendimiento**: Monitorear las métricas de rendimiento (FPS y renderizados acumulados) tras la migración de cada módulo.
