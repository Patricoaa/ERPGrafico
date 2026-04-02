# Inventario Completo de Componentes — ERP Frontend

> Generado: 2026-03-31 | Total de archivos analizados: ~335 `.tsx/.ts`

## Leyenda

- **Clasificación**: Primitivo (P) | Compuesto (C) | Específico-módulo (M) | Desconocido (?)
- **Ubicación**: `/ui` | `/shared` | `/components` | `dentro-de-módulo` | `app/`
- **TypeScript tipado**: ✅ Sí | ⚠️ Parcial | ❌ No
- **Barrel export**: ✅ Sí | ❌ No

---

## 1. Componentes UI Primitivos (`components/ui/`)

Barrel export: ❌ No (no existe `index.ts`)

| Archivo | Componente | Clasif. | Tipado | Notas |
|---------|-----------|---------|--------|-------|
| `accordion.tsx` | Accordion | P | ✅ | shadcn estándar |
| `alert-dialog.tsx` | AlertDialog | P | ✅ | shadcn estándar |
| `alert.tsx` | Alert | P | ✅ | shadcn estándar |
| `avatar.tsx` | Avatar | P | ✅ | shadcn estándar |
| `badge.tsx` | Badge | P | ✅ | shadcn estándar |
| `button.tsx` | Button | P | ✅ | shadcn estándar |
| `calendar.tsx` | Calendar | P | ✅ | shadcn extendido |
| `card.tsx` | Card | P | ✅ | shadcn estándar |
| `checkbox.tsx` | Checkbox | P | ✅ | shadcn estándar |
| `dialog.tsx` | Dialog | P | ✅ | shadcn extendido (con `size` variants) |
| `dropdown-menu.tsx` | DropdownMenu | P | ✅ | shadcn estándar |
| `form.tsx` | Form | P | ✅ | shadcn + react-hook-form |
| `input.tsx` | Input | P | ✅ | shadcn extendido |
| `label.tsx` | Label | P | ✅ | shadcn estándar |
| `popover.tsx` | Popover | P | ✅ | shadcn estándar |
| `progress.tsx` | Progress | P | ✅ | shadcn estándar |
| `radio-group.tsx` | RadioGroup | P | ✅ | shadcn estándar |
| `scroll-area.tsx` | ScrollArea | P | ✅ | shadcn estándar |
| `select.tsx` | Select | P | ✅ | shadcn estándar |
| `separator.tsx` | Separator | P | ✅ | shadcn estándar |
| `sheet.tsx` | Sheet | P | ✅ | shadcn estándar |
| `sidebar.tsx` | Sidebar | P | ✅ | shadcn estándar (22KB) |
| `skeleton.tsx` | Skeleton | P | ✅ | shadcn estándar |
| `sonner.tsx` | Sonner/Toaster | P | ✅ | shadcn estándar |
| `switch.tsx` | Switch | P | ✅ | shadcn estándar |
| `table.tsx` | Table | P | ✅ | shadcn estándar |
| `tabs.tsx` | Tabs | P | ✅ | shadcn estándar |
| `textarea.tsx` | Textarea | P | ✅ | shadcn estándar |
| `toggle-group.tsx` | ToggleGroup | P | ✅ | shadcn estándar |
| `toggle.tsx` | Toggle | P | ✅ | shadcn estándar |
| `tooltip.tsx` | Tooltip | P | ✅ | shadcn estándar |
| `data-table.tsx` | DataTable | C | ✅ | Compuesto, 389 líneas, bien tipado genérico |
| `data-table-cells.tsx` | DataTableCells | C | ⚠️ | Helpers para celdas |
| `data-table-column-header.tsx` | DataTableColumnHeader | C | ✅ | |
| `data-table-faceted-filter.tsx` | DataTableFacetedFilter | C | ✅ | **Duplicado con shared/FacetedFilter** |
| `data-table-filters.tsx` | DataTableFilters | C | ✅ | Filtros avanzados |
| `data-table-pagination.tsx` | DataTablePagination | C | ✅ | |
| `data-table-toolbar.tsx` | DataTableToolbar | C | ✅ | 13KB, complejo |
| `IndustrialCard.tsx` | IndustrialCard | C | ✅ | **PascalCase naming** ⚠️ |
| `LoadingFallback.tsx` | LoadingFallback | C | ✅ | **PascalCase + debería estar en /shared** |
| `MoneyDisplay.tsx` | MoneyDisplay | C | ✅ | **PascalCase + debería estar en /shared** |
| `numpad.tsx` | Numpad | C | ✅ | POS-específico, hardcoded colors |
| `dynamic-icon.tsx` | DynamicIcon | P | ✅ | Wrapper de lucide-react |
| `error-boundary.tsx` | ErrorBoundary | C | ✅ | |

