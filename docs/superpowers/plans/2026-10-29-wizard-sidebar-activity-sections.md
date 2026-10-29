# Wizard Sidebar Activity Sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover los dos collapsibles (Aprobación + Historial) del fondo del área central del OT Wizard al panel lateral derecho de información, introduciendo un `CollapsibleSection` compartido y actualizando la estética del historial a la de `ActivitySidebar`.

**Architecture:** Un nuevo componente `CollapsibleSection` (shared) maneja la distribución de altura igualitaria con flex; el `WizardRightSidebar` refactorizado aloja las tres secciones (specs + aprobación + historial) y gana su propio toggle de colapso lateral; `WorkOrderWizard` elimina `StageActivityPanel` del centro y cablea los props de actividad al sidebar. El historial adopta la estética de `ActivitySidebar` (fila marcador-columna + conector punteado + `formatDistanceToNow`).

**Tech Stack:** React, TypeScript, Tailwind v4 (semantic tokens only), lucide-react, date-fns, `@/components/shared`

**Spec:** Esta descripción es la especificación completa; no hay documento externo.

## Global Constraints

- Cero `any` TypeScript — tipos derivados de los tipos existentes de producción.
- Solo semantic color tokens — sin `text-red-500`, `bg-blue-600`, etc.
- `CollapsibleSection` exportado vía barrel `@/components/shared` únicamente.
- El estado de colapso del sidebar derecho persistido en `localStorage` con clave `erpgrafico.production.rightRailCollapsed`.
- El comportamiento de auto-abrir Aprobación cuando existan campos obligatorios (`hasMandatoryFields`) debe conservarse exactamente.
- Los chips de filtro por etapa en el historial se conservan.
- El sidebar derecho se oculta completamente durante el modo de creación (isCreating) — igual que antes.

## Review Focus

- Auto-apertura de Aprobación: cuando `hasMandatoryFields` cambia de false a true al navegar entre etapas, la sección debe abrirse. Cubierto en Task 3 con el `useEffect` que depende de `currentStageId`.
- Distribución de altura: si el único panel expandido es Historial y los demás están colapsados, Historial debe crecer para llenar el sidebar. Verificar que el `flex-1 min-h-0` en CollapsibleSection funciona cuando el padre también tiene `flex-1 min-h-0`.
- Colapso del sidebar con aprobación pendiente: cuando el sidebar está colapsado (`collapsed=true`), los campos de aprobación deben seguir siendo accesibles re-expandiendo el sidebar, no bloqueando el avance. El `WizardStickyFooter` ya maneja la validación; el sidebar solo almacena UI.
- Sidebar en modo creación: `WizardDraftSidebar` no tiene props de actividad — no debe renderizar secciones de aprobación/historial. Task 3 verifica que `isCreating` corta el renderizado de esas secciones.
- Resize del drawer: el sidebar lateral al estar dentro del `Drawer` side=bottom/embedded debe verse en pantallas lg+ (hidden lg:flex ya existente). Verificar que el collapse toggle no rompe el layout en mobile (hidden por `hidden lg:flex`).

---

## Task 1: Componente compartido `CollapsibleSection`

**Files:**
- Create: `frontend/components/shared/CollapsibleSection.tsx`
- Modify: `frontend/components/shared/index.ts` (añadir export)

**Interfaces:**
- Consumes: nada de otras tareas
- Produces: `CollapsibleSection` con props `{ title: string; icon: LucideIcon; badge?: ReactNode; open: boolean; onOpenChange: (v: boolean) => void; children: ReactNode; className?: string }`, exportado vía barrel

**Design:**

El componente renderiza:
1. Un `<button>` header: icono + título + badge opcional + chevron derecho.
2. El `children` en un `<div>` con `flex-1 min-h-0 overflow-hidden` cuando `open=true`; nada cuando `open=false`.

El componente en sí no gestiona estado interno — es totalmente controlado. El padre (WizardRightSidebar) decide cuál sección está abierta y con eso controla la distribución de altura.

La clase del contenedor `children` cuando abierto: `flex-1 min-h-0 flex flex-col overflow-hidden`. El padre del componente debe ser `flex flex-col min-h-0`.

- [ ] **Step 1: Crear `CollapsibleSection.tsx` con la firma exacta**

