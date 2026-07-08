---
layer: 20-contracts
doc: glosa-conventions
status: active
owner: backend-team
last_review: 2026-06-29
stability: stable
---

# Glosa Conventions — Accounting Entry Description & Item Labels

## 1. Purpose

Standardise how automatically generated journal entries (``is_manual=False``)
build their **description** (header glosa) and **item labels** so they are:

- **Descriptive** — a human can understand the transaction at a glance.
- **Uniform** — same structure regardless of the originating module.
- **Consistent** — every creation point follows the same pattern.

## 2. Architecture

All glosa construction goes through **one class**:

```
backend/accounting/glosa_builder.py  →  GlosaBuilder
```

Every service that creates a ``JournalEntry`` calls ``GlosaBuilder.build()`` for
the header description and ``GlosaBuilder.item()`` for each line label.

### Rule

> **Always use ``obj.display_id`` as the document identifier.**
> Never hardcode a prefix — each model already defines its canonical ``display_id``.

---

## 3. Entry Description (Glosa) Format

```
ACCIÓN | DOCUMENTO | PARTNER | $MONTO | EXTRA
```

| Part | Required | Source | Example |
|------|----------|--------|---------|
| `ACCIÓN` | ✅ | Standardised verb (see §6) | `Venta` |
| `DOCUMENTO` | ❌ | ``obj.display_id`` | `FACV-123` |
| `PARTNER` | ❌ | ``contact.name``, ``supplier.name``, etc. | `Cliente ACME` |
| `MONTO` | ❌ | ``obj.total`` — formatted ``$1.234.567`` | `$1.500.000` |
| `EXTRA` | ❌ | Period, reason, etc. | `Período Ene-2026` |

**Separator:** `` | `` (space-pipe-space).

**Max length:** 255 characters.

**Truncation order** — rightmost parts are sacrificed first:

```
extra → monto → partner → documento → acción
```

### Examples

```
Venta | FACV-123 | Cliente ACME | $1.500.000
Compra | FACC-456 | Proveedor XYZ | $2.300.000
Costo de Venta | DES-78 | Cliente ACME | $850.000
Recepción | REC-111 | Proveedor XYZ | $1.200.000
Ingreso | DEP-42 | Cliente ACME | Pago Factura | $500.000
Remuneraciones | LIQ-15 | Juan Pérez | Ene-2026 | $1.800.000
Castigo | NV-88 | Cliente ACME | $300.000
Apertura | Ejercicio 2026
```

---

## 4. Reversal Entries

Reversals follow the same structure but with a clear prefix:

```
Anulación DOCUMENTO: ACCIÓN | PARTNER | $MONTO
```

The original action is kept so the reader can identify what is being reversed.

**Item labels** in reversals:

```
Anulación ROL: DETALLE (DOC_REF)
```

---

## 5. Item Label Format

```
ROL: DETALLE (DOC_REF)
```

| Part | Required | Example |
|------|----------|---------|
| `ROL` | ✅ | Standardised role (see §7) |
| `DETALLE` | ❌ | Product code, partner name, concept |
| `DOC_REF` | ❌ | Document identifier in parentheses |

**Max length:** 255 characters.

### Examples

```
Cuenta por Cobrar: Cliente ACME (FACV-123)
Ingreso: PROD-A-001 (FACV-123)
IVA Débito (FACV-123)
Inventario: PROD-A-001 (REC-111)
Puente Recepción (OCS-45)
Costo de Venta (DES-78)
Gasto Interés: Ene-2026 (CRE-42)
Capital por Cobrar: Juan Pérez (NV-88)
```

---

## 6. Standardised Actions