---

## 2. Componentes Compartidos (`components/shared/`)

Barrel export: ✅ Sí (`index.ts`)

| Archivo | Componente | Clasif. | Tipado | Usos | Notas |
|---------|-----------|---------|--------|------|-------|
| `ActionConfirmModal.tsx` | ActionConfirmModal | C | ✅ | ~4 | Variantes de confirmación |
| `AttachmentList.tsx` | AttachmentList | C | ✅ | ~3 | |
| `BaseModal.tsx` | BaseModal | C | ✅ | ~59 | **Más usado del proyecto** |
| `CollapsibleSheet.tsx` | CollapsibleSheet | C | ✅ | ~9 | |
| `CommentSystem.tsx` | CommentSystem | C | ✅ | ~3 | Importa `api` directamente |
| `DataManagement.tsx` | DataManagement | C | ⚠️ | ~2 | Importa `api` → acoplamiento |
| `DateRangeFilter.tsx` | DateRangeFilter | C | ✅ | ~3 | |
| `DocumentAttachmentDropzone.tsx` | DocumentAttachmentDropzone | C | ✅ | ~3 | Colores hardcoded |
| `DocumentCompletionModal.tsx` | DocumentCompletionModal | C | ⚠️ | ~3 | Importa `api` → acoplamiento |
| `FacetedFilter.tsx` | FacetedFilter | C | ✅ | ~24 | **Duplicado con ui/data-table-faceted-filter** |
| `PageHeader.tsx` | PageHeader + PageHeaderButton | C | ✅ | ~10 | Importa framer-motion inline |
| `PageTabs.tsx` | PageTabs | C | ✅ | ~4 | |
| `ServerPageTabs.tsx` | ServerPageTabs | C | ✅ | ~2 | Server Component |
| `TransactionViewModal.tsx` | TransactionViewModal | C | ⚠️ | ~10 | **756 líneas**, importa `api` + features |
| **`transaction-modal/`** | Sub-componentes | C | ✅ | — | Barrel export ✅ |
| `→ BannerStatus.tsx` | BannerStatus | C | ✅ | | |
| `→ MetadataItem.tsx` | MetadataItem | C | ✅ | | |
| `→ PaymentHistorySection.tsx` | PaymentHistorySection | C | ⚠️ | | Colores hardcoded |
| `→ PrintableReceipt.tsx` | PrintableReceipt | C | ✅ | | Importa `@/features/settings` |
| `→ RelatedDocumentsSection.tsx` | RelatedDocumentsSection | C | ⚠️ | | Colores hardcoded masivos |
| `→ SidebarContent.tsx` | SidebarContent | C | ✅ | | |

---

## 3. Formularios (`components/forms/`)

Barrel export: ✅ Sí (`index.ts`)

