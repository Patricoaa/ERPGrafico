---
layer: 00-context
doc: domain-glossary
status: active
owner: core-team
last_review: 2026-04-21
---

# Domain Glossary

Definitive vocabulary. When a term appears in code or docs, use this meaning — do not redefine.

## Orders family

| Term | Definition | Backend entity |
|------|------------|----------------|
| **SaleOrder** | Commitment to deliver goods/services to customer | `sales.SaleOrder` |
| **PurchaseOrder** | Commitment to acquire goods/services from supplier | `purchasing.PurchaseOrder` |
| **WorkOrder** | Production job on shop floor, linked to SaleOrder | `production.WorkOrder` |
| **Order hub** | Frontend aggregate view over the 3 above — NOT a backend entity | `features/orders` only |

## Financial

| Term | Definition |
|------|------------|
| **Folio** | Fiscal sequential number on invoices/receipts. Validated for gaps |
| **Period** | Fiscal period (month/year). Closed periods reject new entries |
| **Reconciliation** | Match bank statement lines with internal transactions |
| **Journal entry** | Double-entry accounting record (debit = credit) |

## Payments & POS (UI terms — Spanish, canonical)

| UI term | Definition | Backend entity |
|---------|------------|----------------|
| **Terminal de cobro** | Card-payment device (e.g. TUU) linked to a provider; captures card sales | `treasury.PaymentTerminalDevice` |
| **Proveedor de terminal de cobro** | Company operating the terminals; owns the bridge/settlement account and commissions | `treasury.PaymentTerminalProvider` |
| **Lote de terminal de cobro** | Daily settlement batch reported by the provider | `treasury.TerminalBatch` |
| **Venta de terminal de cobro** | One sale captured by a TUU terminal, synced read-only from the TUU report APIs (cash or card, DTE type, commission, settlement) | `treasury.TerminalSale` |
| **Sincronización TUU** | One execution that downloads the TUU reports for a provider and date range, storing raw responses and upserting sales | `treasury.TerminalSyncRun` (+ `TerminalSyncPayload`, settings `TerminalSyncSettings`) |
| **Tarjeta (terminal de cobro)** | Payment method type for card sales through a terminal de cobro | `PaymentMethod.Type.CARD_TERMINAL` |
| **Caja POS** | Point-of-sale register (cash drawer + allowed payment methods). NOT a terminal de cobro | `treasury.POSTerminal` |
| **Sesión de POS** | Open/close period of a Caja POS (apertura, cierre, arqueo). Use "sesión de POS" in wizards, toasts and errors — never bare "Cerrar sesión" (reads as logout) nor "sesión de caja". Only the opener or a superuser can close it | `treasury.POSSession` |

Inside the "Terminal de cobro" section, sub-tab labels may be shortened ("Proveedores", "Terminales", "Lotes") because the section header gives the context.

## Production

| Term | Definition |
|------|------------|
| **Route** | Sequence of operations to produce an item |
| **Operation** | Single step on route (e.g. "cut", "print", "bind") |
| **Machine** | Physical resource executing operations |

## Workflow

| Term | Definition |
|------|------------|
| **State machine** | Defined in `workflow` app, governs entity transitions |
| **Transition** | Named edge between states, may require permissions |
| **Approval** | Transition gated by user role check |

## Frontend-specific

| Term | Definition |
|------|------------|
| **Feature** | Self-contained module under `features/[name]/` |
| **Barrel** | `features/[name]/index.ts` — only public entry point |
| **Contract** | Signed API (component props, hook return, endpoint schema) |
| **Shared component** | Promoted to `/components/shared/`, reused ≥3 modules |

## Ambiguity flags

Terms NOT to use (use canonical left column instead):

| Avoid | Use |
|-------|-----|
| "Invoice order" | SaleOrder or Invoice (distinct) |
| "Job" | WorkOrder (if shop floor) or Celery task (if async code) |
| "Status" (bare) | Entity-specific state, see [state-map](../20-contracts/state-map.md) |
| "Client" | Customer (business) or frontend (code) — disambiguate |
| "Dispositivo (de pago / integrado)", "hardware", "maquinita", "datáfono", "terminal de pago" | Terminal de cobro |
| "Proveedor de pago", "proveedor de terminal" | Proveedor de terminal de cobro |
| "Lote de pago", "lote terminal" | Lote de terminal de cobro |
| "Terminal" (bare, for a POS register) | Caja POS |