```tsx
// frontend/components/shared/CollapsibleSection.tsx
"use client"
import { type ReactNode } from "react"
import { type LucideIcon, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CollapsibleSectionProps {
  title: string
  icon: LucideIcon
  badge?: ReactNode
  open: boolean
  onOpenChange: (v: boolean) => void
  children: ReactNode
  className?: string
}

export function CollapsibleSection({ title, icon: Icon, badge, open, onOpenChange, children, className }: CollapsibleSectionProps) { ... }
```

Header: `<button type="button" onClick={() => onOpenChange(!open)} className="flex h-10 w-full shrink-0 items-center gap-2 border-b border-border/60 px-4 text-left hover:bg-muted/40">`. Incluye `Icon` (h-3.5 w-3.5 shrink-0 text-muted-foreground), `<span className="text-2xs font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex-1">{title}</span>`, `{badge}`, y `<ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200", open && "rotate-180")} />`.

Body when open: `<div className={cn("flex flex-1 flex-col min-h-0 overflow-hidden", className)}>{children}</div>`.

- [ ] **Step 2: Exportar desde el barrel**

En `frontend/components/shared/index.ts`, después de `export * from './WizardSummarySidebar';`, añadir:
```ts
export * from './CollapsibleSection';
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend && npm run type-check 2>&1 | tail -20
```
Expected: sin errores nuevos relacionados con CollapsibleSection.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/shared/CollapsibleSection.tsx frontend/components/shared/index.ts
git commit -m "feat(shared): add CollapsibleSection reusable component"
```

---

## Task 2: Refactorizar `WizardRightSidebar` con 3 secciones y toggle de colapso

**Files:**
- Modify: `frontend/features/production/components/WizardRightSidebar.tsx`

**Interfaces:**
- Consumes: `CollapsibleSection` de `@/components/shared` (Task 1)
- Produces: `WizardRightSidebar` con nueva firma extendida (ver abajo). `WizardDraftSidebar` no cambia de firma — no tiene actividad.

**Design:**

La nueva interfaz de `WizardRightSidebarProps`:
```tsx
interface WizardRightSidebarProps {
  order: WorkOrder
  productName: string
  stageData: WorkOrder['stage_data']
  // Actividad (de StageActivityPanel)
  currentStageId?: string
  tasks: WorkOrderTask[]
  allTasks?: WorkOrderTask[]
  stageEntries: WorkOrderHistoryEntry[]
  canComplete: (task: WorkOrderTask) => boolean
  actionable: boolean
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>
  taskConfirmations: Record<string | number, Record<string, boolean>>
  onNoteChange: (taskId: string | number, note: string) => void
  onFileChange: (taskId: string | number, file: File | null) => void
  onConfirmationChange: (taskId: string | number, key: string, value: boolean) => void
  // Colapso del sidebar completo
  collapsed?: boolean
  onToggleCollapse?: () => void
}
```

Layout del sidebar:

```
WizardSummarySidebar (w-72 border-l) 
  │ — toggle de colapso (botón superpuesto sobre el borde izquierdo, igual que el rail izquierdo)
  └── [cuando !collapsed]
       ├── CollapsibleSection: Especificaciones  (open=specsOpen, onOpenChange=setSpecsOpen)
       │    └── ManufacturingSpecsPanel (overflow-y-auto px-4 py-3)
       ├── CollapsibleSection: Aprobación (solo si tasks.length > 0)
       │    └── [contenido migrado de StageActivityPanel — approval form]
       └── CollapsibleSection: Historial
            └── [contenido migrado de StageActivityPanel — history timeline con nueva estética]
```

**Colapso lateral:** cuando `collapsed=true`, el sidebar renderiza solo el botón de toggle (como una franja narrow). Esto sigue el patrón del `WizardProcessSidebar`. La clase: cuando colapsado, `w-8 shrink-0` con solo el botón; cuando expandido, `w-72 flex flex-col`.

**Estética del historial (adoptar ActivitySidebar):**

Cada entrada del historial (HistoryItem) usa:
```tsx
<li key={e.key} className="flex gap-3">
  {/* Columna marcador */}
  <div className="flex w-5 shrink-0 flex-col items-center">
    <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", toneClasses)}>
      <Icon className="h-2.5 w-2.5" />
    </span>
    {!isLast && <span aria-hidden="true" className="w-0 flex-1 border-l border-dashed border-border/60" />}
  </div>
  {/* Contenido */}
  <div className="flex-1 min-w-0 pb-3 space-y-0.5">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-2xs font-semibold text-foreground truncate">{label}</span>
      <time className="shrink-0 text-3xs text-muted-foreground/60">{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: es })}</time>
    </div>
    {e.userName && <p className="text-2xs text-muted-foreground/80">{e.userName}</p>}
    {/* notas, confirmaciones, adjuntos — igual que antes */}
  </div>
