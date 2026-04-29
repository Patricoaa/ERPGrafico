---
layer: 10-architecture
doc: workflow-signals-registry
status: active
owner: backend-team
last_review: 2026-04-23
---

# Workflow Signals Registry

Central registry for all Django signals in ERPGrafico. Purpose: maintain loose coupling between apps, provide discoverability, and enable audit of cross-domain side effects.

**Rule:** whenever you add a `@receiver` in any `signals.py`, add a row to the table below.

## Registry

| Signal | Sender app | Sender model | Receiver app | Receiver function | Trigger condition | Notes |
|--------|-----------|--------------|--------------|-------------------|-------------------|-------|
| `post_save` | `sales` | `SaleOrder` | `production` | `auto_create_work_orders` | `status == CONFIRMED` | Creates WorkOrders for manufacturable lines with advanced manufacturing. Express products handled at dispatch. |
| `post_save` | `contacts` | `Contact` | `core` | `sync_contact_to_company_settings` | Any save | Propagates name/tax_id/email/phone/address to CompanySettings if contact is linked. |
| `pre_save` | `inventory` | `Product` | `inventory` | `product_pre_save` | Any save | Captures `_old_cost_price` and `_old_sale_price` for change detection in `product_post_save`. |
| `post_save` | `inventory` | `Product` | `inventory` | `product_post_save` | Cost or sale price changed | Queues `check_product_margin_task` async via Celery. |
| `post_save` | `inventory` | `StockMove` | `inventory` | `handle_stock_move_updates` | Any save | Resets `cost_price` to 0 when `qty_on_hand <= 0`. |
| `post_save` | `inventory` | `Product` | `inventory` | `product_subscription_sync` | `product_type == SUBSCRIPTION` | On create: auto-activates subscription if enabled. On update: syncs amount/period/end_date to all active subscriptions. |
| `post_save` | `tax` | `TaxPeriod` | `billing` | `mark_invoices_as_closed` | `status == CLOSED` or `OPEN` | Sets `tax_period_closed` flag on affected invoices to prevent modifications. |
| `post_save` | `tax` | `AccountingPeriod` | `accounting` | `mark_journal_entries_as_closed` | `status == CLOSED` or `OPEN` | Sets `period_closed` flag on affected JournalEntries. |
| `pre_save` | `treasury` | `PaymentTerminalProvider` | `treasury` | `_capture_provider_previous_bridge` | Any save | Captures previous `bank_treasury_account_id` for change detection. |
| `post_save` | `treasury` | `PaymentTerminalProvider` | `treasury` | `sync_settlement_on_provider_bridge_change` | Bridge account changed | Propagates new settlement account to all linked CARD_TERMINAL PaymentMethods. |
| `post_save` | `treasury` | `POSTerminal` | `treasury` | `sync_card_terminal_payment_method` | Device linked/unlinked | Auto-creates or deactivates CARD_TERMINAL PaymentMethod. Adds it to `allowed_payment_methods` of the terminal. |

## Adding a new signal

1. Implement the `@receiver` in the relevant app's `signals.py`.
2. Ensure the receiver module is imported in `AppConfig.ready()` so the signal connects on startup.
3. Add a row to the Registry table above.
