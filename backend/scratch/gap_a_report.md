# GAP A Violations Sweep

## 1. Vistas con más de 20 líneas

### workflow
- `get_queryset`: 26 líneas
### production
- `_build_stock_context`: 24 líneas
- `update`: 38 líneas
- `destroy`: 33 líneas
- `rectify`: 28 líneas
- `transition`: 48 líneas
- `restart`: 52 líneas
- `add_material`: 34 líneas
- `update_material`: 27 líneas
- `comments`: 30 líneas
- `create_manual`: 53 líneas
### tax
- `create`: 26 líneas
- `register`: 21 líneas
- `documents`: 22 líneas
### hr
- `pay_previred`: 30 líneas
- `pay_salary`: 30 líneas
- `perform_create`: 23 líneas
### sales
- `current`: 27 líneas
- `cancel_impact`: 39 líneas
- `partial_dispatch`: 24 líneas
- `register_note`: 50 líneas
- `register_merchandise_return`: 45 líneas
- `comments`: 37 líneas
### billing
- `create_from_order`: 37 líneas
- `_parse_pos_checkout_params`: 82 líneas
- `pos_checkout`: 45 líneas
- `request_credit`: 21 líneas
- `process_logistics`: 36 líneas
### inventory
- `stock_report`: 26 líneas
- `bulk_clone_bom`: 24 líneas
- `bulk_set_surcharge`: 30 líneas
- `effective_price`: 26 líneas
- `stock_level`: 21 líneas
- `adjust`: 66 líneas
### accounting
- `update`: 24 líneas
- `close`: 22 líneas
### treasury
- `get_queryset`: 108 líneas
- `create`: 35 líneas
- `card_purchase`: 47 líneas
- `register_return`: 37 líneas
- `allocate`: 34 líneas
- `import_statement`: 61 líneas
- `dry_run`: 42 líneas
- `auto_match_status`: 42 líneas
- `confirm`: 29 líneas
- `get_queryset`: 52 líneas
- `match_group`: 21 líneas
- `bulk_exclude`: 27 líneas
- `confirm`: 21 líneas
- `close_session`: 27 líneas
- `register_manual_movement`: 44 líneas
- `list`: 27 líneas
- `register_transfer`: 28 líneas
- `create`: 48 líneas
- `generate_invoice`: 37 líneas
- `perform_create`: 45 líneas
- `disburse`: 27 líneas
- `prepay`: 32 líneas
- `schedule`: 53 líneas
- `pay`: 50 líneas
- `pay`: 26 líneas
- `apply_charges`: 35 líneas
- `reapply_charges`: 36 líneas
- `unbilled_charges`: 29 líneas
- `update_charge`: 45 líneas
- `analytics`: 32 líneas
- `charges`: 75 líneas
### contacts
- `insights`: 42 líneas
- `credit_ledger`: 68 líneas
- `credit_portfolio`: 30 líneas
- `write_off_debt`: 21 líneas
- `recover_written_off_debt`: 27 líneas
- `partner_statement`: 33 líneas
- `individual_dividend_payment`: 24 líneas
- `partner_transactions`: 69 líneas
- `equity_subscription`: 65 líneas
- `equity_transfer`: 37 líneas
- `initial_setup`: 26 líneas
- `mass_mobilize_retained_earnings`: 67 líneas
### purchasing
- `receive`: 22 líneas
- `partial_receive`: 21 líneas
- `partial_return`: 24 líneas
- `register_note`: 29 líneas
- `_parse_purchase_checkout`: 42 líneas
- `purchase_checkout`: 26 líneas
### core
- `system_status`: 21 líneas
- `post`: 54 líneas
- `get`: 66 líneas
- `get`: 23 líneas
- `post`: 33 líneas
- `post`: 35 líneas
- `destroy`: 22 líneas
- `get`: 61 líneas

*Total de vistas largas: 93*

## 2. Lógica de negocio directa en vistas (`.save()`, `objects.create()`)

### workflow
- Línea 75: `updated_task.save(update_fields=["completed_by", "completed_at"])`
- Línea 117: `notif.save()`
### production
- Línea 495: `material.save()`
- Línea 587: `comment = Comment.objects.create(`
### tax
- Línea 156: `updated_declaration.save()`
### hr
- Línea 182: `payroll.save(update_fields=["base_salary"])`
### sales
- Línea 41: `obj = SalesSettings.objects.create()`
- Línea 543: `comment = Comment.objects.create(`
### inventory
- Línea 493: `sub.save()`
- Línea 500: `sub.save()`
### accounting
- Línea 68: `obj = AccountingSettings.objects.create()`
### treasury
- Línea 96: `bank.save(update_fields=["is_active", "updated_at"])`
- Línea 104: `bank.save(update_fields=["is_active", "updated_at"])`
- Línea 998: `statement.save()`
### contacts
- Línea 278: `contact.save()`
- Línea 424: `contact.save()`
- Línea 562: `contact.save()`
### core
- Línea 271: `user.save()`
- Línea 314: `user.save()`
- Línea 354: `instance.save()`
- Línea 399: `obj = CompanySettings.objects.create(name="Mi Empresa")`

*Total de violaciones lógicas directas detectadas: 21*