| Archivo | Componente | Clasif. | Tipado | Tamaño | Notas |
|---------|-----------|---------|--------|--------|-------|
| `AccountForm.tsx` | AccountForm | M | ⚠️ | 25KB | Importa features/accounting |
| `BankJournalForm.tsx` | BankJournalForm | M | ⚠️ | 9.5KB | `initialData?: any` |
| `CategoryForm.tsx` | CategoryForm | M | ⚠️ | 21KB | Importa features/audit |
| `CustomFieldTemplateForm.tsx` | CustomFieldTemplateForm | M | ✅ | 10KB | |
| `GroupForm.tsx` | GroupForm | M | ⚠️ | 5KB | |
| `JournalEntryForm.tsx` | JournalEntryForm | M | ⚠️ | 24KB | Importa features/audit, `accounts?: any[]` |
| `PaymentForm.tsx` | PaymentForm | M | ⚠️ | 22KB | `initialData?: any`, API directo |
| `PricingRuleForm.tsx` | PricingRuleForm | M | ⚠️ | 31KB | Importa features/audit |
| `ProductForm.tsx` | ProductForm | M | ⚠️ | 49KB | Importa features/audit, enorme |
| `PurchaseOrderForm.tsx` | PurchaseOrderForm | M | ⚠️ | 18KB | `initialData?: any` |
| `ServiceContractForm.tsx` | ServiceContractForm | M | ⚠️ | 21KB | |
| `TransactionNumberForm.tsx` | TransactionNumberForm | M | ✅ | 4KB | |
| `UserForm.tsx` | UserForm | M | ⚠️ | 29KB | Importa features/audit |
| `WarehouseForm.tsx` | WarehouseForm | M | ⚠️ | 7.8KB | Importa features/audit |
| `WorkOrderForm.tsx` | WorkOrderForm | M | ⚠️ | **66KB** | Archivo más grande, masivo |
| **`product/`** | Sub-componentes | M | ⚠️ | — | Barrel export parcial |
| `→ BulkVariantEditForm.tsx` | BulkVariantEditForm | M | ⚠️ | | |
| `→ ProductBasicInfo.tsx` | ProductBasicInfo | M | ⚠️ | | Importa features/inventory |
| `→ ProductCustomFieldsTab.tsx` | ProductCustomFieldsTab | M | ⚠️ | | `fieldTemplates: any[]` |
| `→ ProductImageUpload.tsx` | ProductImageUpload | M | ✅ | | |
| `→ ProductInventoryTab.tsx` | ProductInventoryTab | M | ⚠️ | | |
| `→ ProductManufacturingTab.tsx` | ProductManufacturingTab | M | ⚠️ | | Importa features/production |
| `→ ProductPricingSection.tsx` | ProductPricingSection | M | ⚠️ | | |
| `→ ProductPricingTab.tsx` | ProductPricingTab | M | ⚠️ | | `initialData?: any` |
| `→ ProductSubscriptionTab.tsx` | ProductSubscriptionTab | M | ⚠️ | | |
| `→ ProductTypeSelector.tsx` | ProductTypeSelector | M | ✅ | | |
| `→ ProductVariantsTab.tsx` | ProductVariantsTab | M | ⚠️ | | Uso masivo de `any` |
| `→ VariantQuickEditForm.tsx` | VariantQuickEditForm | M | ⚠️ | | `variant: any` |
| `→ schema.ts` | productSchema | — | ✅ | | Zod schema |

---

## 4. Selectores (`components/selectors/`)

Barrel export: ✅ Sí (`index.ts`)

| Archivo | Componente | Clasif. | Tipado | Usos | Notas |
|---------|-----------|---------|--------|------|-------|
| `AccountSelector.tsx` | AccountSelector | C | ⚠️ | ~17 | Uso de `any` en filtros |
| `AdvancedContactSelector.tsx` | AdvancedContactSelector | C | ⚠️ | ~14 | Importa features/contacts |
| `AdvancedSaleOrderSelector.tsx` | AdvancedSaleOrderSelector | C | ⚠️ | ~3 | `customFilter?: (order: any)` |
| `AdvancedWorkOrderSelector.tsx` | AdvancedWorkOrderSelector | C | ⚠️ | ~3 | Importa `api` directamente |
| `GroupSelector.tsx` | GroupSelector | C | ⚠️ | ~4 | Importa `api` directamente |
| `ProductSelector.tsx` | ProductSelector | C | ⚠️ | ~9 | **Masivo uso de `any`**, 23KB |
| `TreasuryAccountSelector.tsx` | TreasuryAccountSelector | C | ⚠️ | ~5 | `onSelect?: (account: any)` |
| `UoMSelector.tsx` | UoMSelector | C | ✅ | ~3 | |
| `UserSelector.tsx` | UserSelector | C | ⚠️ | ~4 | Importa `api` directamente |

---

## 5. Layout (`components/layout/`)

Barrel export: ✅ Sí (`index.ts`)

| Archivo | Componente | Clasif. | Tipado | Notas |
|---------|-----------|---------|--------|-------|
| `DashboardShell.tsx` | DashboardShell | C | ✅ | Layout principal |
| `MiniSidebar.tsx` | MiniSidebar | C | ✅ | 22KB, sidebar colapsable |
| `QuickActionsMenu.tsx` | QuickActionsMenu | C | ✅ | 9KB, menú rápido |
| `TaskInboxSidebar.tsx` | TaskInboxSidebar | C | ⚠️ | Importa features/workflow |
| `TopBar.tsx` | TopBar | C | ✅ | Mínimo (322 bytes) |

