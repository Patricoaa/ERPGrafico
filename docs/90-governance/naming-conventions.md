---
layer: 90-governance
doc: naming-conventions
status: active
owner: core-team
last_review: 2026-05-26
stability: contract-changes-require-ADR
preconditions:
  - GOVERNANCE.md
  - component-form-patterns.md
  - component-modal.md
---

# Naming Conventions

Este documento es la fuente de verdad sobre **cómo nombrar** todos los artefactos del proyecto: archivos, componentes, hooks, tipos, constantes, API modules, y carpetas. Complementa GOVERNANCE.md (reglas 5–10), que define la casing básica, con reglas semánticas precisas sobre **sufijos y prefijos**.

> **Regla maestra:** el nombre de un artefacto debe permitir entender su rol y su surface sin abrir el archivo.

---

## 1. Componentes React — Sufijos de Surface UI

### 1.1 Tabla de sufijos autorizados

| Sufijo | Surface renderizada | Scope del componente | Ejemplo |
|---|---|---|---|
| `Drawer` | `<Drawer>` (slide-over lateral) | Auto-contenido: incluye su surface | `EmployeeDrawer`, `TreasuryAccountDrawer` |
| `Modal` | `<BaseModal>` / `<Dialog>` (centrado en pantalla) | Auto-contenido: incluye su surface | `CreditAssignmentModal`, `ExclusionModal` |
| `Sheet` | `<Sheet>` de shadcn (side panel nativo) | Auto-contenido: incluye su surface | `PayrollDetailSheet`, `MappingConfigSheet` |
| `Wizard` | `<GenericWizard>` (flujo multi-paso) | Auto-contenido: incluye su surface | `WorkOrderWizard`, `DeclarationWizard` |
| `ClientView` | `<DataTableView>` — listado maestro de entidad | Stateful, tabla con toolbar, filtros, CRUD | `ProductClientView`, `ContactsClientView` |
| `View` | Sin surface — ocupa su contenedor padre (página o tab) | Stateful, vista que NO es listado de entidad (reporte, dashboard, detalle) | `TrialBalanceView`, `StatementsView` |
| `Form` | **Sin surface** — solo el formulario, el padre decide la surface | Reutilizable dentro de Drawer o Modal | `UoMForm` *(si se reutiliza en dos contextos)* |
| `Step` | Sin surface — slide de un wizard | Siempre hijo de un `Wizard` | `Step1_Items`, `ManufacturingConfigStep` |
| `Sidebar` | Panel lateral fijo / persistente (no slide-over) | Sección de layout | `ActivitySidebar`, `SaleOrderSidebar` |
| `Panel` | Área de contenido destacada, no modal | Sub-sección de pantalla | `ReconciliationPanel`, `OrderHubPanel` |
| `Card` | Tarjeta visual de datos | Presentacional | `PayrollCard`, `DomainCard` |
| `Selector` | Input de selección de entidad | Input especializado | `AccountSelector`, `ProductSelector` |
| `Provider` | React Context Provider | Infraestructura de estado | `RealtimeProvider`, `GlobalModalProvider` |

### 1.2 Reglas de derivación

1. **Si el componente renderiza `<Drawer>` internamente → sufijo `Drawer`.**  
   No importa si tiene "formulario" adentro; el sufijo refleja la surface.

2. **Si el componente renderiza `<BaseModal>` / `<Dialog>` internamente → sufijo `Modal`.**

3. **Si el componente no tiene surface propia (el padre lo monta) → sufijo `Form` o nombre semántico puro.**  
   Usar `Form` cuando el contenido es un formulario editable; nombre sin sufijo cuando es solo lectura o mixto.

4. **`FormModal` y `FormDrawer` están PROHIBIDOS.** Son redundantes:  
   - ~~`EmployeeFormModal`~~ → `EmployeeDrawer` (tiene `<Drawer>` internamente)  
   - ~~`BOMFormModal`~~ → `BOMDrawer`  
   - ~~`AbsenceFormModal`~~ → `AbsenceDrawer`  

5. **El export nombrado debe coincidir con el nombre del archivo.**  
   ```
   // ✅ TerminalDrawer.tsx
   export function TerminalDrawer(...)

   // ❌ TerminalFormModal.tsx
   export function TerminalFormModal(...)  ← contradice la surface real
   ```

6. **Sufijos no apilables.** No usar `SomethingModalDrawer`, `SomethingSheetModal`, etc.

7. **Usar `ClientView` para listados maestros de entidad.**  
   Si el componente es un listado paginado con `<DataTableView>` para CRUD de una entidad → sufijo `ClientView`.  
   Si es un reporte, dashboard, detalle o cualquier vista que NO sea un listado de entidad → sufijo `View`.

