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
| `post_save` | `inventory` | `StockMove` | `inventory` | `handle_stock_move_updates` | Any save | Resets `cost_price` to 0 when `qty_on_hand <= 0`. Invalidates report cache. |
| `post_save` | `inventory` | `Product` | `inventory` | `product_subscription_sync` | `product_type == SUBSCRIPTION` | On create: auto-activates subscription if enabled. On update: syncs amount/period/end_date to all active subscriptions. |
| `post_save` | `tax` | `TaxPeriod` | `billing` | `mark_invoices_as_closed` | `status == CLOSED` or `OPEN` | Sets `tax_period_closed` flag on affected invoices to prevent modifications. |
| `post_save` | `tax` | `AccountingPeriod` | `accounting` | `mark_journal_entries_as_closed` | `status == CLOSED` or `OPEN` | Sets `period_closed` flag on affected JournalEntries. |
| `pre_save` | `treasury` | `PaymentTerminalProvider` | `treasury` | `_capture_provider_previous_bridge` | Any save | Captures previous `bank_treasury_account_id` for change detection. |
| `pre_save` | `treasury` | `PaymentTerminalProvider` | `treasury` | `_ensure_provider_bridge_account` | New provider without bridge | Auto-creates TreasuryAccount BRIDGE for new providers via `ProviderAccountService`. |
| `post_save` | `treasury` | `PaymentTerminalProvider` | `treasury` | `sync_settlement_on_provider_bridge_change` | Bridge account changed | Propagates new settlement account to all linked CARD_TERMINAL PaymentMethods. |
| `pre_delete` | `treasury` | `PaymentTerminalProvider` | `treasury` | `cleanup_terminal_provider_assets` | Before delete | Removes CARD_TERMINAL PaymentMethods linked to provider devices. Saves bridge account ID for post_delete cleanup. |
| `post_delete` | `treasury` | `PaymentTerminalProvider` | `treasury` | `cleanup_orphaned_treasury_account` | After delete | Deletes orphaned bridge TreasuryAccount if no longer shared and has no movement history. |
| `post_save` | `treasury` | `POSTerminal` | `treasury` | `sync_card_terminal_payment_method` | Device linked/unlinked | Auto-creates or deactivates CARD_TERMINAL PaymentMethod. Adds it to `allowed_payment_methods` of the terminal. |
| `post_save` | `treasury` | `TreasuryMovement` | `core` | `handle_treasury_movement_cache_invalidation` | Any save | Invalidates report cache for treasury and contacts. |
| `post_delete` | `treasury` | `TreasuryMovement` | `core` | `handle_treasury_movement_cache_invalidation` | Any delete | Same as post_save. |
| `pre_save` | `accounting` | `AccountingSettings` | `treasury` | `_capture_settings_previous_check_portfolio` | Any save | Captures previous `check_portfolio_account_id` for change detection in post_save. |
| `post_save` | `accounting` | `AccountingSettings` | `treasury` | `ensure_check_portfolio_treasury_account` | Check portfolio account changed | Ensures CHECK_PORTFOLIO TreasuryAccount bridge exists via `CheckService.ensure_portfolio_account`. |
| `post_save` | `contacts` | `Contact` | `contacts` | `handle_default_contact_flags` | Any save | Ensures only one contact is default customer/vendor at any time. |
| `post_save` | `sales` | `DraftCart` | `sales` | `notify_draft_update` | Any save | Sends WebSocket notification to POS session group with serialized draft data. |
| `post_delete` | `sales` | `DraftCart` | `sales` | `notify_draft_delete` | After delete | Sends WebSocket notification to POS session group with deleted draft ID. |
| `post_save` | `sales` | `SaleOrder` | `core` | `handle_sale_order_cache_invalidation` | Any save | Invalidates report cache for contacts. |
| `post_delete` | `sales` | `SaleOrder` | `core` | `handle_sale_order_cache_invalidation` | After delete | Same as post_save. |
| `post_save` | `accounting` | `JournalEntry` | `core` | `handle_accounting_cache_invalidation` | Any save | Invalidates report cache for finances. |
| `post_delete` | `accounting` | `JournalEntry` | `core` | `handle_accounting_cache_invalidation` | After delete | Same as post_save. |
| `post_save` | `accounting` | `JournalItem` | `core` | `handle_accounting_cache_invalidation` | Any save | Same as JournalEntry. |
| `post_delete` | `accounting` | `JournalItem` | `core` | `handle_accounting_cache_invalidation` | After delete | Same as JournalEntry. |
| `post_delete` | `inventory` | `StockMove` | `core` | `handle_stock_move_delete` | After delete | Invalidates report cache for inventory. |
| `post_save` | `workflow` | `Notification` | `workflow` | `push_notification_to_channels` | Created | Sends WebSocket message to user notification group via Channels. |
| `post_migrate` | `core` | — | `core` | `clear_schema_cache_on_migrate` | After migration | Clears all `schema:*` cache keys after database migrations. |

## Adding a new signal

1. Implement the `@receiver` in the relevant app's `signals.py`.
2. Ensure the receiver module is imported in `AppConfig.ready()` so the signal connects on startup.
3. Add a row to the Registry table above.