---

## 6. Auth (`components/auth/`)

Barrel export: ✅ Sí (`index.ts`)

| Archivo | Componente | Clasif. | Tipado | Notas |
|---------|-----------|---------|--------|-------|
| `AuthGuard.tsx` | AuthGuard | C | ✅ | Protección de rutas |
| `PermissionGuard.tsx` | PermissionGuard | C | ✅ | Permisos granulares |

---

## 7. Providers (`components/providers/`)

Barrel export: ✅ Sí (`index.ts`)

| Archivo | Componente | Clasif. | Tipado | Notas |
|---------|-----------|---------|--------|-------|
| `GlobalModalProvider.tsx` | GlobalModalProvider | C | ✅ | Contexto de modales globales |
| `HubPanelProvider.tsx` | HubPanelProvider | C | ✅ | Panel lateral del hub |

---

## 8. Tools (`components/tools/`)

Barrel export: ✅ Sí (`index.ts`)

| Archivo | Componente | Clasif. | Tipado | Notas |
|---------|-----------|---------|--------|-------|
| `CostCalculatorModal.tsx` | CostCalculatorModal | M | ⚠️ | 27KB, importa features/inventory, colores hardcoded |

---

## 9. Componente Raíz (`components/`)

| Archivo | Componente | Clasif. | Tipado | Notas |
|---------|-----------|---------|--------|-------|
| `app-sidebar.tsx` | AppSidebar | C | ✅ | **Debería estar en /layout** |

---

## 10. Feature Modules (`features/`)

### 10.1 accounting (6 archivos)
| Archivo | Componente | Tipado | Barrel | Notas |
|---------|-----------|--------|--------|-------|
| `api/accountingApi.ts` | accountingApi | ✅ | — | API layer |
| `components/AccountsClientView.tsx` | AccountsClientView | ✅ | ✅ | |
| `components/LedgerModal.tsx` | LedgerModal | ✅ | ✅ | |
| `hooks/useAccounts.ts` | useAccounts | ✅ | — | |
| `types/index.ts` | Types | ✅ | — | |

### 10.2 audit (3 archivos)
| Archivo | Componente | Tipado | Barrel | Notas |
|---------|-----------|--------|--------|-------|
| `components/ActivitySidebar.tsx` | ActivitySidebar | ✅ | ✅ | **Importado desde 8+ forms en /components** |
| `components/AuditTimeline.tsx` | AuditTimeline | ✅ | ✅ | |

### 10.3 billing (14 archivos)
Estructura completa con `api/`, `components/`, `hooks/`, `types/`. Barrel: ✅

### 10.4 contacts (7 archivos)
Estructura limpia. Barrel: ✅. Index de módulo: ✅

### 10.5 credits (4 archivos)
| Archivo | Notas |
|---------|-------|
| `BlacklistView.tsx` | **En raíz del módulo**, no en `/components` ⚠️ |
| `CreditPortfolioView.tsx` | **En raíz (59KB)**, no en `/components` ⚠️ |
| `components/CreditAssignmentModal.tsx` | Correctamente en componentes |

### 10.6 finances (11 archivos)
Estructura completa. Barrel: ✅

### 10.7 hr (5 archivos)
Componentes en `components/payrolls/`. Barrel: ✅

### 10.8 inventory (19 archivos)
Estructura completa con `api/`, `components/`, `hooks/`, `types/`. Barrel: ✅

### 10.9 orders (22 archivos)
Estructura rica en `components/phases/`. Barrel: ✅

### 10.10 pos (10 archivos)
Componentes en `/features/pos/components/`. Barrel: ✅

### 10.11 production (11 archivos)
Estructura con `components/steps/`. Barrel: ✅

### 10.12 profile (4 archivos)
Barrel: ✅

### 10.13 purchasing (15 archivos)
Checkout: `checkout/` y `notes/`. Barrel: ✅

### 10.14 sales (21 archivos)
Checkout y forms sub-carpetas. Barrel: ✅. Index: ✅

### 10.15 settings (20 archivos)
Subcarpeta `partners/` con 9 componentes. Barrel: ✅

