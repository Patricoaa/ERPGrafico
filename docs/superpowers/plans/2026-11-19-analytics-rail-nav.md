# Analytics RailNav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reusar el riel izquierdo del modal de perfil en los analytics y vaciar el subtítulo del modal de producto.

**Architecture:** Se extrae `RailNav` (genérico, presentacional) de `ProfileSettingsSidebar` a `components/shared`. Perfil, `AnalyticsPanelContent` y `ProductAnalyticsModal` lo consumen; los dos rieles propios de analytics se eliminan.

**Tech Stack:** Next.js 16, React, Tailwind 4 (tokens semánticos), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-analytics-rail-nav-design.md`

## Global Constraints

- Solo tokens semánticos de color; cero `any`; shared components importados por barrel `@/components/shared`.
- Playbook: `docs/30-playbooks/add-shared-component.md` (leer antes de la Task 1; actualizar docs de contrato si aplica).
- Modal de producto: `description` vacío. Inline: riel sin bordes. Modal: `DrawerLayout` con `leftRailWidth="w-14 sm:w-56"`.
- DoD: `npm run type-check`, `npm run lint` y tests afectados en verde (Node 24 vía nvm).

## Review Focus

- Sin `onProductChange` y con `productName`: el nombre aparece en el slot `top` del riel.
- Tab con `badge` numérico 0 / string: se renderiza igual que antes.
- `granularity` sin `onGranularityChange` (o viceversa): no se renderiza el slot `bottom`.
- Ancho móvil (`w-14`): ítems solo con ícono y `aria-label`/`title` con la etiqueta; slots `top`/`bottom` ocultos o compactos.
- Vistas cuyos tests mockean `AnalyticsPanelContent` siguen pasando.

---

### Task 1: Extraer `RailNav`

**Files:**
- Create: `frontend/components/shared/RailNav.tsx`, `frontend/components/shared/__tests__/RailNav.test.tsx`
- Modify: `frontend/components/shared/index.ts` (export), `frontend/features/profile/components/ProfileSettingsSidebar.tsx`

**Interfaces:**
- Produces:
  - `interface RailNavItem { value: string; label: string; icon?: LucideIcon; badge?: number | string }`
  - `interface RailNavSection { label?: string; items: RailNavItem[] }`
  - `interface RailNavProps { sections: RailNavSection[]; value: string; onValueChange: (v: string) => void; ariaLabel: string; top?: ReactNode; bottom?: ReactNode; className?: string }`
  - `export function RailNav(props: RailNavProps)`

- [ ] **Step 1: Tests** en `RailNav.test.tsx`: `renders section labels and items`, `marks active item with aria-current="page"`, `calls onValueChange with item value on click`, `renders badge`, `renders top and bottom slots`.
- [ ] **Step 2:** Ejecutar `npm run test -- components/shared/__tests__/RailNav.test.tsx`; esperado FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `RailNav` moviendo tal cual el markup/clases de `ProfileSettingsSidebar` (nav, `h2` de sección `hidden sm:block`, botón ghost con activo `bg-card shadow-card`, etiqueta `hidden sm:inline`). `top`/`bottom` se renderizan fuera del `nav` scrolleable, con `hidden sm:block`; sección sin `label` omite el `h2`. Badge: `ml-auto` en `text-3xs`, oculto en móvil. Exportar desde el barrel.
- [ ] **Step 4:** Reescribir `ProfileSettingsSidebar` para mapear `navigationSections` a `RailNavSection[]` y delegar en `RailNav` (`ariaLabel="Secciones del perfil"`). Correr tests de `features/profile` y del paso 1; esperado PASS.
- [ ] **Step 5:** Commit `refactor(shared): extrae RailNav del sidebar de perfil`.

### Task 2: `AnalyticsPanelContent` usa `RailNav`

**Files:**
- Modify: `frontend/components/shared/AnalyticsPanel/AnalyticsPanel.tsx`, `frontend/components/shared/AnalyticsPanel/__tests__/` (crear test si no existe)

**Interfaces:**
- Consumes: `RailNav`, `GranularityControl` (props actuales).

- [ ] **Step 1: Test** `AnalyticsPanelContent`: `renders tabs in RailNav and switches content on click`, `renders GranularityControl only when granularity and onGranularityChange are both provided`.
- [ ] **Step 2:** Correr; esperado FAIL en el segundo caso o en estructura.
- [ ] **Step 3:** Reemplazar el `div w-52` de botones por `<RailNav sections={[{ items: tabs }]} ... bottom={granularity slot} ariaLabel={`Secciones de análisis de ${entityName}`} />`, ancho `w-14 sm:w-56`, sin borde (contexto inline). Mantener `AnalyticsTabContent` y `Drawer` intactos.
- [ ] **Step 4:** Correr tests de AnalyticsPanel y de las vistas que lo usan (`features/partners`, `hr`, `sales`, `purchasing`, `treasury`, `inventory`); esperado PASS.
- [ ] **Step 5:** Commit `refactor(analytics): AnalyticsPanelContent reusa RailNav`.

### Task 3: `ProductAnalyticsModal` con `DrawerLayout` + `RailNav`

**Files:**
- Modify: `frontend/features/inventory/components/ProductAnalyticsModal.tsx` (rieles en ~líneas 380-425, shell en ~676-704)
- Test: `frontend/features/inventory/components/__tests__/ProductAnalyticsModal.test.tsx`

**Interfaces:**
- Consumes: `RailNav`, `DrawerLayout` (`leftRail`, `leftRailWidth`, `noPadding`, `contentClassName`).

- [ ] **Step 1: Tests:** `does not render product name as modal description`, `shows ProductSelector in rail top when onProductChange is provided`, `shows product name in rail top when onProductChange is absent` (mockear `useProductInsights`/`useProduct`).
- [ ] **Step 2:** Correr; esperado FAIL.
- [ ] **Step 3:** Quitar `description={productName ?? undefined}`. Reemplazar el `div w-52` por `leftRail={<RailNav sections={[{ items: TABS }]} value={activeTab} onValueChange={...} ariaLabel="Secciones de análisis de producto" top={selectorOrName} />}` dentro de `DrawerLayout` (`leftRailWidth="w-14 sm:w-56"`, `noPadding`); el contenido de tabs queda como hijo con su scroll actual. Ajustar el wrapper `h-[80vh] p-4` para que el riel llegue a los bordes como en el perfil (`BaseModal` `variant="raw"`, `contentClassName="p-0 overflow-hidden"`, header como el perfil).
- [ ] **Step 4:** Verificar en navegador (dev server, ver `remote-dev-server.md`): abrir el análisis desde un producto, cambiar de tab y de producto, ancho móvil. Correr `npm run type-check`, `npm run lint` y tests de `features/inventory`.
- [ ] **Step 5:** Commit `feat(inventory): análisis de producto reusa riel del perfil`.
