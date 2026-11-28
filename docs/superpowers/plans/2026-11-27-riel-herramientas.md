# Riel derecho de herramientas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar Buscar, Calculadora, Bandeja y la configuración del módulo del sidebar/título a un riel derecho
de 52 px solo con íconos, con paneles overlay anclados junto al riel; el buscador abre resultados con `openEntity`.

**Architecture:** `ToolRail` vive en `DashboardShell` a la derecha del área de trabajo. Los headers de módulo
publican `settings` vía `HeaderProvider` (como ya publican `navigation`). La calculadora sale del sistema de
pestañas (`GlobalModalProvider`) y pasa a `CollapsibleSheet` overlay de 900 px, igual que la bandeja. Una
variable CSS `--tool-rail-width` desplaza todo panel derecho a pantalla completa para no tapar el riel.

**Tech Stack:** Next.js 16, React, Tailwind 4, Vitest + Testing Library; Django 5 + pytest.

**Spec:** `docs/superpowers/specs/2026-11-27-riel-herramientas-design.md`

## Global Constraints

- Riel: ancho exacto **52 px**; visible desde `md`; orden Buscar · Calculadora · Bandeja · ⚙ del módulo.
- Calculadora: drawer overlay de **900 px** (acotado a `100vw - 52px`), conserva layout de dos columnas.
- Overlays derechos terminan en el borde izquierdo del riel; el riel queda visible y clicable.
- Punto de Venta, Configuración global y Cuenta se quedan en el sidebar.
- Invariantes CLAUDE.md: zero `any`, solo tokens semánticos, imports por barrel, sin `useQuery` en componentes.
- Trabajo en worktree `../ERPGrafico-riel`, rama `feat/riel-herramientas` (el usuario comparte el checkout principal).
- Frontend: comandos con Node 24 (`source ~/.nvm/nvm.sh && nvm use 24`) desde `frontend/`.
- Backend: `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest` desde `backend/`
  (tests `test_search_postgres.py` requieren Postgres: correrlos en el dev server vía `docker compose exec`).

## Review Focus

1. Ctrl+K con un overlay (bandeja/calculadora) abierto: el buscador debe abrir encima y, al elegir un
   resultado, la pestaña de entidad debe quedar visible (cerrar el overlay activo). → test en Task 3.
2. Navegar de Ventas a una página sin header de módulo (p. ej. `/settings`): el ⚙ no debe quedar apuntando al
   modal de Ventas. → test en Task 5.
3. Clic en el ícono activo del riel cierra su panel; clic en otro cambia de panel sin cerrar/abrir doble. → Task 8.
4. Usuario sin permiso de ninguna entidad buscable / resultado cuyo label no tiene drawer en el cliente: no
   romper (no navegar, `openEntity` ya advierte). → contrato backend en Task 2.
5. Viewport angosto (≤ 952 px): la calculadora no debe desbordar ni tapar el riel. → Task 6 (max-width).

---

### Task 1: Arreglo del buscador en la rama

**Files:**
- Modify: `frontend/components/shared/UniversalSearch.tsx`
- Create: `frontend/components/shared/__tests__/UniversalSearch.test.tsx`

El arreglo ya existe sin commitear en el checkout principal (`master`). Copiar ambos archivos tal cual al
worktree (`cp ../ERPGrafico/frontend/components/shared/{UniversalSearch.tsx,__tests__/UniversalSearch.test.tsx} …`).

- [ ] **Step 1:** Copiar los dos archivos al worktree.
- [ ] **Step 2:** `npx vitest run components/shared/__tests__/UniversalSearch.test.tsx` → 2 passed.
- [ ] **Step 3:** Commit `fix(search): el buscador universal no borra lo que se escribe`.

---

### Task 2: Backend — búsqueda sin URLs y solo entidades con drawer

**Files:**
- Modify: `backend/core/registry.py` (dataclass `SearchableEntity`, `search()` ~L195-320)
- Modify: `backend/accounting/apps.py`, `backend/contacts/apps.py`, `backend/treasury/apps.py` (6 registros)
- Modify: `backend/core/tests/test_search_postgres.py:27`
- Modify: `backend/core/tests/test_architectural_invariants.py`