</li>
```

`toneClasses` por kind:
- `approved`: `border-success/40 bg-success/10 text-success`
- `reopened`: `border-warning/40 bg-warning/10 text-warning`
- `entered`: `border-border bg-muted text-muted-foreground`
- `edited`: `border-info/40 bg-info/10 text-info`
- `note`: `border-border bg-muted text-muted-foreground`

**Estado inicial de las secciones:**
```tsx
const hasMandatoryFields = pending.some(t => Object.keys(t.requirements ?? {}).length > 0)
const [specsOpen, setSpecsOpen] = useState(true)
const [approvalOpen, setApprovalOpen] = useState(actionable && isPending && hasMandatoryFields)
const [historyOpen, setHistoryOpen] = useState(false)
```

- [ ] **Step 1: Añadir imports necesarios en WizardRightSidebar.tsx**

Añadir al bloque de imports: `CollapsibleSection` de `@/components/shared`; `formatDistanceToNow` y `es` locale de `date-fns`; tipos `WorkOrderTask`, `WorkOrderHistoryEntry` de `../types`; iconos: `ClipboardCheck`, `History`, `Settings2`, `CheckCircle2`, `RotateCcw`, `ArrowRightCircle`, `Pencil`, `StickyNote`, `AlertCircle`, `MessageSquare`, `Paperclip`, `User`, `ChevronLeft`, `ChevronRight`, `StatusBadge`, `EmptyState`, `LabeledInput`, `LabeledCheckbox`, `DocumentAttachmentDropzone` de sus módulos respectivos; `TASK_TYPE_TO_STAGE` de `../lib/stageEvidence`; `getStageMetadata`, `HISTORY_KIND`, `CONFIRMATION_LABELS`, `assignee` extraídas o duplicadas desde `StageActivityPanel.tsx`.

> **Nota de implementación:** Extraer `getStageMetadata`, `HISTORY_KIND`, `CONFIRMATION_LABELS`, el type `HistoryItem` y la función `assignee` a un nuevo archivo `../lib/stageHistory.ts` para evitar duplicación (ambos archivos los necesitarían). Exportar desde ahí e importar en ambos lados.

- [ ] **Step 2: Crear `frontend/features/production/lib/stageHistory.ts`**

Mover desde `StageActivityPanel.tsx` a este archivo:
- type `HistoryItem`
- `HISTORY_KIND`
- `CONFIRMATION_LABELS`
- función `getStageMetadata(stageId: string): { label: string; icon: LucideIcon }`
- función `assignee(t: WorkOrderTask): string | null`
- función `buildHistory(tasksForHistory: WorkOrderTask[], stageEntries: WorkOrderHistoryEntry[]): HistoryItem[]` — extrae la lógica del `useMemo` de history actual

Actualizar `StageActivityPanel.tsx` para importar desde `../lib/stageHistory`.

- [ ] **Step 3: Implementar el nuevo `WizardRightSidebar`**

Reemplazar el componente `WizardRightSidebar` con la nueva implementación. El componente interno `SpecsRail` se elimina y se reemplaza por la estructura descrita arriba.

El wrapper externo cuando `collapsed=true`:
```tsx
<div className="hidden lg:flex border-l w-8 shrink-0 flex-col items-center pt-2">
  <button onClick={onToggleCollapse} className="...">
    <ChevronLeft className="h-4 w-4" />
  </button>
</div>
```

Cuando expandido: `<div className="hidden lg:flex border-l w-72 flex-col h-full overflow-hidden">` con el botón de toggle en la esquina superior izquierda (posición relativa o dentro del header).

Las 3 secciones dentro del `div` principal, cada una usando `CollapsibleSection`. El contenedor de las 3 secciones: `flex flex-col flex-1 min-h-0`.

- [ ] **Step 4: Typecheck**

```bash
cd /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend && npm run type-check 2>&1 | tail -30
```
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/production/components/WizardRightSidebar.tsx frontend/features/production/lib/stageHistory.ts frontend/features/production/components/StageActivityPanel.tsx
git commit -m "feat(production): refactor WizardRightSidebar with 3 CollapsibleSection panels"
```

---