| Constant | Action string | Used by |
|----------|--------------|---------|
| ``VENTA`` | `Venta` | Sale invoice |
| ``COMPRA`` | `Compra` | Purchase invoice |
| ``NOTA_CREDITO`` | `Nota de Crédito` | Credit notes |
| ``NOTA_DEBITO`` | `Nota de Débito` | Debit notes |
| ``COSTO_DE_VENTA`` | `Costo de Venta` | Delivery COGS |
| ``CONCILIACION_ANTICIPOS`` | `Conciliación Anticipos` | Advance/prepayment reconciliation |
| ``RECEPCION`` | `Recepción` | Purchase receipt |
| ``DEVOLUCION`` | `Devolución` | Purchase receipt return / sale return |
| ``DEVOLUCION_FISICA`` | `Devolución Física` | Physical purchase return |
| ``INGRESO`` | `Ingreso` | Treasury INBOUND |
| ``EGRESO`` | `Egreso` | Treasury OUTBOUND |
| ``TRANSFERENCIA`` | `Transferencia` | Treasury TRANSFER |
| ``LIQUIDACION_TC`` | `Liquidación TC` | Terminal batch settlement |
| ``CARGOS_FINANCIEROS`` | `Cargos Financieros` | Credit card charges |
| ``CARGOS_DIFERIDOS`` | `Cargos Diferidos TC` | Deferred card charges |
| ``DESEMBOLSO`` | `Desembolso` | Loan disbursement |
| ``PAGO_CUOTA`` | `Pago Cuota` | Loan installment payment |
| ``DEVENGO_INTERESES`` | `Devengo Intereses` | Monthly interest accrual |
| ``AJUSTE_BANCARIO`` | `Ajuste Bancario` | Bank reconciliation difference |
| ``SUSCRIPCION_CAPITAL`` | `Suscripción Capital` | Capital subscription |
| ``APORTE_CAPITAL`` | `Aporte Capital` | Capital contribution (cash) |
| ``REDUCCION_CAPITAL`` | `Reducción Capital` | Capital reduction |
| ``TRANSFERENCIA_CAPITAL`` | `Transferencia Capital` | Equity transfer between partners |
| ``PAGO_DIVIDENDOS`` | `Pago Dividendos` | Dividend payment |
| ``RETIRO_PROVISORIO`` | `Retiro Provisorio` | Provisional withdrawal |
| ``MOVILIZACION_RETENIDAS`` | `Movilización Retenidas` | Retained earnings mobilisation |
| ``DISTRIBUCION_RESULTADOS`` | `Distribución Resultados` | Profit distribution |
| ``REMUNERACIONES`` | `Remuneraciones` | Payroll posting |
| ``CASTIGO`` | `Castigo` | Debt write-off |
| ``RECUPERACION_CASTIGO`` | `Recuperación Castigo` | Written-off debt recovery |
| ``AJUSTE_STOCK`` | `Ajuste Stock` | Inventory adjustment |
| ``CONSUMO_PRODUCCION`` | `Consumo Producción` | Work order material consumption |
| ``APERTURA`` | `Apertura` | Fiscal year opening |
| ``CIERRE_ANUAL`` | `Cierre Anual` | Fiscal year closing |
| ``DEVOLUCION_PAGO`` | `Devolución Pago` | Payment return |
| ``PAGO_F29`` | `Pago F29` | Tax payment |
| ``ANULACION_FACTURA`` | `Anulación Factura` | Invoice annulment reversal |

When a new automatic entry is created, a new constant **must** be added to
``GlosaBuilder`` and documented here.

---

## 7. Standardised Roles (for item labels)