**Interfaces:**
- Produces: respuesta de `/core/search/` con `label, title, title_plural, icon, id, content_type_id, display,
  subtitle, extra_info` (sin `list_url`/`detail_url`).

- [ ] **Step 1: Tests que fallan.** En `test_architectural_invariants.py`, nuevo
  `test_searchable_entities_have_entity_drawer`: parsea claves `"app.model":` de
  `frontend/lib/entity-drawers.tsx` (regex `^\s*"([a-z_]+\.[a-z_]+)"\s*:` multilínea, `pytest.skip` si no existe)
  y afirma que todo `label` con `entity.in_search` está en ese set; mensaje lista los faltantes.
  En `test_search_postgres.py` cambiar L27 a `assert all("detail_url" not in r and "list_url" not in r for r in results)`.
  Agregar test unitario (sin Postgres) `test_in_search_false_excluded`: `UniversalRegistry.get("treasury.creditline").in_search is False`.
- [ ] **Step 2:** Correr el test de invariantes → FAIL (atributo `in_search` inexistente).
- [ ] **Step 3: Implementar.** `SearchableEntity.in_search: bool = True` (al final, con default).
  En `search()`, `allowed_labels` y la rama de búsqueda dirigida filtran `entity.in_search`. Quitar las claves
  `list_url` y `detail_url` de ambos dicts de resultado (~L285-287, ~L318-319); `_canonical_url` queda sin uso
  en search: borrarlo si no tiene otros llamadores (`grep`). Registrar con `in_search=False`:
  `accounting.fiscalyear`, `contacts.partnertransaction`, `treasury.cardpurchasegroup`,
  `treasury.cardpurchaseinstallment`, `treasury.creditline`, `treasury.loaninstallment`.
  No tocar `list_url`/`detail_url_pattern` del dataclass ni `all_entities_serializable()`.
- [ ] **Step 4:** `pytest core/tests/test_architectural_invariants.py -q` → PASS; `ruff check core accounting contacts treasury` limpio.
  `test_search_postgres.py` en el dev server (verificar Mutagen `Connected: Yes` primero).
- [ ] **Step 5:** Commit `feat(search): búsqueda universal sin URLs y limitada a entidades con drawer`.

---

### Task 3: Buscador abre resultados con `openEntity`

**Files:**
- Modify: `frontend/features/search/api/searchApi.ts` (quitar `list_url`, `detail_url` de `SearchResult`)
- Modify: `frontend/components/shared/UniversalSearch.tsx`
- Test: `frontend/components/shared/__tests__/UniversalSearch.test.tsx`

**Interfaces:**
- Consumes: `useGlobalModals().openEntity(label, id, data?, segmenter?, { display })` de
  `@/components/providers/GlobalModalProvider`.

- [ ] **Step 1: Test que falla** `"elegir un resultado abre su registro sin navegar"`: mock de
  `useUniversalSearch` devuelve `[{ label: "sales.saleorder", id: 7, display: "OV-7", title: "Orden", title_plural: "Órdenes", icon: "receipt", content_type_id: 1 }]`;
  mock de `useGlobalModals` con `openEntity = vi.fn()`. Escribir "ov", Enter →
  `expect(openEntity).toHaveBeenCalledWith("sales.saleorder", 7, undefined, undefined, { display: "OV-7" })`,
  `expect(push).not.toHaveBeenCalled()` y el combobox desaparece. Segundo caso: clic en la fila hace lo mismo.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Reemplazar `navigate(url)` por `openResult(result: SearchResult)`: cierra el diálogo y llama
  `openEntity(...)`. Quitar `useRouter`. Actualizar los otros consumidores de `detail_url`/`list_url` si `tsc` los marca.
- [ ] **Step 4:** Tests + `npm run type-check` → PASS.
- [ ] **Step 5:** Commit `feat(search): abrir resultados como pestaña de registro`.

---

### Task 4: Buscador con la UI del sistema

**Files:**
- Modify: `frontend/components/shared/UniversalSearch.tsx`

Leer antes `docs/20-contracts/component-chip.md`, `component-skeleton.md` y `frontend/app/globals.css` (tokens).

