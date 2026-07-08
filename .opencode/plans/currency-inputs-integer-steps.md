# Plan: Currency Inputs - Integer Steps & Placeholders

## Context
CLP has no sub-units. `MoneyDisplay` uses `maximumFractionDigits: 0`.
All CLP-denominated monetary inputs should use `step="1"` and `placeholder="0"`.

## Files to modify

### 1. `frontend/features/treasury/loans/LoanRegisterDrawer.tsx`
- `principal`: `step="0.01"` -> `"1"`, `placeholder="0.00"` -> `"0"` (~line 304)
- `insurance_monthly`: `step="0.01"` -> `"1"`, `placeholder="0.00"` -> `"0"` (~line 380)
- `opening_fee`: `step="0.01"` -> `"1"`, `placeholder="0.00"` -> `"0"` (~line 400)
- `stamp_tax`: `step="0.01"` -> `"1"`, `placeholder="0.00"` -> `"0"` (~line 413)

### 2. `frontend/features/treasury/loans/LoanDisburseDrawer.tsx`
- `opening_fee`: `step="0.01"` -> `"1"` (~line 183)
- `stamp_tax`: `step="0.01"` -> `"1"` (~line 197)

### 3. `frontend/features/treasury/credit-lines/CreditLineDrawer.tsx`
- `credit_limit`: `step="0.01"` -> `"1"` (~line 201)

### 4. `frontend/features/treasury/card-statements/AddChargeModal.tsx`
- `amount`: `step="0.01"` -> `"1"`, `placeholder="0.00"` -> `"0"` (~line 113)

### 5. `frontend/features/treasury/card-statements/CardPendingChargeDrawer.tsx`
- `amount`: `step="0.01"` -> `"1"`, `placeholder="0.00"` -> `"0"` (~line 204)

### 6. `frontend/features/treasury/card-statements/BillChargesModal.tsx`
- `minimumPayment`: `step="0.01"` -> `"1"`, `placeholder="0.00"` -> `"0"` (~line 324)

### 7. `frontend/features/finance/bank-reconciliation/components/SplitAllocationDialog.tsx`
- `allocations.*.amount`: `step="0.01"` -> `"1"` (~line 220)

### 8. `frontend/features/settings/components/HRSettingsView.tsx`
- `uf_current_value`: `step="0.01"` -> `"1"` (~line 204)
- `utm_current_value`: `step="0.01"` -> `"1"` (~line 231)

### 9. `frontend/features/settings/components/partners/InventoryContributionModal.tsx`
- `unitCost`: `step="0.01"` -> `"1"` (~line 344)

### 10. `frontend/features/sales/components/PricingRuleDrawer.tsx`
- `fixed_price`: add `step="1"` after `type="number"` (~line 325)

## Files verified correct (no changes)
- `ProductPricingSection.tsx` - no step (defaults to 1), placeholder="0"
- `VariantQuickEditForm.tsx`, `BulkVariantEditForm.tsx` - already step="1"
- `AdjustmentForm.tsx` - unit_cost already step="1", total_cost already step="1"
- `PurchaseOrderModal.tsx` - unit_cost already step="1"
- `InitialCapitalModal.tsx`, `TransferDrawer.tsx`, `AdvanceDrawer.tsx` - no step, placeholder="0"

## Quantities NOT currency (keep step="0.01")
- `AdjustmentForm.quantity`, `DeliveryDrawer`, `ManufacturingConfigStep`, etc.
- `Step1_ProductSelection`, `Step3_Delivery`, `Step4_Receipt`, `PurchaseOrderModal.quantity`
- `InventoryContributionModal.quantity`, `PartnerWithdrawalWizard.quantity`, etc.

## Percentages/rates NOT currency (keep decimal steps)
- `VatRatesView.default_vat_rate`, `PartnerEditDrawer.partner_equity_percentage`
- `CreditLineDrawer.interest_rate/spread`, `LoanRegisterDrawer.interest_rate/penalty_rate`
- `HRSettingsView.default_amount/percentage`, `WorkflowSettings.value`
- `EmployeeDrawer.isapre_amount_uf`, `UoMDrawer.ratio`