8. **`List` no es sufijo autorizado para vistas de página.**  
   Los archivos `*List` deben ser listas reutilizables inline (sub-componentes), no vistas de página.  
   Para vistas de página con tabla, usar `ClientView`.

### 1.3 Árbol de decisión rápida

```
¿El componente monta su propia surface?
├── Sí → ¿Cuál?
│   ├── <Drawer>      → sufijo Drawer
│   ├── <BaseModal>   → sufijo Modal
│   ├── <Sheet>       → sufijo Sheet
│   └── <GenericWizard> → sufijo Wizard
└── No → ¿Es un formulario editable?
    ├── Sí, reutilizable → sufijo Form
    ├── Sí, solo en un contexto → puede incluirse en el mismo Drawer/Modal file
    └── No → nombre semántico sin sufijo de surface (View, Step, Card, Panel...)
```

---

## 2. Archivos y Carpetas

### 2.1 Componentes

| Regla | Ejemplo correcto | Ejemplo incorrecto |
|---|---|---|
| `PascalCase`, extensión `.tsx` | `TreasuryAccountDrawer.tsx` | `treasuryAccountDrawer.tsx` |
| Nombre = export principal | `EmployeeDrawer.tsx` → `export function EmployeeDrawer` | `EmployeeFormModal.tsx` → `export function EmployeeDrawer` |
| Un componente principal por archivo | — | Mezclar `Modal` y `Sheet` en mismo archivo |
| Barrel de feature: `index.ts` | `features/hr/index.ts` | `features/hr/index.tsx` |

### 2.2 Hooks

```
use[Entity][Acción|Calificador].ts
```

| Patrón | Ejemplo | Anti-patrón |
|---|---|---|
| Lista + CRUD de entidad | `useEmployees.ts` | `useGetEmployees.ts` (no incluir verbo HTTP) |
| Mutaciones separadas | `useEmployeeMutations.ts` | — |
| Detalle de una instancia | `useAccountDetail.ts` | `useAccount.ts` (ambiguo con lista) |
| Acción de dominio específica | `useConfirmAction.ts`, `useDraftSync.ts` | — |
| Hook de contexto | `useDeviceContext.ts`, `usePOSContext.ts` | — |

- Siempre `camelCase`, prefijo `use`, extensión `.ts` (no `.tsx` salvo JSX dentro).
- **Nunca kebab-case** (`use-debounce.ts` ❌ → `useDebounce.ts` ✅). Shadcn genera kebab-case por defecto — renombrar al incorporar.
- El hook retorna propiedades con nombre de dominio: `{ employees, isLoading }`, nunca `{ data, loading }`.

### 2.3 Archivos de API

```
[feature]Api.ts   (dentro de features/[feature]/api/)
```

| Regla | Ejemplo |
|---|---|
| Un archivo por feature | `hrApi.ts`, `inventoryApi.ts` |
| `camelCase` con sufijo `Api` | `treasuryApi.ts` |
| Solo llamadas HTTP puras; sin estado | — |

### 2.4 Tipos y Schemas

| Artefacto | Ubicación | Nombre |
|---|---|---|
| Tipos de dominio del feature | `features/[feature]/types.ts` o inline en el hook | `PascalCase`, sin sufijo `Type` ni prefijo `I` |
| Schema Zod de un formulario simple | Junto al componente (inline) o en `features/[feature]/components/forms/schema.ts` | `[entity]Schema` — nunca nombre genérico (`formSchema`, `schema`) |
| Schema Zod de feature compleja (≥3 formularios) | `features/[feature]/schemas/[entity].schema.ts` | `[entity]Schema` |
| Schema Zod compartido entre features | `features/[feature]/api/types.ts` | Igual |

> **Nombre de schema:** siempre prefijado con la entidad. `accountSchema` ✅, `formSchema` ❌, `schema` ❌.

### 2.5 Pasos de Wizard (Steps)

Dos patrones válidos según el contexto:

| Patrón | Cuándo usarlo | Ejemplo |
|---|---|---|
| `Step[N]_Nombre.tsx` | El **orden importa** (checkout flow, onboarding) | `Step1_Items.tsx`, `Step3_Payment.tsx` |
| `NombreStep.tsx` | Pasos **intercambiables o de configuración** (sin orden fijo) | `ManufacturingConfigStep.tsx`, `ImportPreviewStep.tsx` |

- Ambos patrones usan `PascalCase` en el nombre semántico.
- No mezclar los dos patrones dentro del mismo wizard.
- Ubicar en `features/[feature]/components/checkout/` (flujos) o `features/[feature]/components/steps/` (configuración).

### 2.6 Carpetas de features