- [ ] **Step 1:** Rehacer la presentación conservando roles ARIA (`combobox`, `listbox`, `option`) y teclado:
  - `DialogContent` estándar (sin `backdrop-blur*`, `border-none`, `dark:bg-overlay/95`); overlay por defecto.
  - Filtros por tipo con el componente chip del barrel `@/components/shared` (seleccionable), en lugar de
    `Button` mayúsculas `tracking-widest`.
  - Filas: ícono `DynamicIcon` 16 px sin `Avatar`, `display` + `subtitle` en `text-sm`/`text-xs
    text-muted-foreground`, `title` a la derecha; activa con `bg-accent`; sin barra lateral ni flecha animada.
  - Estado vacío inicial: texto de ayuda simple (sin logo/gradiente/pulse; quitar `useBranding`, `Image`).
  - Carga: skeleton de filas con la misma altura de fila; quitar la barra `animate-pulse` superior.
  - Pie: atajos `↑↓`, `↵`, `Esc` (no `⌘K`).
- [ ] **Step 2:** Tests de Task 1 y 3 siguen en verde; `npx eslint components/shared/UniversalSearch.tsx` sin errores.
- [ ] **Step 3:** Commit `style(search): buscador universal con piezas del sistema`.

---

### Task 5: `settings` del módulo publicado por los headers

**Files:**
- Modify: `frontend/components/providers/HeaderProvider.tsx`
- Modify: `frontend/components/shared/PageHeader.tsx`
- Modify: los 6 `frontend/app/(dashboard)/{sales,accounting,inventory,purchasing,hr,treasury}/*Header.tsx`
- Test: `frontend/components/providers/__tests__/HeaderProvider.test.tsx` (crear si no existe)

**Interfaces:**
- Produces: `export interface ModuleSettingsAction { label: string; open: () => void }`;
  `HeaderConfig.settings?: ModuleSettingsAction`; `PageHeaderProps.settings?: ModuleSettingsAction`;
  `useHeader().moduleSettings: { moduleId: string; settings: ModuleSettingsAction } | null`.

- [ ] **Step 1: Tests que fallan.**
  `"conserva settings del módulo cuando un PageHeader anidado no lo trae"`: `setHeader({title, settings})` en
  `/sales/...`, luego `setHeader({title})` → `moduleSettings.settings.label` sigue.
  `"descarta settings al cambiar de módulo"` (Review Focus 2): con `moduleSettings` de `sales`, publicar
  header con `navigation` desde `/settings` → `moduleSettings` es `null`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** En `setHeader`, mismo cálculo de `moduleId` que `moduleNavigation`: si viene `settings`
  → guardarlo; si viene `navigation` de otro `moduleId` sin `settings` → `null`. `PageHeader` pasa `settings`
  a `setHeader` y lo agrega a deps. En cada header: quitar `titleActions` del ⚙ (e imports `Button`/`Settings`
  sobrantes) y pasar `settings={settingsAction}` con
  `const settingsAction = useMemo(() => ({ label: "Configuración de <Módulo>", open: () => setIsSettingsOpen(true) }), [])`.
  Etiquetas: Ventas, Contabilidad, Inventario, Compras, RRHH, Tesorería (las mismas del `title` actual).
  El modal y `?modal=settings` quedan donde están.
- [ ] **Step 4:** Tests + `npm run type-check` → PASS.
- [ ] **Step 5:** Commit `feat(layout): headers de módulo publican su configuración`.

---

### Task 6: Calculadora como drawer overlay (fuera de pestañas)

**Files:**
- Modify: `frontend/components/providers/GlobalModalProvider.tsx` (quitar `ToolTabId`, tab `type: "tool"`,
  `toolKey`, `openTool`, `hasCalculatorTab`, import de `CostCalculatorDrawer`)
- Modify: `frontend/components/tools/CostCalculatorDrawer.tsx`
- Delete: `frontend/components/layout/QuickActionsMenu.tsx` (sin consumidores)
- Modify: `frontend/components/layout/SidebarQuickActions.tsx` (solo POS)
- Modify: `frontend/components/providers/__tests__/GlobalModalProvider.test.tsx`, `components/layout/__tests__/ModuleSidebarPanel.test.tsx`
- Test: `frontend/components/tools/__tests__/CostCalculatorDrawer.test.tsx`