### 10.16 tax (4 archivos)
Barrel: ✅

### 10.17 treasury (23 archivos)
Módulo más grande con 18 componentes. Barrel: ❌ (no `index.ts` en components). Hooks y types: ✅

### 10.18 workflow (5 archivos)
Barrel: ✅

---

## 11. Componentes en `app/` (23 archivos componente)

### POS (`app/pos/`)
8 componentes, 3 hooks, 1 contexto — **módulo entero dentro de app/**

| Archivo | Notas |
|---------|-------|
| `components/Cart.tsx` | 19KB, lógica de negocio mezclada |
| `components/CartItem.tsx` | 11KB |
| `components/CategoryFilter.tsx` | |
| `components/POSCheckoutHeader.tsx` | |
| `components/POSShell.tsx` | Layout shell |
| `components/ProductGrid.tsx` | 14KB |
| `components/ProductGridSkeleton.tsx` | |
| `components/SearchBar.tsx` | |
| `contexts/POSContext.tsx` | Contexto completo |
| `hooks/useCart.ts` | Hook complejo |
| `hooks/useDrafts.ts` | |
| `hooks/useDraftSync.ts` | |
| `hooks/useProducts.ts` | **Duplicado de features/inventory** |
| `hooks/useStockValidation.ts` | **Duplicado de hooks/useStockValidation** |

### Reconciliation (`app/(dashboard)/treasury/reconciliation/`)
5 componentes directamente en ruta — **Deberían estar en features/treasury**

### Sales/Purchasing orders (`app/(dashboard)/sales/orders/`, `purchasing/orders/`)
1 componente cada uno en `components/` dentro de ruta

---

## 12. Hooks (`hooks/`)

| Archivo | Hook | Notas |
|---------|------|-------|
| `use-debounce.ts` | useDebounce | Utilitario limpio |
| `use-form-with-toast.ts` | useFormWithToast | Patrón reutilizable |
| `use-mobile.ts` | useMobile | shadcn hook |
| `useAccountingAccounts.ts` | useAccountingAccounts | **¿Duplicado de features/accounting/hooks?** |
| `useAllowedPaymentMethods.ts` | useAllowedPaymentMethods | |
| `useDeviceContext.ts` | useDeviceContext | POS-específico en hooks globales ⚠️ |
| `useFolioValidation.ts` | useFolioValidation | Billing-específico ⚠️ |
| `useOrderHubData.ts` | useOrderHubData | Orders-específico ⚠️ |
| `usePermission.ts` | usePermission | Utilitario limpio |
| `useServerDate.ts` | useServerDate | Utilitario limpio |
| `useStockValidation.ts` | useStockValidation | **Duplicado en app/pos/hooks** |
| `useTreasuryAccounts.ts` | useTreasuryAccounts | **Duplicado de features/treasury/hooks** |
| `useWindowWidth.ts` | useWindowWidth | Utilitario limpio |

---

## 13. Contexts (`contexts/`)

| Archivo | Context | Notas |
|---------|---------|-------|
| `AuthContext.tsx` | AuthContext | Limpio |
| `BrandingProvider.tsx` | BrandingProvider | Limpio |

---

## 14. Types (`types/`)

| Archivo | Notas |
|---------|-------|
| `actions.ts` | Tipos de acciones |
| `audit.ts` | Tipos de auditoría |
| `checkout.ts` | Tipos de checkout |
| `hr.ts` | Tipos de HR |
| `pos.ts` | Tipos de POS |
| `profile.ts` | Tipos de perfil |

---

## Resumen Estadístico

| Categoría | Archivos | Con barrel | Tipado completo |
|-----------|----------|------------|----------------|
| UI Primitivos | 45 | ❌ | 43/45 |
| Shared | 21 | ✅ | 15/21 |
| Forms | 28 | ✅ | 3/28 |
| Selectors | 10 | ✅ | 1/10 |
| Layout | 6 | ✅ | 4/6 |
| Auth | 3 | ✅ | 3/3 |
| Providers | 3 | ✅ | 3/3 |
| Tools | 2 | ✅ | 0/2 |
| Feature modules | ~214 | Parcial | ~60% |
| App components | ~23 | ❌ | ~50% |
| Hooks | 13 | ❌ | ~70% |
| **Total** | **~368** | — | — |