- Preferir `lowercase-singular` (`finance/`, `inventory/`, `hr/`), pero se permite **plural cuando el dominio es colectivo por naturaleza** (`contacts/`, `sales/`, `orders/`, `settings/`, `users/`).
- La decisión es por dominio, no por conveniencia. No crear carpetas plurales nuevas sin justificación.
- Sub-carpetas internas: `components/`, `hooks/`, `api/`, `types.ts`, `index.ts`.
- No crear sub-feature folders dentro de `components/` salvo complejidad justificada (> 10 archivos relacionados). En ese caso usar carpeta con `index.ts` propio.

---

## 3. Backend (Python / Django)

| Artefacto | Convención | Ejemplo |
|---|---|---|
| Modelos | `PascalCase` singular | `SaleOrder`, `JournalEntry` |
| Serializers | `[Model]Serializer` | `SaleOrderSerializer` |
| Views / ViewSets | `[Model]ViewSet`, `[Model]View` | `SaleOrderViewSet` |
| Services | `[domain]_service.py`, funciones `snake_case` | `sales_service.py` → `def confirm_sale_order(...)` |
| Selectors | `[domain]_selectors.py` | `hr_selectors.py` |
| Tests | `test_[module].py` | `test_views.py`, `test_services.py` |
| URL names | `[app]:[entity]-[action]` | `sales:order-list`, `hr:employee-detail` |
| Migration files | Auto-generados por Django; no renombrar | — |
| Celery tasks | `[verb]_[noun].py` en `tasks.py` | `def send_invoice_email(...)` |

---

## 4. Constantes y Enumeraciones

```typescript
// TypeScript — UPPER_SNAKE_CASE para valores constantes de config
const MAX_UPLOAD_SIZE_MB = 10

// Objetos de constantes agrupadas
const FORM_WIDTHS = { narrow: '40%', standard: '50%' } as const

// Zod enums — strings en UPPER_SNAKE_CASE
const statusSchema = z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED'])

// TS enums — evitar; preferir z.enum o literales de tipo
```

```python
# Python — UPPER_SNAKE_CASE
MAX_DECIMAL_PLACES = 4

class SaleOrderStatus(models.TextChoices):
    DRAFT     = 'DRAFT', 'Borrador'
    CONFIRMED = 'CONFIRMED', 'Confirmado'
```

---

## 5. Tests

| Artefacto | Convención | Ejemplo |
|---|---|---|
| Archivos de test frontend | Co-located, sufijo `.test.tsx` / `.test.ts` | `WorkOrderWizard.test.tsx` |
| Archivos de test backend | Módulo `tests/` dentro de la app Django | `backend/sales/tests/test_views.py` |
| Nombre de test unitario | `test_[qué_hace]_[condición]` | `test_confirm_order_insufficient_stock` |
| Nombre de test E2E | Describe el flujo de usuario | `universal-search-routes.spec.ts` |

---

## 6. Reglas de Deprecación de Nombres

Cuando un componente debe renombrarse (e.g. por cambio de surface):

1. Agregar `@deprecated` JSDoc en el export viejo apuntando al nuevo nombre.
2. Re-exportar desde el barrel con el nombre viejo durante 1 sprint (`export { NuevoNombre as ViejoNombre }`).
3. Migrar todos los consumers en el mismo PR o sprint siguiente.
4. Eliminar el alias en el sprint +2.

```typescript
// ❌ Eliminar inmediatamente
// ✅ Durante la transición
// features/hr/index.ts
export { EmployeeDrawer } from './components/EmployeeDrawer'
/** @deprecated Use EmployeeDrawer */
export { EmployeeDrawer as EmployeeFormModal } from './components/EmployeeDrawer'
```

---

## 7. Violaciones conocidas (histórico — resueltas)

Todas las violaciones documentadas previamente en esta sección han sido resueltas en la auditoría de junio 2026:
- Renombres `*FormModal`/`*Modal` → `*Drawer` (~16 archivos)
- Migraciones `*View`/`*List` → `*ClientView` (`AbsenceManagementView` → `AbsenceClientView`, alias `*List` en inventory eliminados)

Ver `docs/50-audit/architecture-compliance-audit-2026-06.md §4` para el detalle.

---

## 8. Checklist de PR

Antes de abrir un PR que agrega o renombra artefactos:

- [ ] El sufijo del componente coincide con la surface que renderiza.
- [ ] El nombre del archivo coincide con el export principal.
- [ ] Vistas de listado de entidad usan sufijo `ClientView` (no `List`, `Management` ni `View` solos).
- [ ] Hooks siguen el patrón `use[Entity][Calificador]`.
- [ ] Tipos son `PascalCase` sin `I` prefix ni `Type` suffix.
- [ ] No se usó `FormModal` ni `FormDrawer`.
- [ ] Schemas Zod están en `schema.ts`, no inline en el componente.
- [ ] Archivos de test tienen sufijo `.test.ts(x)` y son co-located.
