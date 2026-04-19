# Gobernanza Maestra — ERPGrafico

Este documento define la "Constitución" técnica del frontend del proyecto ERPGrafico. Cualquier nuevo desarrollo, refactorización o corrección de código debe acatar estas reglas fundamentales.

## 1. Zero Any Policy (Tolerancia Cero a `any`)
- **Está estrictamente prohibido** el uso del tipo `any` en todo nuevo código TypeScript.
- Cuando la estructura de los datos que vienen del backend sea temporalmente incierta, utilizar `unknown` y aplicar *Type Guards* (o validadores como Zod).

## 2. Decisiones de Arquitectura (ADRs)
- Todo cambio que introduzca una nueva dependencia core, un nuevo patrón de diseño o una refactorización masiva debe documentarse formalmente como un ADR (Architecture Decision Record) en `docs/architecture/adr/`.
- Ningún pull request, IA o desarrollador puede contradecir un ADR activo. Para cambiar de rumbo, debe redactarse un nuevo ADR que lo sustituya.

## 3. Diseño y UI/UX (Protocolo `ui-ux-pro-max`)
- El diseño visual del sistema está gobernado por nuestro Design System (generado por la skill `ui-ux-pro-max`).
- Nunca inventar variantes visuales o usar utilidades de Tailwind genéricas (ej. `bg-red-500`) en componentes comunes. Deben mapearse a los *Tokens Semánticos* documentados en `color-tokens.md`.
- No modificar el código fuente de componentes base de `/ui` (shadcn) directamente. Ampliarlos en `/shared`.

## 4. Nomenclatura y Convenciones (Naming)
- **Componentes React:** PascalCase (ej. `SaleOrderForm.tsx`).
- **Hooks personalizados:** camelCase con prefijo "use" (ej. `useStockValidation.ts`).
- **Tipos e Interfaces:** PascalCase puro sin prefijos "I" o sufijos "Type" (ej. `SaleOrder`, no `ISaleOrder`).
- **Constantes de Configuración:** UPPER_SNAKE_CASE (ej. `FORM_STYLES`, `MAX_RETRIES`).

## 5. Feature-Sliced Design (Arquitectura Modular)
- El código en `app/` solo debe contener la lógica de renderización de la página y layout principal (Server Components recomendados).
- La complejidad modular debe encapsularse en `src/features/[modulo]`.
- Un feature no debe conocer ni importar archivos internos aislados de otro feature directamente, debiendo pasar por el "contrato público" o *barrel export* si fuera necesario, o bien promover el código a `/shared`.

## 6. Integridad de Pull Requests y QA
- No se aceptará en la rama principal código que no pase limpiamente `npm run type-check`.
- Todos los estados en componentes compartidos y tablas de datos deben contemplar y documentar:
  - Estado *Loading* (ver Regla 10 — protocolo de estados de carga).
  - Estado *Empty* (`EmptyState`).
  - Estado de *Error* (Manejado globalmente a través de utilidades proxy hacia Toasts).

## 7. Estándares de Interacción y Ritmo Visual
- **Ritmo Vertical (8pt Grid):** Todo el espaciado (`padding`, `margin`, `gap`) debe ser múltiplo de 8px (0.5rem). Se prohíbe el uso de valores arbitrarios fuera de la escala definida en `color-tokens.md`.
- **Ley de Fitts (Área de Clic):** Ningún elemento interactivo principal debe tener una altura menor a **40px** (`h-10`). Los elementos compactos excepcionales deben ser de **36px** (`h-9`).
- **Regla 60-30-10:** El balance de color debe respetarse estrictamente para evitar la fatiga visual. El color primary (`Electric Violet`) solo debe ocupar el 10% de la superficie visual activa.
- **Border Radius Industrial:** El sistema usa `--radius: 0.125rem` (2px) — micro-radius que mantiene la estética industrial pero permite mejor rendering subpixel. No usar `rounded-2xl`, `rounded-3xl` ni `rounded-full` en componentes estándar salvo excepción documentada (logo, avatar, FAB). Ver tabla de uso en `color-tokens.md`.

## 8. Anatomía del Layout
- **Grilla de 12 Columnas:** Todos los layouts de página deben basarse en una grilla de 12 columnas (`grid-cols-12`). 
- **Contenedores:** El ancho máximo de contenido debe estar controlado por el contenedor estándar del sistema para mantener la legibilidad en monitores ultrawide.

## 10. Protocolo de Estados de Carga (Loading States)

La distinción entre **Skeleton** y **Spinner** es obligatoria. No son intercambiables.

### Regla de uso

| Situación | Componente correcto | Prohibido |
|-----------|---------------------|-----------|
| Carga inicial de datos (page load, Suspense, fetch inicial) | `Skeleton` | `Loader2` spinner |
| Acción iniciada por usuario (submit, guardar, eliminar, pagar) | `Loader2` en el botón/acción | Skeleton |
| `loading.tsx` de ruta Next.js | `Skeleton` que mimetice el layout | `Loader2` spinner |
| Botón en estado de envío | `Loader2` inline (`h-4 w-4 animate-spin`) | Skeleton |

**Regla de oro:** Si el usuario NO hizo clic → Skeleton. Si el usuario hizo clic → Spinner en el elemento accionado.

### Implementación de Skeletons

- Crear un skeleton por **región/layout**, no por componente atómico. Un `InvoiceListSkeleton` que cubra toda la tabla, no un `RowSkeleton` individual.
- Siempre componer usando el primitivo `<Skeleton>` de `@/components/ui/skeleton`. **Prohibido** aplicar `animate-pulse` o `bg-muted animate-pulse` directamente en divs. El primitivo garantiza propagación de tokens de animación.
- Ubicación: `features/[modulo]/components/skeletons/[Modulo]Skeleton.tsx`. Skeletons compartidos entre módulos van a `components/shared/`.
- El skeleton debe replicar fielmente el número de columnas, altura de filas y estructura de la región real.

### `LoadingFallback`

El componente `LoadingFallback` NO debe usarse con `variant='spinner'`. Ese variant está deprecado. Para Suspense boundaries siempre usar `variant='table'`, `'card'` o `'list'`, o pasar directamente el skeleton específico del módulo.

## 9. Identidad de Industria Gráfica
- El ERP debe transmitir visualmente su orientación a la industria gráfica mediante un **vocabulario visual de imprenta** formalizado en `color-tokens.md` §Vocabulario Visual.
- Elementos disponibles: marcas de registro (`.registration-marks` / `IndustryMark`), guías de sangrado (`.bleed-guides`), separadores die-cut (`.die-cut-separator`), textura de ruido (solo `body`).
- Estos elementos son **decorativos y sutiles** (opacidad 3-8%). No deben competir con el contenido funcional.
- **Prohibido** crear elementos decorativos ad-hoc que imiten marcas de impresión fuera de los tokens y componentes establecidos.
