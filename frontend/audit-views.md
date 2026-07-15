# Inventario de Vistas y Deuda Técnica de Tarjetas

| Archivo | Entidad | Vistas Disponibles | Política (Registry) | Render manual (`renderCard`) |
|---------|---------|--------------------|---------------------|--------------------------------|
| `AccountingClosuresClientView.tsx` | `accounting.fiscalyear` | card | `custom` | No (✅ Válido usar JSX manual o `createDomainCardView`.) |
| `PurchaseInvoicesClientView.tsx` | `billing.invoice` | list, card | `entity` | No (⚠️ Verificar si implementa `renderCustomView` con helper.) |
| `SalesInvoicesClientView.tsx` | `billing.invoice` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `ContactsClientView.tsx` | `contacts.contact` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `StatementsClientView.tsx` | `treasury.bankstatement` | card | `custom` | No (✅ Válido usar JSX manual o `createDomainCardView`.) |
| `BudgetsClientView.tsx` | `accounting.budget` | list | `none (default list)` | No (Solo tabla (List)) |
| `AbsenceClientView.tsx` | `hr.absence` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `EmployeeClientView.tsx` | `hr.employee` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `PayrollClientView.tsx` | `hr.payroll` | list | `none (default list)` | No (Solo tabla (List)) |
| `SalaryAdvanceClientView.tsx` | `hr.salaryadvance` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `AttributesClientView.tsx` | `inventory.attribute` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `CategoryClientView.tsx` | `inventory.category` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `DocumentsClientView.tsx` | `inventory.inventorydocument` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `InventoryCountClientView.tsx` | `inventory.inventorycount` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `MovementClientView.tsx` | `inventory.stockmove` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `PricingRuleClientView.tsx` | `inventory.pricingrule` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `ProductClientView.tsx` | `inventory.product` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `StockReport.tsx` | `inventory.stockreport` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `SubscriptionsClientView.tsx` | `inventory.subscription` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `UoMCategoryClientView.tsx` | `inventory.uomcategory` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `UoMClientView.tsx` | `inventory.uom` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `WarehouseClientView.tsx` | `inventory.warehouse` | list | `none (default list)` | No (Solo tabla (List)) |
| `BOMClientView.tsx` | `production.bom` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `POSSessionsClientView.tsx` | `pos.session` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `PosTerminalClientView.tsx` | `treasury.terminal` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `SalesOrdersView.tsx` | `UNKNOWN` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `GroupsClientView.tsx` | `settings.group` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `UsersSettingsClientView.tsx` | `core.user` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `PartnersClientView.tsx` | `settings.partner` | list, analytics | `none (default list)` | No (Solo tabla (List)) |
| `TaxDeclarationsClientView.tsx` | `tax.taxperiod` | card | `custom` | No (✅ Válido usar JSX manual o `createDomainCardView`.) |
| `StatementDetailModal.tsx` | `treasury.treasurymovement` | card | `entity` | No (⚠️ Verificar si implementa `renderCustomView` con helper.) |
| `StatementsClientView.tsx` | `treasury.creditcardstatement` | card, analytics | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `UnbilledChargesClientView.tsx` | `treasury.unbilled-charge` | list, analytics | `none (default list)` | Sí (Solo tabla (List)) |
| `ChecksClientView.tsx` | `sales.saleorder` | list, card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `BankCenterClientView.tsx` | `treasury.bank` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `BankMovementsClientView.tsx` | `treasury.treasurymovement` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `PaymentHardwareClientView.tsx` | `treasury.terminalprovider` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `PaymentMethodClientView.tsx` | `treasury.paymentmethod` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `TerminalBatchesClientView.tsx` | `treasury.terminalbatch` | list | `none (default list)` | Sí (Solo tabla (List)) |
| `TreasuryAccountsClientView.tsx` | `treasury.treasuryaccount` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `TreasuryMovementsClientView.tsx` | `treasury.treasurymovement` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |
| `CreditLinesClientView.tsx` | `treasury.creditline` | card | `entity` | No (⚠️ Verificar si implementa `renderCustomView` con helper.) |
| `LoansClientView.tsx` | `treasury.bankloan` | card | `entity` | Sí (🚨 **Deuda:** Tiene `renderCard` manual. Migrar a `AutoEntityCard`.) |

## Resumen del Inventario
- **Total de vistas analizadas:** 43
- **Solo Tabla (Sin multi-vista):** 15
- **Tarjetas Complejas (Domain/Custom):** 3
- **Tarjetas Simples (Candidatas a AutoEntityCard):** 25
- **Tarjetas Simples con Deuda Técnica (JSX manual escrito):** 22