**Interfaces:**
- Produces: `CostCalculatorDrawer({ open, onOpenChange })` (misma firma) renderizado con `CollapsibleSheet`
  `sheetId="cost-calculator"`, `side="right"`, `fullViewport`, `blockingOverlay`, `registerInStack={false}`,
  `fullWidth={900}`, `className="w-[900px] max-w-[calc(100vw-var(--tool-rail-width,0px))]"`, header
  `PanelHeader` (h-14) como `TaskInboxSidebar`.

- [ ] **Step 1: Tests que fallan.** En `CostCalculatorDrawer.test.tsx` (mocks de `useProducts`,
  `useCategories`, `useVatRate` como en tests existentes): con `open` agregar un producto, rerender `open=false`
  y luego `open=true` → el ítem sigue en el resumen. En `GlobalModalProvider.test.tsx` quitar los casos de
  `openTool` y afirmar que `useGlobalModals()` no expone `openTool` (`expect("openTool" in ctx).toBe(false)`).
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar según Interfaces. El drawer queda montado tras la primera apertura (el montaje
  lo hace `DashboardShell` en Task 8 con `hasOpenedCalculator`); el componente no desmonta su estado al cerrar.
  Borrar `QuickActionsMenu.tsx`; ajustar `ModuleSidebarPanel.test.tsx` (ya no hay fila Calculadora).
- [ ] **Step 4:** Tests afectados + `npm run type-check` → PASS.
- [ ] **Step 5:** Commit `refactor(tools): calculadora de costos como drawer overlay, fuera de pestañas`.

---

### Task 7: Paneles derechos anclados junto al riel

**Files:**
- Modify: `frontend/app/globals.css` (definir `--tool-rail-width`; regla `.inbox-overlay` y overlays bloqueantes)
- Modify: `frontend/components/shared/Drawer.tsx` (~L327, rama `fullViewport` lado derecho)

**Interfaces:**
- Produces: CSS var `--tool-rail-width`: `0px` por defecto, `52px` en `@media (min-width: 768px)` sobre `:root`.

- [ ] **Step 1:** `:root { --tool-rail-width: 0px }` y en `md` `52px`. En `Drawer.tsx`, para `side="right"` con
  `fullViewport`, `right: 0` → `right: "var(--tool-rail-width, 0px)"`. Overlay `.inbox-overlay`:
  `inset: 0` → `inset: 0 var(--tool-rail-width, 0px) 0 0`, `width`/`max-width` →
  `calc(100vw - var(--tool-rail-width, 0px))`. Renombrar la clase a `.rail-overlay` y usarla también en la
  calculadora (`overlayClassName="rail-overlay"`), actualizando `TaskInboxSidebar`.
- [ ] **Step 2:** Verificar en navegador (Task 9) — no hay test unitario útil de CSS; `npm run lint` limpio.
- [ ] **Step 3:** Commit `feat(layout): overlays derechos se anclan junto al riel`.

---

### Task 8: `ToolRail` y cableado en el shell

**Files:**
- Create: `frontend/components/layout/ToolRail.tsx`
- Modify: `frontend/components/layout/DashboardShell.tsx`, `ModuleSidebarPanel.tsx`, `index.ts`
- Delete: `frontend/components/layout/SidebarUtilityNav.tsx` (su lógica de conteo pasa a hook)
- Create: `frontend/features/workflow/hooks/usePendingTasksCount.ts` (+ export en barrel de workflow)
- Test: `frontend/components/layout/__tests__/ToolRail.test.tsx`

**Interfaces:**
- Consumes: `useHeader().moduleSettings` (Task 5), `CostCalculatorDrawer` (Task 6), `UniversalSearch({ renderTrigger })`.
- Produces:
  `type ToolPanel = "calculator" | "inbox"`;
  `ToolRail({ activePanel: ToolPanel | null, onTogglePanel: (p: ToolPanel) => void, onSearchOpen: () => void, pendingTasksCount: number, variant?: "rail" | "row" })`;
  `UniversalSearch` gana props opcionales controladas `open?: boolean`, `onOpenChange?: (o: boolean) => void`,
  `onResultOpen?: () => void` (sin `open` sigue no controlado, como hoy);
  `usePendingTasksCount(): number` (lógica actual de `SidebarUtilityNav`: `getTasks` ×2, polling 120 s,
  refresh en notificación `TASK*`).

