# Auditoría de Componentes — ERP Frontend

> **Fecha**: 2026-03-31  
> **Proyecto**: ERPGrafico Frontend  
> **Stack**: Next.js 15 + TypeScript + shadcn/ui + Tailwind CSS  
> **Total de componentes**: ~368 archivos `.tsx/.ts`

---

## FASE 1 — Inventario

📄 El inventario completo está disponible en [`docs/component-inventory.md`](file:///c:/Users/patox/Nextcloud/Pato/Aplicaciones/ERPGrafico/docs/component-inventory.md)

### Distribución por clasificación

| Clasificación | Cantidad | % |
|--------------|----------|---|
| Primitivos (shadcn/ui) | 31 | 8.4% |
| Compuestos reutilizables | 74 | 20.1% |
| Específicos de módulo | 263 | 71.5% |
| **Total** | **368** | 100% |

### Distribución por ubicación

| Ubicación | Archivos | Tiene barrel |
|-----------|----------|-------------|
| `components/ui/` | 45 | ❌ |
| `components/shared/` | 21 | ✅ |
| `components/forms/` | 28 | ✅ |
| `components/selectors/` | 10 | ✅ |
| `components/layout/` | 6 | ✅ |
| `components/auth/` | 3 | ✅ |
| `components/providers/` | 3 | ✅ |
| `components/tools/` | 2 | ✅ |
| `components/` (raíz) | 1 | ❌ |
| `features/*/components/` | ~214 | Parcial |
| `app/*/components/` | ~23 | ❌ |
| `hooks/` (globales) | 13 | ❌ |

---

## FASE 2 — Detección de Problemas

### 2.1 Duplicación

| # | Componente afectado | Tipo | Severidad | Descripción |
|---|-------------------|------|-----------|-------------|
| D1 | `FacetedFilter` vs `DataTableFacetedFilter` | Duplicación funcional | 🔴 Alto | `components/shared/FacetedFilter.tsx` es prácticamente una copia de `components/ui/data-table-faceted-filter.tsx`. Misma estructura, mismos estilos, misma lógica. La versión en shared es standalone (sin tabla), la de ui está acoplada a `@tanstack/react-table`. Deberían unificarse. |
| D2 | `useStockValidation` × 2 | Duplicación de hook | 🔴 Alto | Existe en `hooks/useStockValidation.ts` **y** en `app/pos/hooks/useStockValidation.ts`. Dos implementaciones del mismo concepto. |
| D3 | `useProducts` × 2 | Duplicación de hook | 🟡 Medio | `features/inventory/hooks/useProducts.ts` y `app/pos/hooks/useProducts.ts`. Hook con mismo nombre pero posiblemente API distinta (POS vs inventario). Genera confusión. |
| D4 | `useTreasuryAccounts` × 2 | Duplicación de hook | 🟡 Medio | `hooks/useTreasuryAccounts.ts` y `features/treasury/hooks/useTreasuryAccounts.ts`. Misma funcionalidad, dos ubicaciones. |
| D5 | `useAccountingAccounts` | Duplicación probable | 🟡 Medio | `hooks/useAccountingAccounts.ts` probablemente duplica lógica de `features/accounting/hooks/useAccounts.ts`. |
| D6 | `PageTabs` vs `ServerPageTabs` | Variante innecesaria | 🟢 Bajo | Podrían ser un solo componente con prop `server?: boolean`. |
| D7 | `OrderHubStatus` | Archivo fantasma | 🟡 Medio | Existe en `app/(dashboard)/sales/orders/components/OrderHubStatus.tsx` **y** en `features/orders/components/OrderHubStatus.tsx`. |

### 2.2 Inconsistencia de UI/UX

| # | Componente | Tipo | Severidad | Descripción |
|---|-----------|------|-----------|-------------|
| U1 | Múltiples componentes | Colores hardcoded | 🔴 Alto | Uso masivo de `text-emerald-600`, `bg-blue-50`, `text-amber-700`, `bg-red-100` en lugar de tokens semánticos de Tailwind (`text-success`, `text-warning`, `text-destructive`). Encontrado en: `TransactionViewModal`, `PaymentHistorySection`, `RelatedDocumentsSection`, `ActionConfirmModal`, `numpad.tsx`, `ProductSelector`, `CostCalculatorModal` (+50 instancias). |
| U2 | `PaymentForm.tsx` L225 | Color hardcoded | 🟡 Medio | `className="bg-white"` en lugar de `bg-background`. Rompe dark mode. |
| U3 | `PaymentForm.tsx` L293 | Color hardcoded | 🟡 Medio | `className="border-blue-200 bg-blue-50/30"` arbtrario sin token. |
| U4 | `FORM_STYLES` | Adopción parcial | 🟡 Medio | El style guide en `STYLE_GUIDE.md` define `FORM_STYLES` pero solo ~40% de los formularios lo usan. `PaymentForm` mezcla `FORM_STYLES.label` con labels inline. |
| U5 | Formularios | Sin estados obligatorios | 🔴 Alto | La mayoría de formularios carecen de estados `loading`, `empty`, `error` coherentes. Solo `DataTable` implementa skeleton loading correctamente. Formularios grandes como `ProductForm` (49KB), `WorkOrderForm` (66KB) no tienen skeleton/shimmer. |
| U6 | Selectores | Sin estado empty | 🟡 Medio | `AccountSelector`, `ProductSelector`, etc. no muestran estado visual cuando no hay datos disponibles (sin "empty state" o placeholder informativo). |
| U7 | `numpad.tsx` | Colores inline | 🟡 Medio | Botones con colores red/amber/emerald hardcoded en lugar de variantes de botón. |

### 2.3 Problemas de Arquitectura Next.js

| # | Componente | Tipo | Severidad | Descripción |
|---|-----------|------|-----------|-------------|
| N1 | `ServerPageTabs.tsx` | Server Component correcto | ✅ | Única instancia detectada de Server Component intencional. |
| N2 | Todo `components/ui/` | `"use client"` masivo | 🟢 Bajo | shadcn primitivos requieren "use client" por diseño — correcto. |
| N3 | `app/pos/` | Módulo entero en `app/` | 🔴 Crítico | 8 componentes, 4 hooks, 1 contexto viven dentro de `app/pos/` directamente. Todo el módulo POS (cart, productos, sesiones) debería estar en `features/pos/` y solo las páginas en `app/pos/`. |
| N4 | `app/(dashboard)/treasury/reconciliation/` | Componentes en ruta | 🔴 Alto | 5 componentes de negocio (`ReconciliationDashboard.tsx`, `ReconciliationRules.tsx`, `StatementsList.tsx`, `DashboardKPIs.tsx`, `SimulationResults.tsx`) viven directamente en la ruta de la app en lugar de `features/treasury/`. |
| N5 | `app/(dashboard)/sales/orders/components/` | Componente en ruta | 🟡 Medio | `OrderHubStatus.tsx` vive en la ruta de app. |
| N6 | `app/(dashboard)/purchasing/orders/components/` | Componente en ruta | 🟡 Medio | `PurchasingOrdersClientView.tsx` vive en la ruta de app. |
| N7 | Path aliases | Mezcla de convenciones | 🟡 Medio | Existe `@/*` **y** `~components`, `~features`, etc. La mayoría del código usa `@/`, los aliases `~` están definidos pero casi sin uso. Genera confusión. |

### 2.4 Acoplamiento Incorrecto

| # | Componente | Tipo | Severidad | Descripción |
|---|-----------|------|-----------|-------------|
| A1 | **30+ archivos en `/components`** | Importan `@/lib/api` | 🔴 Crítico | Todos los formularios (`forms/`), todos los selectores (`selectors/`), y varios shared components importan directamente el módulo HTTP `api`. Esto acopla componentes de presentación con la capa de datos. |
| A2 | `TransactionViewModal.tsx` | Importa features + api | 🔴 Crítico | Importa `@/features/audit/components/ActivitySidebar`, `@/lib/api`, `@/components/forms/PaymentForm`. Componente de 756 líneas que es un "God Component" mezcla presentación, fetching, navegación. |
| A3 | `AdvancedContactSelector.tsx` | Importa features | 🟡 Medio | Importa `@/features/contacts/components/ContactModal`. Selector en shared depende de feature module. |
| A4 | `CostCalculatorModal.tsx` | Importa features | 🟡 Medio | Importa `@/features/inventory/api/inventoryApi`. Componente en tools depende de feature module. |
| A5 | `PrintableReceipt.tsx` | Importa features | 🟡 Medio | Importa `@/features/settings`. Componente shared depende de feature. |
| A6 | `TaskInboxSidebar.tsx` | Importa features | 🟡 Medio | Importa `@/features/workflow/components/TaskInbox`. Layout depende de feature. |
| A7 | `ProductBasicInfo.tsx` | Importa features | 🟡 Medio | Importa `@/features/inventory/components/BarcodeDialog`. Form sub-component depende de feature. |
| A8 | `ProductManufacturingTab.tsx` | Importa features | 🟡 Medio | Importa `@/features/production/components/BOMManager`. |
| A9 | 6+ formularios | Importan ActivitySidebar | 🟡 Medio | `AccountForm`, `CategoryForm`, `JournalEntryForm`, `ProductForm`, `UserForm`, `WarehouseForm`, `PricingRuleForm`, `BankJournalForm` todos importan `ActivitySidebar` de `features/audit`. |

### 2.5 Tipado Débil

| # | Componente | Tipo | Severidad | Descripción |
|---|-----------|------|-----------|-------------|
| T1 | **Todos los formularios** | `initialData?: any` | 🔴 Crítico | Patrón sistémico: `BankJournalForm`, `JournalEntryForm`, `PaymentForm`, `PurchaseOrderForm`, `ProductForm` etc. usan `initialData?: any`. No hay interfaces tipadas para los datos de entrada. |
| T2 | `ProductSelector.tsx` | `any` masivo | 🔴 Alto | 17 usos de `any` en un solo archivo. Props `onSelect`, `customFilter`, `customDisabled` todas con `any`. Handlers internos como `handleSelect(product: any)`. |
| T3 | `PaymentForm.tsx` L72-73 | State sin tipo | 🟡 Medio | `useState<any[]>([])` para `orders` y `availableMethods`. |
| T4 | `VariantQuickEditForm.tsx` | Props `any` | 🔴 Alto | `variant: any`, `onSaved: (updatedVariant: any) => void` — sin tipo alguno. |
| T5 | `ProductVariantsTab.tsx` | 15+ usos de `any` | 🔴 Alto | Callbacks, mapeos, filtros, todo con `any`. |
| T6 | `TreasuryAccountsView.tsx` | Column defs sin tipo | 🟡 Medio | 12 usos de `{ column: any }`, `{ row: any }` en definiciones de columnas de tabla. |
| T7 | `TerminalBatchesManagement.tsx` | Column defs sin tipo | 🟡 Medio | Mismo patrón que T6. |
| T8 | `WorkflowSettings.tsx` | Handlers con `any` | 🟡 Medio | `handleUpdateRule(taskType: string, value: any, ...)`. |
| T9 | `catch (error: any)` | Patrón sistémico | 🟡 Medio | ~20+ archivos capturan errores como `any` en lugar de usar un pattern de error tipado. |
| T10 | `[key: string]: unknown` | TransactionData | 🟡 Medio | Interface `TransactionData` usa catch-all `[key: string]: unknown` que debilita todo el tipado. |

### 2.6 Naming y Convenciones

| # | Componente | Tipo | Severidad | Descripción |
|---|-----------|------|-----------|-------------|
| C1 | `IndustrialCard.tsx`, `LoadingFallback.tsx`, `MoneyDisplay.tsx` | PascalCase en `/ui` | 🟡 Medio | 3 archivos en `components/ui/` usan PascalCase mientras los 42 restantes usan kebab-case. Rompe la convención de shadcn. |
| C2 | `app-sidebar.tsx` | Archivo suelto | 🟡 Medio | Único archivo componente en raíz de `components/`. Debería estar en `layout/`. |
| C3 | `BlacklistView.tsx`, `CreditPortfolioView.tsx` | Fuera de `components/` | 🟡 Medio | En `features/credits/` directamente, no en `features/credits/components/`. Rompe convención del resto de módulos. |
| C4 | `LoadingFallback.tsx` | Doble export | 🟢 Bajo | `export const LoadingFallback` + `export default LoadingFallback`. Mezcla named y default export. |
| C5 | `TransactionViewModal.tsx` | Doble export | 🟢 Bajo | `export function TransactionViewModal` + `export default TransactionViewModal`. |
| C6 | Checkout steps | Naming inconsistente | 🟡 Medio | Sales: `Step0_Customer`, `Step1_DTE`, `Step2_Payment`. Purchasing: `Step0_Supplier`, `Step1_ProductSelection`. Billing: `Step1_Items`, `Step2_Logistics`. Convención `Step{N}_{Name}` varía entre módulos. |
| C7 | `ui/STYLE_GUIDE.md` | Doc dentro de UI | 🟢 Bajo | Documentación del style guide está dentro de `components/ui/` — debería estar en `docs/`. |

### 2.7 Consistencia de uso transversal (Component Governance)

Módulos auditados: **Dashboard**, **Ventas**, **Compras**, **Inventario**, **Contabilidad**, **Facturación**, **Tesorería**, **Producción**, **RRHH**, **POS**, **Créditos**, **Finanzas**, **Impuestos**, **Contactos**, **Configuración**, **Perfil**, **Workflow**.

---

#### Patrón: Tablas de Datos

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ✅ Sí | `DataTable` | Via features que renderea |
| Ventas | ✅ Sí | `DataTable` + `DataTableColumnHeader` | `SalesOrdersView`, `POSSessionsView` |
| Compras | ⚠️ Parcial | `DataTable` + ad-hoc `<table>` | `PurchasingOrdersClientView` mezcla DataTable con tablas HTML ad-hoc para custom views |
| Inventario | ✅ Sí | `DataTable` + `DataTableColumnHeader` | 8 vistas lo usan: `ProductList`, `CategoryList`, `MovementList`, `WarehouseList`, `UoMList`, `StockReport`, `PricingRuleList`, `AttributeManager` |
| Contabilidad | ✅ Sí | `DataTable` | `AccountsClientView` |
| Facturación | ⚠️ Parcial | `DataTable` + ad-hoc cards | `SalesInvoicesClientView` usa DataTable pero billing purchases usa renderizado custom parcial |
| Tesorería | ✅ Sí | `DataTable` | 4 vistas: `TreasuryAccountsView`, `TreasuryMovementsClientView`, `MasterDataManagement`, `TerminalBatchesManagement` |
| Producción | ❌ No usa DataTable | Kanban ad-hoc | `WorkOrderKanban` usa cards propias, no DataTable |
| RRHH | ⚠️ Parcial | `DataTable` + ad-hoc forms | Payrolls usa DataTable; absences/advances usan formas inline en page.tsx |
| POS | ❌ No aplica | `ProductGrid` custom | POS tiene su propio grid; correcto por requerimientos de UX táctil |
| Créditos | ✅ Sí | `DataTable` | `BlacklistView`, `CreditPortfolioView` |
| Finanzas | ✅ Sí | `DataTable` | `BudgetsListView` |
| Impuestos | ⚠️ Parcial | Ad-hoc cards + `DataTable` inline | `DeclarationWizard` tiene tablas propias |
| Contactos | ✅ Sí | `DataTable` | `ContactsClientView` |
| Configuración | ✅ Sí | `DataTable` | `UsersSettingsView`, `GroupManagement`, `PartnerSettingsTab` |
| Perfil | ✅ Sí | `DataTable` | `ProfileView`, `PartnerProfileTab` |
| Workflow | ❌ No usa DataTable | Cards ad-hoc | `TaskInbox` usa tarjetas propias; apropiado por diseño |

- **Consistencia global:** 🟢 **Alta** — 13/17 módulos usan `DataTable`. Las excepciones (POS, Producción, Workflow) están justificadas por UX.
- **Recomendación:** ✅ Ya existe, enforcar su uso. Verificar `PurchasingOrdersClientView` y `DeclarationWizard` para migrar tablas ad-hoc residuales.

---

#### Patrón: Page Header

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ❌ No | Ad-hoc | Dashboard principal usa layout propio sin PageHeader |
| Ventas | ✅ Sí | `PageHeader` | `SalesOrdersClientView`, `POSSessionsView`, `SalesTerminalsView` |
| Compras | ✅ Sí | `PageHeader` | `PurchasingOrdersClientView`, `app/purchasing/page.tsx` |
| Inventario | ✅ Sí | `PageHeader` + `PageHeaderButton` | `app/inventory/page.tsx`, `UoMsView`, `AttributeManager`, productos, stock |
| Contabilidad | ✅ Sí | `PageHeader` | Entries page, accounts page, periods page |
| Facturación | ✅ Sí | `PageHeader` | `SalesInvoicesClientView`, purchases billing page |
| Tesorería | ✅ Sí | `PageHeader` + `PageHeaderButton` | `TreasuryAccountsView`, `TreasuryMovementsClientView`, reconciliation |
| Producción | ✅ Sí | `PageHeader` | Orders, BOMs pages |
| RRHH | ✅ Sí | `PageHeader` + `PageHeaderButton` | Employees, payrolls, absences, advances |
| POS | ❌ No | Ad-hoc | POS tiene `POSCheckoutHeader` propio; correcto por UX de terminal |
| Créditos | ✅ Sí | `PageHeader` + `PageHeaderButton` | `BlacklistView`, `CreditPortfolioView` |
| Finanzas | ✅ Sí | `PageHeader` + `PageHeaderButton` | `BudgetsListView`, `BudgetDetailView` |
| Impuestos | ✅ Sí | `PageHeader` + `PageHeaderButton` | Declarations page |
| Contactos | ✅ Sí | `PageHeader` + `PageHeaderButton` | `ContactsClientView` |
| Configuración | ✅ Sí | `PageHeader` | 10+ vistas de settings, todas usan PageHeader |
| Perfil | ✅ Sí | `PageHeader` | `ProfileView` |
| Workflow | ✅ Sí | `PageHeader` | `WorkflowSettings` |

- **Consistencia global:** 🟢 **Alta** — 15/17 módulos (50+ importaciones). Solo Dashboard y POS no lo usan por razones legítimas de UX.
- **Recomendación:** ✅ Ya existe, enforcar su uso. Excelente adopción.

---

#### Patrón: Formularios (altas, ediciones, filtros)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ❌ No aplica | — | Dashboard no tiene formularios de alta |
| Ventas | ✅ Sí | `react-hook-form` + `zod` + `Form` (shadcn) | `SaleOrderForm.tsx` usa el stack completo |
| Compras | ✅ Sí | `react-hook-form` + `zod` + `Form` | `PurchaseOrderForm.tsx` |
| Inventario | ✅ Sí | `react-hook-form` + `zod` + `Form` | `ProductForm`, `CategoryForm`, `AdjustmentForm` |
| Contabilidad | ✅ Sí | `react-hook-form` + `zod` + `Form` | `AccountForm`, `JournalEntryForm` |
| Facturación | ⚠️ Parcial | Mixed | Checkout wizards usan `react-hook-form`; nota wizards usan state manual |
| Tesorería | ✅ Sí | `react-hook-form` + `zod` + `Form` | `PaymentForm`, `BankJournalForm`, `TransferModal` |
| Producción | ✅ Sí | `react-hook-form` + `zod` + `Form` | `WorkOrderForm`, `BOMFormDialog` |
| RRHH | ⚠️ Parcial | `react-hook-form` en pages | Formularios inline en `page.tsx` (sin BaseModal), `PayrollDetailContent` en features |
| POS | ❌ No aplica | — | POS no tiene formularios de alta clásicos; usa interfaz táctil |
| Créditos | ✅ Sí | `react-hook-form` + `zod` | `CreditAssignmentModal` |
| Finanzas | ✅ Sí | `react-hook-form` | `BudgetEditor` |
| Impuestos | ⚠️ Parcial | `react-hook-form` en pages | Settings page usa RHF; wizards son multi-step ad-hoc |
| Contactos | ⚠️ Parcial | `react-hook-form` en modal | `ContactModal` usa RHF pero forms inline parciales |
| Configuración | ✅ Sí | `react-hook-form` masivo | 8+ vistas de settings usan `useForm` directo |
| Perfil | ✅ Sí | `react-hook-form` | `ProfileView` |
| Workflow | ⚠️ Parcial | Mixed | `WorkflowSettings` tiene inline state management para reglas |

- **Consistencia global:** 🟡 **Media** — Todos usan `react-hook-form` como base, pero con variaciones: algunos usan `Form` de shadcn + `zod`, otros usan `useForm` raw sin `Form` component. `FORM_STYLES` se usa solo en ~40% de formularios.
- **Recomendación:** 🔄 Refactorizar y unificar. Estandarizar: (1) siempre usar `<Form>` wrapper de shadcn, (2) siempre usar `FORM_STYLES`, (3) formularios dentro de `BaseModal` obligatorio para altas/ediciones.

---

#### Patrón: Botones de acción (guardar, cancelar, eliminar)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ❌ No aplica | — | |
| Ventas | ✅ Sí | `Button` (shadcn) | Variantes `default`, `ghost`, `destructive` |
| Compras | ✅ Sí | `Button` (shadcn) | Consistente con ventas |
| Inventario | ✅ Sí | `Button` (shadcn) | |
| Contabilidad | ✅ Sí | `Button` (shadcn) | |
| Facturación | ✅ Sí | `Button` (shadcn) | |
| Tesorería | ✅ Sí | `Button` (shadcn) | |
| Producción | ✅ Sí | `Button` (shadcn) | |
| RRHH | ✅ Sí | `Button` (shadcn) | |
| POS | ⚠️ Parcial | `Button` + botones ad-hoc | POS tiene botones con estilos inline especiales (numpad, checkout) |
| Créditos | ✅ Sí | `Button` (shadcn) | |
| Finanzas | ✅ Sí | `Button` (shadcn) | |
| Impuestos | ✅ Sí | `Button` (shadcn) | |
| Contactos | ✅ Sí | `Button` (shadcn) | |
| Configuración | ✅ Sí | `Button` (shadcn) | |
| Perfil | ✅ Sí | `Button` (shadcn) | |
| Workflow | ✅ Sí | `Button` (shadcn) | |

- **Consistencia global:** 🟢 **Alta** — Uso universal de `Button` de shadcn. POS es la excepción justificada.
- **Recomendación:** ✅ Ya existe, enforcar su uso. Considerar crear variantes formales para acciones comunes (`SaveButton`, `CancelButton`) si se detectan inconsistencias en labels.

---

#### Patrón: Estados vacíos (listas sin datos)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ❌ No | — | Dashboard no muestra empty states |
| Ventas | ⚠️ Parcial | `DataTable` built-in + ad-hoc | `SalesOrdersView` tiene su propio empty state con ícono custom; no usa un componente reutilizable |
| Compras | ⚠️ Parcial | `DataTable` built-in + ad-hoc | `PurchasingOrdersClientView` tiene empty state personalizado inline |
| Inventario | ✅ Built-in | `DataTable` default empty | Depende del "No se encontraron resultados" de DataTable |
| Contabilidad | ✅ Built-in | `DataTable` default empty | |
| Facturación | ⚠️ Parcial | `DataTable` + ad-hoc | `SalesInvoicesClientView` tiene empty state custom con ícono |
| Tesorería | ⚠️ Parcial | Mixed | `TerminalBatchForm` tiene "No se encontraron ventas" inline; `ReconciliationPanel` tiene "No se encontraron pagos" inline |
| Producción | ⚠️ Parcial | `PhaseCard` `emptyMessage` | Usa prop `emptyMessage` en `PhaseCard` — buen patrón local |
| RRHH | ❌ No | Ad-hoc | Sin empty state visible |
| POS | ⚠️ Parcial | Ad-hoc | `ProductGrid` y `Cart` tienen mensajes inline "No se encontraron productos" |
| Créditos | ⚠️ Parcial | `DataTable` + ad-hoc | `BlacklistView` tiene "No se encontraron clientes bloqueados" inline |
| Finanzas | ⚠️ Parcial | Ad-hoc `<div>` | `RatiosView`, `BIAnalyticsView` usan `<div>No hay datos disponibles</div>` sin estructura |
| Impuestos | ⚠️ Parcial | Ad-hoc | Declarations tiene empty state inline |
| Contactos | ⚠️ Parcial | Ad-hoc | Selectores muestran "No se encontraron contactos" |
| Configuración | ✅ Built-in | `DataTable` default empty | |
| Perfil | ✅ Built-in | `DataTable` default empty | |
| Workflow | ⚠️ Parcial | Ad-hoc `animate-pulse` divs | TaskInbox tiene divs de placeholder animados |

- **Consistencia global:** 🔴 **Baja** — No existe un componente `EmptyState` compartido. Cada módulo implementa su propio "no hay datos" con estilos ad-hoc. `DataTable` tiene uno built-in pero es texto plano sin ícono ni call-to-action. Hay ~30+ implementaciones ad-hoc dispersas.
- **Recomendación:** 🆕 Crear desde cero. Un componente `<EmptyState icon={...} title="..." description="..." action={<Button>...}/>` que estandarice la experiencia vacía.

---

#### Patrón: Estados de carga (skeletons, spinners)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ⚠️ Parcial | `loading.tsx` Next.js | Usa loading.tsx de ruta |
| Ventas | ⚠️ Parcial | `LoadingFallback` + `Loader2` ad-hoc | `SalesOrdersView` usa `Loader2` inline |
| Compras | ⚠️ Parcial | `Loader2` ad-hoc | Spinners inline sin componente compartido |
| Inventario | ⚠️ Parcial | `Loader2` + `DataTable isLoading` | DataTable tiene skeleton built-in; selectores usan `Loader2` inline |
| Contabilidad | ⚠️ Parcial | `DataTable isLoading` | Solo en tabla |
| Facturación | ⚠️ Parcial | Ad-hoc `animate-pulse` | `NoteCheckoutWizard` tiene "Cargando..." con animate-pulse |
| Tesorería | ⚠️ Parcial | Mixed | `PaymentMethodSelector` usa `<div animate-pulse>`; `ReconciliationPanel` tiene spinner custom |
| Producción | ⚠️ Parcial | Ad-hoc `animate-pulse` | `WorkOrderWizard`, `WizardProcessSidebar` usan puntos pulsantes |
| RRHH | ❌ No | — | Sin loading states visibles |
| POS | ⚠️ Parcial | `ProductGridSkeleton` custom + `Loader2` | POS tiene su propio skeleton; `SalesOrdersModal` usa `animate-pulse` |
| Créditos | ✅ Sí | `Skeleton` (shadcn) | `CreditPortfolioView` y `BlacklistView` usan `<Skeleton>` correctamente |
| Finanzas | ❌ No | Ad-hoc `animate-pulse` text | `StatementsView`, `RatiosView` usan `<div animate-pulse>Cargando...</div>` |
| Impuestos | ❌ No | — | Sin loading state visible |
| Contactos | ⚠️ Parcial | `Loader2` inline | En selectores |
| Configuración | ⚠️ Parcial | `Skeleton` + `CloudUpload animate-pulse` | Partners tabs usan `<Skeleton>` bien; otros settings usan ícono pulsante |
| Perfil | ⚠️ Parcial | `DataTable isLoading` | Solo en tabla |
| Workflow | ⚠️ Parcial | Ad-hoc `animate-pulse` divs | `TaskInbox` tiene skeletons manuales `<div className="animate-pulse">` |

- **Consistencia global:** 🔴 **Baja** — El `LoadingFallback` existe pero casi no se usa (3 importaciones). Hay 4 patrones distintos: (1) `DataTable isLoading` skeleton, (2) `<Skeleton>` de shadcn, (3) `<Loader2 animate-spin>`, (4) `<div animate-pulse>Texto...</div>`. Sin estándar.
- **Recomendación:** 🔄 Refactorizar y unificar. Promover `LoadingFallback` como estándar para full-page; `<Skeleton>` para inline; negar `animate-pulse` text como patrón.

---

#### Patrón: Modales / Diálogos (confirmaciones, formularios modal)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ❌ No aplica | — | |
| Ventas | ✅ Sí | `BaseModal` + `ActionConfirmModal` | `SalesCheckoutWizard`, `SaleNoteModal`, `DeliveryModal`, `SaleOrderForm` |
| Compras | ✅ Sí | `BaseModal` + `ActionConfirmModal` | `PurchaseCheckoutWizard`, `PurchaseNoteModal`, `ReceiptModal`, `DocumentRegistrationModal` |
| Inventario | ✅ Sí | `BaseModal` + `ActionConfirmModal` | 8+ modales: `ProductInsightsDialog`, `ArchivingRestrictionsDialog`, `BarcodeDialog`, `SubscriptionHistoryModal`, listas de CRUD |
| Contabilidad | ✅ Sí | `BaseModal` | `LedgerModal` |
| Facturación | ✅ Sí | `BaseModal` | `NoteCheckoutWizard` |
| Tesorería | ✅ Sí | `BaseModal` + `ActionConfirmModal` | 12+ modales: la mayor concentración del proyecto |
| Producción | ✅ Sí | `BaseModal` + `ActionConfirmModal` | `BOMFormDialog`, `WorkOrderWizard` |
| RRHH | ⚠️ Parcial | `BaseModal` parcial | Forms en pages usan `BaseModal` para edición pero confirmaciones usan `confirm()` nativo |
| POS | ✅ Sí | `BaseModal` | 6+ modales: `SessionCloseModal`, `PINPadModal`, `NumpadModal`, `DraftCartsList`, `POSVariantSelectorModal`, `SalesOrdersModal` |
| Créditos | ✅ Sí | `BaseModal` | `CreditAssignmentModal` |
| Finanzas | ✅ Sí | `BaseModal` | `BudgetsListView`, `BudgetEditor` |
| Impuestos | ✅ Sí | `BaseModal` | `DeclarationWizard`, `F29PaymentModal`, `PeriodChecklist` |
| Contactos | ✅ Sí | `BaseModal` + `ActionConfirmModal` | `ContactModal` (lazy loaded) |
| Configuración | ✅ Sí | `BaseModal` + `ActionConfirmModal` | `TerminalFormDialog`, `InitialCapitalModal`, `PartnerEditModal`, etc. |
| Perfil | ❌ No aplica | — | No tiene modales |
| Workflow | ❌ No aplica | — | No tiene modales |

**Sub-patrón: Confirmaciones**

| Mecanismo | Instancias | Módulos que lo usan |
|-----------|-----------|-------------------|
| `ActionConfirmModal` | 17 imports | Ventas, Compras, Inventario, Tesorería, Producción, Configuración, Contactos, Orders, Subscriptions |
| `confirm()` nativo | ~4 instancias | `TransactionViewModal`, `CategoryList` (legacy) |
| `AlertDialog` (shadcn) | 145 instancias* | *Usado internamente por `ActionConfirmModal` y algunos componentes de shadcn |

- **Consistencia global:** 🟢 **Alta** — `BaseModal` tiene ~59 importaciones (componente más usado). `ActionConfirmModal` tiene 17 importaciones coherentes. Solo 4 usos residuales de `confirm()` nativo.
- **Recomendación:** ✅ Ya existe, enforcar su uso. Eliminar los 4 `confirm()` nativos residuales y migrarlos a `ActionConfirmModal`.

---

#### Patrón: Breadcrumbs (navegación jerárquica)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Todos | ❌ No | — | **No existe componente de breadcrumbs en el proyecto.** No se encontró ninguna importación ni implementación de breadcrumbs. La navegación se apoya en la sidebar + PageHeader. |

- **Consistencia global:** — **No aplica** — No hay breadcrumbs implementados.
- **Recomendación:** 🆕 Crear desde cero (si se necesita). Dado que la app es un SPA con sidebar, los breadcrumbs no son críticos pero podrían mejorar la navegación en rutas profundas como `settings > treasury > reconciliation > [id]`. Evaluar si el patrón es necesario antes de invertir.

---

#### Patrón: Notificaciones (toasts, alerts, banners)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ❌ No aplica | — | |
| Ventas | ✅ Sí | `toast` (sonner) | `toast.success`, `toast.error` |
| Compras | ✅ Sí | `toast` (sonner) | Consistente con ventas |
| Inventario | ✅ Sí | `toast` (sonner) | 8+ archivos: `ProductList`, `CategoryList`, `WarehouseList`, etc. |
| Contabilidad | ✅ Sí | `toast` (sonner) | |
| Facturación | ✅ Sí | `toast` (sonner) | |
| Tesorería | ✅ Sí | `toast` (sonner) | 12+ archivos — módulo con más toasts |
| Producción | ✅ Sí | `toast` (sonner) | |
| RRHH | ✅ Sí | `toast` (sonner) | Solo en settings |
| POS | ✅ Sí | `toast` (sonner) | `SessionControl`, `SessionCloseModal` |
| Créditos | ✅ Sí | `toast` (sonner) | |
| Finanzas | ✅ Sí | `toast` (sonner) | |
| Impuestos | ✅ Sí | `toast` (sonner) | |
| Contactos | ✅ Sí | `toast` (sonner) | |
| Configuración | ✅ Sí | `toast` (sonner) | 15+ archivos |
| Perfil | ✅ Sí | `toast` (sonner) | |
| Workflow | ✅ Sí | `toast` (sonner) | |

- **Consistencia global:** 🟢 **Alta** — 100% de módulos usan `toast` de sonner via `import { toast } from "sonner"`. ~73+ archivos lo importan. No se detectó ningún otro sistema de notificaciones (no hay `alert()`, `window.alert()`, ni librerías alternativas). El `Toaster` está centralizado en el layout raíz.
- **Recomendación:** ✅ Ya existe, enforcar su uso. Excelente adopción. Considerar crear un wrapper `showError(error)` que unifique el formato de mensajes de error de API.

---

#### Patrón: Badges / Chips (estados, etiquetas, categorías)

| Módulo | ¿Usa componente compartido? | Componente usado | Observación |
|--------|----------------------------|-----------------|-------------|
| Dashboard | ❌ No | — | |
| Ventas | ✅ Sí | `Badge` (shadcn) | `SalesOrdersView`, `SaleOrderForm`, `checkout/OrderSummaryCard`, `DeliveryModal` |
| Compras | ✅ Sí | `Badge` (shadcn) | `ReceiptModal`, `PurchaseOrderSummaryCard`, `PurchaseNoteSummarySidebar` |
| Inventario | ✅ Sí | `Badge` (shadcn) | `ProductList`, `StockReport` + selectores |
| Contabilidad | ⚠️ Parcial | `Badge` + ad-hoc `<span>` | Algunas vistas usan spans estilizados en lugar de Badge para estados |
| Facturación | ✅ Sí | `Badge` (shadcn) | `SalesInvoicesClientView` |
| Tesorería | ✅ Sí | `Badge` (shadcn) | 12+ componentes lo usan — adopción masiva |
| Producción | ✅ Sí | `Badge` (shadcn) | `WorkOrderWizard`, `WorkOrderKanban`, `WizardHeader`, `BOMFormDialog` |
| RRHH | ✅ Sí | `Badge` (shadcn) | `HRSettingsView` |
| POS | ✅ Sí | `Badge` (shadcn) | `SessionControl` |
| Créditos | ✅ Sí | `Badge` (shadcn) | `CreditPortfolioView` |
| Finanzas | ❌ No | — | No detectado en finanzas views |
| Impuestos | ✅ Sí | `Badge` (shadcn) | `DeclarationWizard`, `F29PaymentModal` |
| Contactos | ⚠️ Parcial | `Badge` + ad-hoc | `ContactModal` usa Badge; `ContactsClientView` mezcla con spans |
| Configuración | ✅ Sí | `Badge` (shadcn) | 6+ componentes de settings usan Badge |
| Perfil | ✅ Sí | `Badge` (shadcn) | `ProfileView`, `PartnerProfileTab` |
| Workflow | ✅ Sí | `Badge` (shadcn) | `WorkflowSettings`, `TaskActionCard`, `NotificationBell` |
| Orders | ✅ Sí | `Badge` (shadcn) | 7+ componentes en orders/phases |

- **Consistencia global:** 🟢 **Alta** — 84+ importaciones de `Badge` de shadcn. Es el primitivo de estados más usado. Sin embargo, los **colores de los badges son ad-hoc** (cada módulo elige sus propios colores con `className` inline), no hay un sistema de "status badge" estandarizado con mapping `status → color`.
- **Recomendación:** ⚠️ Refactorizar parcialmente. Crear un `<StatusBadge status="active|pending|rejected|..." />` que mapee estados a colores de forma centralizada, en lugar de que cada módulo hardcodee sus propias clases.

---

#### Resumen de Governance

| Patrón | Consistencia | Componente canónico | Estado |
|--------|-------------|-------------------|---------| 
| Tablas de datos | 🟢 Alta | `DataTable` | ✅ Existe, enforcar |
| Page Header | 🟢 Alta | `PageHeader` | ✅ Existe, enforcar |
| Formularios | 🟡 Media | `react-hook-form` + `Form` + `FORM_STYLES` | 🔄 Unificar adopción de FORM_STYLES |
| Botones de acción | 🟢 Alta | `Button` (shadcn) | ✅ Existe, enforcar |
| Estados vacíos | 🔴 Baja | ❌ No existe | 🆕 Crear `<EmptyState>` |
| Estados de carga | 🔴 Baja | `LoadingFallback` (sub-usado) | 🔄 Promover `LoadingFallback` + `Skeleton` |
| Modales/Diálogos | 🟢 Alta | `BaseModal` + `ActionConfirmModal` | ✅ Existe, enforcar (eliminar 4 `confirm()`) |
| Breadcrumbs | — No aplica | ❌ No existe | 🆕 Evaluar necesidad |
| Notificaciones | 🟢 Alta | `toast` (sonner) | ✅ Existe, enforcar |
| Badges/Chips | 🟢 Alta (estructura) / 🔴 Baja (colores) | `Badge` (shadcn) | 🔄 Crear `<StatusBadge>` semántico |

---

## FASE 3 — Análisis de Componentes Compartidos Críticos

### 🏗️ 1. DataTable (`components/ui/data-table.tsx`)

**Usos encontrados:** ~50  
**Props actuales:** `columns`, `data`, `defaultPageSize`, `pageSizeOptions`, `filterColumn`, `searchPlaceholder`, `globalFilterFields`, `facetedFilters`, `toolbarAction`, `onRowSelectionChange`, `initialColumnVisibility`, `hiddenColumns`, `useAdvancedFilter`, `onReset`, `renderCustomView`, `rightAction`, `showToolbarSort`, `onRowClick`, `cardMode`, `isLoading`, `skeletonRows`, `renderSubComponent`, `hidePagination`, `toolbarClassName`, `noBorder`

**Problemas detectados:**
- P1: 26 props — demasiadas para un solo componente. Debería usar composición.
- P2: `cardMode` duplica rendering completo (~100 líneas de código casi idéntico).
- P3: Los sub-componentes (`toolbar`, `pagination`, `filters`) están acoplados como imports directos.
- P4: 389 líneas — borderline "God Component" para una tabla.

**Recomendación:** Refactorizar → composición  
**Prioridad:** 🟡 Medio (funciona bien, pero escala mal)

---

### 🏗️ 2. BaseModal (`components/shared/BaseModal.tsx`)

**Usos encontrados:** ~59  
**Props actuales:** `open`, `onOpenChange`, `title`, `description`, `children`, `footer`, `headerActions`, `contentClassName`, `headerClassName`, `footerClassName`, `hideScrollArea`, `variant`, `showCloseButton`, `size`, `className`

**Problemas detectados:**
- ✅ Bien tipado con `BaseModalProps` interface
- ✅ Soporta variants: `default`, `transaction`, `wizard`, `raw`
- ⚠️ Minor: `variant` prop no está expuesto correctamente a VariantProps

**Recomendación:** ✅ Mantener como está  
**Prioridad:** 🟢 Bajo

---

### 🏗️ 3. TransactionViewModal (`components/shared/TransactionViewModal.tsx`)

**Usos encontrados:** ~10  
**Props actuales:** `open`, `onOpenChange`, `type`, `id`, `view`

**Problemas detectados:**
- 🔴 **756 líneas** — "God Component" definitivo
- 🔴 Importa directamente `api` y hace fetch de datos
- 🔴 Importa `ActivitySidebar` de features/audit
- 🔴 Importa `PaymentForm` de forms
- 🔴 50+ colores hardcoded (emerald, amber, rose)
- 🔴 Lógica de routing de API embebida (`switch` de 14 endpoints)
- ⚠️ `[key: string]: unknown` en `TransactionData`

**Recomendación:** 🔄 Refactorizar urgente  
**Prioridad:** 🔴 Crítico

---

### 🏗️ 4. ProductSelector (`components/selectors/ProductSelector.tsx`)

**Usos encontrados:** ~9  
**Props actuales:** `value`, `onChange`, `onSelect`, `customFilter`, `customDisabled`, `allowedTypes`, `excludeIds`, `warehouseId`, `requireStock`, `showManufacturable`, `enableVariantResolution`, `placeholder`, `disabled`, `showPricingBadges`

**Problemas detectados:**
- 🔴 **23KB, 17 usos de `any`**
- 🔴 `onSelect?: (product: any)`, `customFilter?: (product: any) => boolean`
- 🔴 Importa `api` directamente — fetching inline
- ⚠️ 14 props — borderline excesivo

**Recomendación:** 🔄 Refactorizar — tipar product, extraer hook  
**Prioridad:** 🔴 Alto

---

### 🏗️ 5. PageHeader (`components/shared/PageHeader.tsx`)

**Usos encontrados:** ~10  
**Props actuales:** `title`, `description`, `icon`, `iconName`, `titleActions`, `children`, `className`

**Problemas detectados:**
- ⚠️ Import de `framer-motion` inline (línea 22, fuera del bloque de imports)
- ⚠️ Soporta `icon` (LucideIcon) E `iconName` (string) — redundante
- ✅ Bien tipado con `PageHeaderProps`

**Recomendación:** ✅ Mantener, limpiar import order  
**Prioridad:** 🟢 Bajo

---

### 🏗️ 6. FacetedFilter (`components/shared/FacetedFilter.tsx`)

**Usos encontrados:** ~24 (entre ambas versiones)  
**Props actuales:** `title`, `options`, `selectedValues`, `onSelect`

**Problemas detectados:**
- 🔴 **Duplicado** con `data-table-faceted-filter.tsx`
- La versión standalone y la de tabla son >80% idénticas

**Recomendación:** 🗑️ Eliminar versión en `/ui`, mantener versión standalone en shared  
**Prioridad:** 🟡 Medio

---

### 🏗️ 7. AccountSelector (`components/selectors/AccountSelector.tsx`)

**Usos encontrados:** ~17  
**Props actuales:** `value`, `onChange`, `filterType`, `filterNature`, `excludeIds`, `placeholder`, `disabled`

**Problemas detectados:**
- ⚠️ 5 usos de `any` en filtros
- 🔴 Importa `api` directamente

**Recomendación:** 🔄 Refactorizar — extraer hook de fetching  
**Prioridad:** 🟡 Medio

---

### 🏗️ 8. PaymentForm (`components/forms/PaymentForm.tsx`)

**Usos encontrados:** usado en TransactionViewModal + varias rutas  
**Props actuales:** `onSuccess`, `initialData`, `open`, `onOpenChange`, `triggerText`

**Problemas detectados:**
- 🔴 `initialData?: any` — sin tipado
- 🔴 `useState<any[]>([])` para orders y methods
- ⚠️ `catch (error: any)`
- ⚠️ `bg-white` hardcoded (rompe dark mode)
- ⚠️ `border-blue-200 bg-blue-50/30` — color hardcoded

**Recomendación:** 🔄 Refactorizar — tipar initialData, extraer hook  
**Prioridad:** 🟡 Medio

---

### 🏗️ 9. WorkOrderForm (`components/forms/WorkOrderForm.tsx`)

**Usos encontrados:** ~3  
**Tamaño:** **66KB — archivo más grande del proyecto**

**Problemas detectados:**
- 🔴 66KB, probablemente >1500 líneas
- 🔴 Debería dividirse en sub-componentes como `ProductForm` hizo
- 🔴 En `/components/forms` en vez de `features/production`

**Recomendación:** 🔄 Refactorizar urgente + mover a features/production  
**Prioridad:** 🔴 Crítico

---

### 🏗️ 10. MoneyDisplay (`components/ui/MoneyDisplay.tsx`)

**Usos encontrados:** ubicuo en tablas de treasury y billing  
**Props actuales:** `amount`, `currency`, `showColor`, `showZeroAsDash`, `className`, `digits`

**Problemas detectados:**
- ⚠️ PascalCase naming en directorio kebab-case
- ⚠️ Ubicado en `/ui` en vez de `/shared`
- ✅ Bien tipado

**Recomendación:** 🔄 Mover a `/shared` y renombrar a `money-display.tsx`  
**Prioridad:** 🟢 Bajo

---

## FASE 4 — Reporte Ejecutivo

### Resumen de Hallazgos

| Métrica | Valor |
|---------|-------|
| **Total de componentes** | ~368 archivos |
| Primitivos shadcn/ui | 31 (8%) |
| Compuestos reutilizables | 74 (20%) |
| Específicos de módulo | 263 (72%) |
| **Problemas detectados** | 52 |
| Críticos | 7 |
| Altos | 9 |
| Medios | 26 |
| Bajos | 10 |

#### Problemas por categoría

| Categoría | Crítico | Alto | Medio | Bajo | Total |
|-----------|---------|------|-------|------|-------|
| Duplicación | 0 | 2 | 4 | 1 | 7 |
| Inconsistencia UI/UX | 1 | 1 | 4 | 1 | 7 |
| Arquitectura Next.js | 1 | 1 | 3 | 1 | 6 |
| Acoplamiento | 2 | 0 | 7 | 0 | 9 |
| Tipado débil | 2 | 3 | 5 | 0 | 10 |
| Naming/Convenciones | 0 | 0 | 4 | 3 | 7 |
| **Componentes críticos** | 2 | 1 | 3 | 2 | 8 |

---

### Top 5 Problemas Críticos

#### 1. 🔴 God Component: `TransactionViewModal.tsx` (756 líneas)
**Impacto:** Mantenibilidad, velocidad de desarrollo, testabilidad  
El componente más complejo del proyecto concentra fetching de datos (14 endpoints), routing interno con historial, renderizado para 10+ tipos de transacción, 50+ colores hardcoded, e importaciones cruzadas a `features/audit` y `forms/PaymentForm`. Cualquier cambio en un tipo de transacción requiere modificar un archivo de 756 líneas. **Divide et impera: extraer la lógica de fetch a un hook `useTransactionData`, el routing a un hook `useNavigationHistory`, y cada tipo de vista a sub-componentes por tipo.**

#### 2. 🔴 Tipado `any` sistémico: `initialData?: any` en todos los formularios
**Impacto:** Type safety, refactoring safety, DX  
14 formularios principales aceptan `initialData?: any`, eliminando completamente la protección de tipos. Cuando el backend cambia un campo, no hay error de compilación — el bug se descubre en runtime. **Definir una interface `FormPayload<T>` por cada formulario, derivada de los Zod schemas que ya existen.** Ejemplo: `PaymentForm` ya tiene `paymentSchema` pero los datos de entrada no están vinculados a él.

#### 3. 🔴 Módulo POS completo dentro de `app/`
**Impacto:** Arquitectura, reutilización, testabilidad  
8 componentes, 4 hooks y 1 contexto viven en `app/pos/`. Esto viola completamente la separación entre routing (app/) y lógica de negocio (features/). Los hooks `useProducts` y `useStockValidation` están duplicados con versiones en `hooks/` y `features/`. **Mover todo a `features/pos/` y dejar solo `page.tsx` y `layout.tsx` en `app/pos/`.**

#### 4. 🔴 30+ componentes de UI con llamadas directas a API
**Impacto:** Testabilidad, separación de capas, reutilización  
Literalmente todos los formularios y selectores importan `@/lib/api` e inlinan la lógica de fetching. `ProductSelector` hace 3 queries internas. `PaymentForm` hace 2 queries. Esto hace imposible testear componentes sin mockear HTTP, y acopla presentación con infraestructura. **Patrón correcto: extraer hooks `useQueryXxx` que encapsulen las llamadas, o usar las APIs de TanStack Query que ya existen en algunos features.**

#### 5. 🔴 Colores hardcoded masivos (100+ instancias)
**Impacto:** Consistencia visual, dark mode, mantenibilidad  
Se encontraron 100+ instancias de colores arbitrarios (`text-emerald-600`, `bg-blue-50`, `text-amber-700`, `bg-red-100`, `bg-white`) en componentes compartidos. Esto rompe dark mode, hace inconsistente el diseño visual, y requiere cambios masivos si se actualiza la paleta. **Definir tokens semánticos en `globals.css` (`--success`, `--warning`, `--info`) y usar clases como `text-success`, `bg-warning/10`.**

---

### Estructura Recomendada

```
src/components/
├── ui/                              ← Primitivos shadcn (intocables)
│   ├── accordion.tsx
│   ├── alert-dialog.tsx
│   ├── button.tsx
│   ├── ... (31 primitivos shadcn actuales, sin cambios)
│   ├── data-table.tsx               ← DataTable + sub-componentes
│   ├── data-table-*.tsx
│   └── index.ts                     ← [NUEVO] barrel export
│
├── shared/                          ← Compuestos reutilizables entre módulos
│   ├── BaseModal.tsx                ← Mantener
│   ├── PageHeader.tsx               ← Mantener
│   ├── PageTabs.tsx                 ← Unificar con ServerPageTabs
│   ├── FacetedFilter.tsx            ← Mantener (eliminar duplicado en ui/)
│   ├── DateRangeFilter.tsx          ← Mantener
│   ├── ActionConfirmModal.tsx       ← Mantener, reemplazar colores
│   ├── CollapsibleSheet.tsx         ← Mantener
│   ├── CommentSystem.tsx            ← Extraer API hook
│   ├── AttachmentList.tsx           ← Mantener
│   ├── DocumentAttachmentDropzone.tsx
│   ├── DocumentCompletionModal.tsx  ← Extraer API hook
│   ├── DataManagement.tsx           ← Extraer API hook
│   ├── MoneyDisplay.tsx             ← [MOVER desde ui/]
│   ├── LoadingFallback.tsx          ← [MOVER desde ui/]
│   ├── IndustrialCard.tsx           ← [MOVER desde ui/]
│   ├── transaction-modal/           ← Mantener sub-módulo
│   │   ├── TransactionViewModal.tsx ← [REFACTORIZAR]
│   │   ├── BannerStatus.tsx
│   │   ├── ... sub-componentes
│   │   └── index.ts
│   └── index.ts
│
├── selectors/                       ← Mantener agrupación
│   ├── AccountSelector.tsx          ← Extraer hook
│   ├── ProductSelector.tsx          ← [REFACTORIZAR + TIPAR]
│   ├── AdvancedContactSelector.tsx  ← Resolver dependencia circular
│   ├── ... (7 selectores más)
│   └── index.ts
│
├── layout/                          ← Layout shell
│   ├── app-sidebar.tsx              ← [MOVER desde raíz]
│   ├── DashboardShell.tsx
│   ├── MiniSidebar.tsx
│   ├── QuickActionsMenu.tsx
│   ├── TaskInboxSidebar.tsx
│   ├── TopBar.tsx
│   └── index.ts
│
├── auth/                            ← ✅ Mantener
├── providers/                       ← ✅ Mantener
└── tools/                           ← ✅ Mantener

features/
├── accounting/                      ← ✅ Estructura limpia
├── audit/                           ← ✅ Mantener
├── billing/                         ← ✅ Estructura limpia
├── contacts/                        ← ✅ Estructura limpia
├── credits/
│   └── components/                  ← [MOVER BlacklistView, CreditPortfolioView aquí]
├── finances/                        ← ✅ Mantener
├── hr/                              ← ✅ Mantener
├── inventory/
│   └── components/
│       ├── ... existentes
│       └── forms/                   ← [MOVER ProductForm, CategoryForm, WarehouseForm]
├── orders/                          ← ✅ Mantener
├── pos/
│   ├── components/
│   │   ├── Cart.tsx                 ← [MOVER desde app/pos/]
│   │   ├── CartItem.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── ... (8 componentes más desde app/pos/)
│   │   └── ... existentes
│   ├── hooks/
│   │   ├── useCart.ts               ← [MOVER desde app/pos/]
│   │   ├── useProducts.ts           ← [UNIFICAR con hooks/ global]
│   │   └── useStockValidation.ts    ← [UNIFICAR]
│   └── contexts/
│       └── POSContext.tsx           ← [MOVER desde app/pos/]
├── production/
│   └── components/
│       └── forms/
│           └── WorkOrderForm.tsx    ← [MOVER + DIVIDIR]
├── purchasing/                      ← ✅ Mantener
├── sales/
│   └── components/
│       └── forms/
│           └── ... formas de venta
├── settings/                        ← ✅ Mantener
├── tax/                             ← ✅ Mantener
├── treasury/
│   └── components/
│       ├── ... existentes
│       ├── ReconciliationDashboard.tsx  ← [MOVER desde app/]
│       ├── ReconciliationRules.tsx      ← [MOVER desde app/]
│       ├── StatementsList.tsx           ← [MOVER desde app/]
│       └── forms/
│           ├── PaymentForm.tsx          ← [MOVER desde components/forms/]
│           └── BankJournalForm.tsx      ← [MOVER]
└── workflow/                        ← ✅ Mantener
```

### Dónde va cada componente actual

| Componente actual | Ubicación destino |
|------------------|-------------------|
| `components/app-sidebar.tsx` | `components/layout/app-sidebar.tsx` |
| `components/ui/IndustrialCard.tsx` | `components/shared/IndustrialCard.tsx` |
| `components/ui/LoadingFallback.tsx` | `components/shared/LoadingFallback.tsx` |
| `components/ui/MoneyDisplay.tsx` | `components/shared/MoneyDisplay.tsx` |
| `components/forms/WorkOrderForm.tsx` | `features/production/components/forms/WorkOrderForm.tsx` (dividido) |
| `components/forms/PaymentForm.tsx` | `features/treasury/components/forms/PaymentForm.tsx` |
| `components/forms/AccountForm.tsx` | `features/accounting/components/forms/AccountForm.tsx` |
| `components/forms/ProductForm.tsx` | `features/inventory/components/forms/ProductForm.tsx` |
| `app/pos/components/*` | `features/pos/components/*` |
| `app/pos/hooks/*` | `features/pos/hooks/*` |
| `app/pos/contexts/*` | `features/pos/contexts/*` |
| `credits/BlacklistView.tsx` | `credits/components/BlacklistView.tsx` |
| `credits/CreditPortfolioView.tsx` | `credits/components/CreditPortfolioView.tsx` |
| Reconciliation components en `app/` | `features/treasury/components/` |
| `hooks/useDeviceContext.ts` | `features/pos/hooks/useDeviceContext.ts` |
| `hooks/useFolioValidation.ts` | `features/billing/hooks/useFolioValidation.ts` |
| `hooks/useOrderHubData.ts` | `features/orders/hooks/useOrderHubData.ts` |
| `hooks/useStockValidation.ts` | `features/pos/hooks/useStockValidation.ts` (unificar) |
| `hooks/useTreasuryAccounts.ts` | Eliminar (usar `features/treasury/hooks/`) |
| `hooks/useAccountingAccounts.ts` | Evaluar unificación con `features/accounting/hooks/useAccounts.ts` |

---

### Roadmap de Refactorización

#### Semana 1: Quick Wins (bajo esfuerzo, alto impacto)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|---------|---------|
| 1 | Mover `app-sidebar.tsx` a `components/layout/` | 15 min | Consistencia |
| 2 | Mover `IndustrialCard`, `LoadingFallback`, `MoneyDisplay` a `/shared` | 30 min | Naming/ubicación |
| 3 | Mover `credits/Black/CreditPortfolio` a `credits/components/` | 15 min | Convención |
| 4 | Crear `components/ui/index.ts` barrel export | 20 min | DX imports |
| 5 | Eliminar `hooks/useTreasuryAccounts.ts` (usar feature version) | 20 min | Deduplicación |
| 6 | Eliminar `hooks/useAccountingAccounts.ts` duplicado | 20 min | Deduplicación |
| 7 | Definir tokens semánticos CSS (`--success`, `--warning`, `--info`) en `globals.css` | 30 min | Base para fix colores |
| 8 | Limpiar `PageHeader.tsx` import order (framer-motion) | 5 min | Code quality |
| 9 | Unificar `PageTabs` y `ServerPageTabs` en un solo componente | 45 min | Deduplicación |
| 10 | Mover hooks domain-specific (`useDeviceContext`, `useFolioValidation`, `useOrderHubData`) a sus features | 30 min | Arquitectura |

#### Semana 2: Componentes Críticos Compartidos

| # | Tarea | Esfuerzo | Impacto |
|---|-------|---------|---------|
| 1 | **Refactorizar `TransactionViewModal`**: extraer `useTransactionData` hook, separar vistas por tipo | 6-8h | Crítico |
| 2 | **Tipar `initialData`** en los 14 formularios top (crear interfaces derivadas de Zod schemas) | 4-6h | Type safety |
| 3 | **Refactorizar `ProductSelector`**: crear `useProductSearch` hook, tipar `Product` interface | 3-4h | Type safety + DX |
| 4 | Extraer API calls de selectores a hooks: `AccountSelector`, `GroupSelector`, etc. | 4-5h | Separación de capas |
| 5 | Reemplazar colores hardcoded por tokens semánticos en `/shared` y `/selectors` | 3-4h | Consistencia visual |

#### Semana 3: Estandarización por Módulo

| # | Tarea | Esfuerzo | Impacto |
|---|-------|---------|---------|
| 1 | **Migrar POS**: mover 8 componentes, 4 hooks, 1 contexto de `app/pos/` a `features/pos/` | 4-5h | Arquitectura |
| 2 | **Migrar Reconciliation**: mover 5 componentes de `app/(dashboard)/treasury/reconciliation/` a `features/treasury/` | 2-3h | Arquitectura |
| 3 | **Dividir `WorkOrderForm.tsx`** (66KB) en sub-componentes y mover a `features/production/` | 6-8h | Mantenibilidad |
| 4 | Mover formularios domain-specific de `components/forms/` a sus `features/` respectivos | 3-4h | Arquitectura |
| 5 | Crear barrel exports faltantes (treasury components, app components) | 1-2h | DX |
| 6 | Resolver dependencias circulares: `shared` → `features` (ActivitySidebar, ContactModal) | 3-4h | Arquitectura |

#### Semana 4: Documentación y Contratos de Props

| # | Tarea | Esfuerzo | Impacto |
|---|-------|---------|---------|
| 1 | Documentar interfaces de props para los 10 componentes más usados (JSDoc) | 4-5h | DX |
| 2 | Crear `docs/component-contracts.md` con API de cada componente shared | 3-4h | Onboarding |
| 3 | Agregar ESLint rule: `no-explicit-any` con severity `warn` | 30 min | Prevención |
| 4 | Agregar ESLint rule: restricción de imports `@/lib/api` en `components/` | 1h | Prevención |
| 5 | Agregar Skeleton/loading states a formularios críticos | 4-6h | UX |
| 6 | Mover `STYLE_GUIDE.md` a `docs/` + expandir con ejemplos actualizados | 1-2h | Documentación |
| 7 | Cleanup final: eliminar componentes huérfanos, exports no usados | 2-3h | Limpieza |

---

## Áreas No Auditadas

1. **Contenido de archivos `app/(dashboard)/*/page.tsx`**: No se analizó el contenido individual de cada page ya que son thin wrappers. Se verificó que importen de `features/` y `/components`.
2. **CSS**: No se analizó exhaustivamente `globals.css` ni los tokens de Tailwind custom. Solo se verificaron colores hardcoded en componentes.
3. **Tests**: El proyecto no tiene tests visibles. No se realizó análisis de cobertura.
4. **Bundle size**: No se analizó el impacto de imports en el bundle (e.g., `lucide-react` icons, `framer-motion`).
5. **Accesibilidad**: No se auditaron atributos `aria-*`, manejo de foco, o contraste de colores.
6. **Internacionalización**: Se observa que el proyecto está en español con strings hardcoded; no se evaluó la preparación para i18n.