## Task 3: Actualizar `WorkOrderWizard` — eliminar `StageActivityPanel`, cablear props al sidebar

**Files:**
- Modify: `frontend/features/production/components/WorkOrderWizard.tsx`

**Interfaces:**
- Consumes: nueva firma de `WizardRightSidebar` (Task 2)
- Produces: `WorkOrderWizard` actualizado sin `StageActivityPanel` en el centro, con el estado de colapso del sidebar derecho

**Design:**

1. Añadir estado `rightRailCollapsed` con persistencia en `localStorage` (clave `erpgrafico.production.rightRailCollapsed`), siguiendo el mismo patrón que `railCollapsed` para el rail izquierdo.

2. Eliminar el bloque `{!isCreating && order && wizardTab === 'stages' && (<StageActivityPanel .../>)}` del centro.

3. Actualizar la llamada a `WizardRightSidebar`:
```tsx
{order ? (
  <WizardRightSidebar
    order={order}
    productName={productName}
    stageData={stageData}
    currentStageId={currentStageId as string}
    tasks={viewedStageTasks}
    allTasks={order.workflow_tasks}
    stageEntries={allStageHistory}
    canComplete={canUserCompleteTask}
    actionable={isViewingCurrentStage && !isTerminalOrder}
    taskNotes={taskNotes}
    taskFiles={taskFiles}
    taskConfirmations={taskConfirmations}
    onNoteChange={setTaskNote}
    onFileChange={setTaskFile}
    onConfirmationChange={setTaskConfirmation}
    collapsed={rightRailCollapsed}
    onToggleCollapse={toggleRightRail}
  />
) : currentStageId === 'MFG_CONFIG' ? (
  <WizardDraftSidebar />
) : null}
```

4. `toggleRightRail`: igual que `toggleRail` pero para `rightRailCollapsed`.

5. Actualizar el shortcut de teclado — añadir `Alt+I` para colapsar/expandir el sidebar de información (para simetría con `Alt+B` para el rail izquierdo).

6. Actualizar el cheatsheet modal — añadir la línea `{ keys: ['Alt', 'I'], desc: 'Colapsar/expandir panel de información' }`.

7. Eliminar el import de `StageActivityPanel` si ya no se usa.

- [ ] **Step 1: Añadir estado `rightRailCollapsed` con persistencia**

Copiar el patrón de `railCollapsed`: estado useState + useEffect para restaurar desde localStorage + función `toggleRightRail` + clave de storage `'erpgrafico.production.rightRailCollapsed'`.

- [ ] **Step 2: Reemplazar `WizardRightSidebar` call y eliminar `StageActivityPanel`**

Ver interfaz en Design arriba.

- [ ] **Step 3: Añadir shortcut Alt+I y actualizar cheatsheet**

En el `handleKeyDown`, después del bloque de `Alt+B`:
```ts
if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'i') {
  e.preventDefault()
  toggleRightRail()
  return
}
```

- [ ] **Step 4: Typecheck y lint**

```bash
cd /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend && npm run type-check 2>&1 | tail -30
cd /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend && npm run lint 2>&1 | tail -20
```
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/production/components/WorkOrderWizard.tsx
git commit -m "feat(production): wire activity sections to right sidebar, remove StageActivityPanel from center"
```

---

## Task 4: Tests y verificación final

**Files:**
- Modify: `frontend/features/production/components/__tests__/WorkOrderWizard.test.tsx` (si los tests existentes fallan)
- Modify: `frontend/features/production/components/__tests__/WorkOrderWizardFlow.test.tsx` (si los tests existentes fallan)

**Interfaces:**
- Consumes: todo lo de las tareas anteriores

- [ ] **Step 1: Ejecutar los tests existentes**

```bash
cd /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend && npm run test -- features/production/components/__tests__/WorkOrderWizard.test.tsx 2>&1 | tail -40
```
Expected: todos pasan. Si alguno falla por referencias a `StageActivityPanel`, actualizar el test.

- [ ] **Step 2: Ejecutar typecheck final**

```bash
cd /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend && npm run type-check 2>&1 | tail -20
```
Expected: `0 errors`.

- [ ] **Step 3: Ejecutar lint final**

```bash
cd /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend && npm run lint 2>&1 | tail -20
```
Expected: sin errores.

- [ ] **Step 4: Commit final si hay ajustes de tests**

```bash
git add -p  # solo los archivos de tests
git commit -m "test(production): update wizard tests after sidebar activity refactor"
```