| Constant | Role string | Use |
|----------|-------------|-----|
| ``CXC`` | `Cuenta por Cobrar` | Debit on sale invoices / credit on payments |
| ``CXP`` | `Cuenta por Pagar` | Credit on purchase invoices / debit on payments |
| ``INGRESO`` | `Ingreso` | Revenue / income accounts |
| ``IVA_DEBITO`` | `IVA Débito` | VAT payable (sales) |
| ``IVA_CREDITO`` | `IVA Crédito` | VAT receivable (purchases) |
| ``IVA_CAPITALIZADO`` | `IVA Capitalizado` | Capitalised VAT (boletas) |
| ``IVA_NO_RECUPERABLE`` | `IVA No Recuperable` | Non-recoverable VAT |
| ``COSTO_VENTA`` | `Costo de Venta` | COGS accounts |
| ``INVENTARIO`` | `Inventario` | Inventory accounts |
| ``PUENTE_RECEPCION`` | `Puente Recepción` | Stock input bridge (clearing) |
| ``GASTO`` | `Gasto` | Expense accounts |
| ``CAPITAL_COBRAR`` | `Capital por Cobrar` | Capital receivable (partner) |
| ``CAPITAL_SOCIAL`` | `Capital Social` | Social capital (equity) |
| ``CAPITAL_EXCEDENTE`` | `Capital Excedente` | Capital surplus |
| ``DIVIDENDO_PAGAR`` | `Dividendo por Pagar` | Dividends payable |
| ``RETIRO_PROVISORIO`` | `Retiro Provisorio` | Provisional withdrawals |
| ``RETENIDAS`` | `Utilidades Retenidas` | Retained earnings |
| ``REINVERSION`` | `Reinversión Capital` | Capital reinvestment |
| ``REMUNERACION_PAGAR`` | `Remuneración por Pagar` | Salaries payable |
| ``OBLIGACIONES_PREVIRED`` | `Obligaciones Previred` | Social security payable |
| ``PERDIDA_INCOBRABLE`` | `Pérdida Incobrable` | Bad debt loss |
| ``RECUPERACION_INCOBRABLE`` | `Recuperación Incobrable` | Recovered bad debt income |
| ``COMISION`` | `Comisión` | Commission expense |
| ``ANTICIPO`` | `Anticipo` | Advance payment account |
| ``INTERES`` | `Gasto Interés` | Interest expense |
| ``SEGURO`` | `Gasto Seguro` | Insurance expense |
| ``PENALIZACION`` | `Penalización` | Penalty / late fee |
| ``BANCO`` | `Banco` | Bank accounts |
| ``EFECTIVO`` | `Efectivo` | Cash / treasury accounts |
| ``IVA_PAGAR`` | `IVA por Pagar` | VAT payable (net after F29) |
| ``IVA_REMANENTE`` | `IVA Remanente` | VAT credit carry-forward |
| ``RESULTADO`` | `Resultado` | P&L result account |
| ``PROVISION_PPM`` | `Provisión PPM` | Monthly tax provision |
| ``CIERRE_IVA`` | `Cierre IVA` | VAT closing entry |
| ``CIERRE_RETENCIONES`` | `Cierre Retenciones` | Withholdings closing |
| ``CONSUMO`` | `Consumo` | Material consumption (production) |
| ``COSTO_PRODUCCION`` | `Costo Producción` | Production cost |
| ``PASIVO_PRESTAMO`` | `Pasivo Préstamo` | Loan liability |
| ``PASIVO_TC`` | `Pasivo TC` | Credit card payable |
| ``INTERES_PAGAR`` | `Interés por Pagar` | Interest payable (accrued) |
| ``APERTURA_CTA`` | `Apertura` | Opening entry account |
| ``CIERRE_CTA`` | `Cierre` | Closing entry account |

---

## 8. Usage in Python Code

### Creating an entry

```python
from accounting.glosa_builder import GlosaBuilder

description = GlosaBuilder.build(
    action=GlosaBuilder.VENTA,
    document=invoice.display_id,
    partner=order.customer.name,
    amount=invoice.total,
    extra=[f"Pedido {order.display_id}"],
)

items = [
    {
        "account": receivable_account,
        "debit": invoice.total,
        "credit": 0,
        "label": GlosaBuilder.item(Roles.CXC, order.customer.name, invoice.display_id),
    },
    {
        "account": revenue_account,
        "debit": 0,
        "credit": invoice.total_net,
        "label": GlosaBuilder.item(Roles.INGRESO, product.code, invoice.display_id),
    },
]

entry = JournalEntryService.create_entry(
    {"date": ..., "description": description, "is_manual": False, ...},
    items,
)
```

### Creating a reversal

```python
JournalEntryService.reverse_entry(
    entry,
    description=GlosaBuilder.build_reversal(entry.description, doc=invoice.display_id),
)
```

> The reversal engine in ``JournalEntryService.reverse_entry`` already prepends
> ``Anulación {rol}: …`` to item labels, so only the header description needs
> the ``build_reversal`` call.

---

## 9. Implementation Checklist for New Entry Points

When adding a new automatic ``JournalEntry`` creation point:

- [ ] Add a standardised action constant (if it doesn't exist) to ``GlosaBuilder``.
- [ ] Add a standardised role (if needed) to the ``Roles`` class.
- [ ] Update ``docs/20-contracts/glosa-conventions.md`` with the new constants.
- [ ] Use ``GlosaBuilder.build()`` for the header description.
- [ ] Use ``GlosaBuilder.item()`` for each line label.
- [ ] Use ``obj.display_id`` — never hardcode a prefix.
- [ ] Run ``pytest`` on the affected app to verify tests pass.