- [ ] **Step 1: Tests que fallan** (`ToolRail.test.tsx`, mock de `useHeader`):
  - renderiza botones con `aria-label` "Buscar (Ctrl K)", "Calculadora de Costos", "Bandeja de entrada";
  - sin `moduleSettings` no hay botón de configuración; con él, botón `aria-label` = `settings.label` que llama `open`;
  - clic en "Calculadora" llama `onTogglePanel("calculator")`; con `activePanel="calculator"` el botón tiene
    `aria-pressed="true"`;
  - `pendingTasksCount=120` muestra insignia "99+"; `0` no muestra insignia.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3: Implementar.**
  - `ToolRail` (`variant="rail"`): `aside` `w-[52px] shrink-0 h-full flex flex-col items-center gap-1 py-2
    bg-muted/30`, botones `Button variant="ghost" size="icon"` con `Tooltip side="left"`; `variant="row"`:
    misma botonera en fila horizontal para móvil.
  - `DashboardShell`: reemplazar `isInboxOpen` por `activePanel: ToolPanel | null`;
    `onTogglePanel = p => setActivePanel(cur => cur === p ? null : p)` (abre uno, cierra el otro; clic en el
    activo cierra). Montar `<ToolRail>` como último hijo del contenedor raíz, `hidden md:flex`. Montar
    `CostCalculatorDrawer` cuando `hasOpenedCalculator` (se vuelve `true` al primer abrir) con
    `open={activePanel === "calculator"}`. `TaskInboxSidebar` con `isOpen={activePanel === "inbox"}`.
  - Un solo `UniversalSearch` montado en `DashboardShell`, controlado (`isSearchOpen`), sin trigger propio
    (`renderTrigger={() => null}`); su listener Ctrl+K llama `onOpenChange(!open)`. `ToolRail` (riel y fila
    móvil) llama `onSearchOpen`. Así hay un único listener de Ctrl+K.
  - Review Focus 1: `onResultOpen={() => setActivePanel(null)}` cierra el overlay activo para que la pestaña
    de registro quede visible. Test en `UniversalSearch.test.tsx`: `onResultOpen` se llama al elegir; y en modo
    controlado Ctrl+K llama `onOpenChange(true)`.
  - `ModuleSidebarPanel`: quitar `SidebarUtilityNav`, `isInboxOpen`, `onInboxToggle`; bloque de utilidades
    solo `SidebarQuickActions` (POS). Nueva prop opcional `toolRow?: React.ReactNode` que se pinta arriba del
    bloque de utilidades; el shell la pasa solo en el `Sheet` móvil con `<ToolRail variant="row" …>`.
- [ ] **Step 4:** `npx vitest run components/layout components/shared components/providers` + type-check + lint → PASS.
- [ ] **Step 5:** Commit `feat(layout): riel derecho de herramientas`.

---

### Task 9: Documentación y verificación visual

**Files:**
- Modify: `docs/10-architecture/adr/0162-sidebar-unico-y-modulos-como-primer-nivel.md` (Enmienda: utilidades al riel derecho)
- Modify: `docs/10-architecture/adr/0101-workspace-tab-bar.md` (Enmienda: la calculadora deja de ser pestaña)
- Modify: `docs/20-contracts/module-layout-navigation.md` (riel + `HeaderConfig.settings`)
- Modify: `docs/20-contracts/component-entity-drawers.md:130` (quitar `openTool("cost-calculator")`)

- [ ] **Step 1:** Escribir las enmiendas (fecha 2026-11-27, referencia al spec) y actualizar contratos.
- [ ] **Step 2:** Verificación en navegador en el dev server (Mutagen `Connected: Yes`;
  `http://192.168.1.86:3000`): riel visible a la derecha; calculadora 900 px termina en el riel; bandeja
  idem; cambiar de una a otra desde el riel; ⚙ en Ventas abre su modal y desaparece en `/settings`;
  `?modal=settings` sigue abriendo; Ctrl+K, escribir, Enter abre pestaña de registro; móvil (<768 px) muestra
  la fila en el menú. Capturas a la conversación.
- [ ] **Step 3:** DoD: `npm run type-check`, `npm run lint`, `npm run test` (frontend) y `ruff check` + pytest
  de `core` (backend) en verde.
- [ ] **Step 4:** Commit `docs: riel de herramientas (enmiendas ADR-0162/0101, contratos)`.
