# Cuadre fiscal DTE (ADR-0138) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el registro DTE local (`billing.Invoice`) sea la única fuente contable y se cuadre automáticamente contra las ventas TUU (`TerminalSale`) y el RCV del SII (`RCVDocument`/`RCVImportSummary`), corrigiendo antes cómo el checkout de venta decide 39 vs 48.

**Architecture:**
- **Fase 1:** una clave fiscal normalizada de `Invoice`.
- **Fase 2:** el checkout de venta deriva el tipo de documento del pago, divide el pago mixto en documentos proporcionales y deja de inventar folios.
- **Fases 3 y 4:** servicios de cuadre idempotentes en `tax/reconciliation/` escriben un vínculo y un `match_status` en `TerminalSale` y `RCVDocument`. Corren al final de cada sincronización o importación.
- **Fase 5:** un reporte por período alimenta una pestaña «Cuadre» y la compuerta sugerida del F29.
- **Fase 6:** el RCV completa borradores de compra.

**Tech Stack:** Django 5 + DRF, Celery, PostgreSQL; Next.js 16, TanStack Query, Zod, react-hook-form, `@/components/entity-view`.

**Spec:** `docs/10-architecture/adr/0138-registro-dte-local-con-control-fiscal-externo.md` (Accepted). Contexto: `docs/superpowers/specs/2026-11-14-rcv-importacion-simpleapi-design.md`, `docs/superpowers/specs/2026-11-13-tuu-sincronizacion-ventas-terminal-design.md`.

**Decisiones del usuario (2026-11-15) que el ADR dejaba abiertas:**
- Pago mixto con boleta: las líneas se reparten **en proporción** al monto de cada documento. La cantidad lleva 2 decimales y el último documento absorbe el redondeo.
- Histórico: se cuadra **desde una fecha configurable** (`fiscal_match_start_date`). Los documentos anteriores no se evalúan ni se modifican.

**Valores por defecto fijados en este plan:**
- Ventana del cuadre TUU: 15 minutos.
- Tolerancia de monto: 0 (CLP enteros).
- «Total parecido» para completar borradores: diferencia ≤ 2 %.
- Clase boleta exenta con terminal integrado: queda como 41 y no se convierte en 48. Si TUU dice 48, el cuadre lo marca `TYPE_DIFF`.

## Global Constraints

- Las 14 invariantes de `CLAUDE.md` aplican a todas las tareas. Las que más se tocan aquí:
  - **Zero `any`** en TypeScript.
  - **Solo tokens semánticos** de color.
  - **Vistas Django ≤ 20 líneas**; la lógica va en servicios.
  - **`StatusBadge`** es el único renderer de estados.
  - **Colecciones con `defineEntity` + `@/components/entity-view`.**
  - **Formularios con `react-hook-form` + `zodResolver`.**
  - **Zero N+1:** todo endpoint de lista o reporte nuevo lleva un test de query count constante.
- Comando backend (desde `backend/`): `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q`.
- Comando frontend (desde `frontend/`, Node 24 vía nvm): `npm run test -- <ruta>`. La DoD de cada tarea de frontend incluye `npm run type-check` y `npm run lint`.
- Hooks con `useEffect`/`useRef` llevan `"use client"`.
- Trabajar en la rama `feat/cuadre-fiscal-dte`. Los mensajes de commit van en español con el formato `tipo(app): ...`.
- `Invoice` solo genera contabilidad. `TerminalSale`, `RCVDocument` y `RCVImportSummary` nunca crean asientos, pagos ni documentos sin una confirmación explícita del usuario (ADR-0138 D1, D8).
- Un documento `POSTED` no se modifica para cuadrar (ADR-0091). El cuadre solo escribe en los registros externos.
- Valores de `MatchStatus`, exactos: `MATCHED`, `AMOUNT_DIFF`, `TYPE_DIFF`, `AMBIGUOUS`, `ONLY_EXTERNAL`, `ONLY_ERP`, `EXCLUDED`. El valor `""` significa «no evaluado».
- `FOLIO_EXEMPT_DTE_TYPES = ("BOLETA", "BOLETA_EXENTA", "COMPROBANTE_PAGO")`.
- Tipos que se cuadran documento por documento: SII 33, 34, 56, 61. Por resumen mensual: 39, 41, 48. No soportados, siempre `EXCLUDED`: cualquier código fuera de `SII_CODE_TO_DTE_TYPE` (`billing/models.py:27`).
- Copia de UI en español: «Cuadre fiscal», «Cuadrado», «Diferencia de monto», «Diferencia de tipo», «Ambiguo», «Falta en el ERP», «Falta en el SII/TUU», «Excluido».

## Review Focus

1. **Pago mixto con vuelto o sobrepago:** efectivo recibido mayor que el saldo, o tarjeta por más que el total. Ningún documento puede superar el total de la OV, y la suma de los documentos es exactamente el total. Test en la tarea 3.
2. **Boleta con abono parcial con tarjeta y el resto a crédito:** el saldo impago va al 39, no se pierde ni crea un 48 por más de lo cobrado. Test en la tarea 3.
3. **Dos ventas TUU del mismo monto dentro de la misma ventana y en el mismo dispositivo:** ambas quedan `AMBIGUOUS`, nunca se enlazan solas por cercanía. Test en la tarea 8.
4. **Recalcular el cuadre después de un vínculo manual:** las filas con `matched_manually=True` no cambian. Tests en las tareas 8 y 11.
5. **Factura de compra con folio con ceros a la izquierda (`"000123"`) y RUT con puntos y DV en minúscula:** cuadra contra el RCV (`123`, `"8973356-K"`). Tests en las tareas 1 y 11.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/billing/fiscal_key.py` (nuevo) | `FiscalKey`, `invoice_direction`, `fiscal_key`, `parse_folio`, `fiscal_direction_expression` |
| `backend/billing/sale_documents.py` (nuevo) | Resolver puro clase + pagos → documentos; `folio_exempt_for_session` |
| `backend/billing/line_split.py` (nuevo) | Reparto proporcional de líneas y totales (puro) |
| `backend/billing/services.py` | `create_sale_invoice` con porción y sin folio inventado; `_pos_checkout_internal` multi-documento |
| `backend/billing/models.py` | `display_id` sin folio |
| `backend/core/fiscal_match.py` (nuevo) | `MatchStatus` compartido |
| `backend/tax/reconciliation/{__init__,terminal,rcv,report,feeding}.py` (nuevos) | Cuadre TUU, cuadre RCV, reporte del período, alimentación |
| `backend/tax/reconciliation_views.py`, `tax/reconciliation_serializers.py` (nuevos) | Endpoints |
| `backend/treasury/models.py`, `accounting/models.py` | Campos de cuadre y configuración |
| `backend/treasury/tasks.py`, `accounting/tasks.py` | Disparar el cuadre tras sincronizar o importar |
| `backend/tax/services.py` | F29 con la dirección compartida; `fiscal_mismatches` en `status_check` |
| `frontend/features/tax/…` | Vista «Cuadre fiscal», hooks y api |
| `frontend/features/treasury/…`, `features/accounting/…` | Columnas y acciones de cuadre en ventas TUU y documentos RCV; ajustes |
| `frontend/features/sales/components/checkout/…` | Copy de clase boleta; éxito con varios documentos |

---

# Fase 1 — Clave fiscal

### Task 1: `FiscalKey` y dirección fiscal única

**Files:**
- Create: `backend/billing/fiscal_key.py`
- Modify: `backend/tax/services.py:98-104` (usar la expresión compartida en lugar del `Case` local `is_sale`)
- Test: `backend/billing/tests/test_fiscal_key.py`, `backend/tax/tests/test_f29_aggregation.py` (agregar un caso)

**Interfaces:**
- Produces:
  - `parse_folio(number: str | None) -> int | None`: quita espacios, puntos y ceros a la izquierda. Si el resultado no es un entero positivo, devuelve `None`.
  - `invoice_direction(invoice: Invoice) -> Literal["purchase", "sale"]`. Reglas en orden:
    1. `purchase_order_id` o `dte_type == PURCHASE_INV` → `"purchase"`;
    2. `sale_order_id` → `"sale"`;
    3. `corrected_invoice_id` → la dirección de `corrected_invoice`;
    4. en otro caso → `"sale"` (igual que `Invoice.is_sale_document`).
  - `fiscal_direction_expression() -> Case`: la misma regla como expresión ORM. Anota `"purchase"`/`"sale"` y la regla 3 mira `corrected_invoice__purchase_order` y `corrected_invoice__dte_type`.
  - `@dataclass(frozen=True) FiscalKey(direction: str, sii_code: int, folio: int | None, counterparty_rut: str)`.
  - `fiscal_key(invoice: Invoice) -> FiscalKey`: `sii_code` sale de `invoice.sii_code`, de modo que `PURCHASE_INV` y `FACTURA`+OC dan 33. `counterparty_rut` es `normalize_rut(partner_tax_id_snapshot or contact.tax_id)`, con `normalize_rut` importado de `accounting.integrations.rcv_normalizer`.
  - `FISCAL_KEY_RELATED = ("corrected_invoice", "contact")`: lo que un llamador por lote debe pasar a `select_related` para que `fiscal_key` no consulte por fila.

- [ ] **Step 1: Write the failing tests** en `test_fiscal_key.py`:
  - `test_parse_folio_strips_zeros_and_dots`: `parse_folio("000123") == 123`, `parse_folio("1.234") == 1234`, `parse_folio("") is None`, `parse_folio("ABC") is None`, `parse_folio("0") is None`.
  - `test_purchase_inv_and_factura_with_po_share_key`: dos facturas de compra (una `PURCHASE_INV` y otra `FACTURA` con `purchase_order`, mismo folio `"55"` y mismo RUT) dan claves iguales: `FiscalKey("purchase", 33, 55, "8973356-K")`.
  - `test_rut_is_normalized`: un snapshot `"8.973.356-k"` produce `"8973356-K"`.
  - `test_note_inherits_direction_from_corrected_invoice`: una NC con `corrected_invoice` de compra y sin órdenes da `"purchase"`.
  - `test_standalone_invoice_is_sale`: sin órdenes ni documento corregido da `"sale"`.
  - `test_expression_matches_python_rule`: se anota un queryset con `fiscal_direction_expression()` sobre los cinco casos anteriores y el valor coincide con `invoice_direction` en cada uno.
- [ ] **Step 2: Run** `…pytest billing/tests/test_fiscal_key.py -q`. Expected: FAIL (`ModuleNotFoundError: billing.fiscal_key`).
- [ ] **Step 3: Implement** `billing/fiscal_key.py` con las interfaces de arriba.
- [ ] **Step 4: Run** de nuevo. Expected: PASS.
- [ ] **Step 5: Write the failing test** `test_standalone_sale_invoice_counts_as_sale` en `tax/tests/test_f29_aggregation.py`: una `FACTURA` `POSTED` sin `sale_order` (por ejemplo, creada por nota manual) suma en `sales_taxed`, no en `purchases_taxed`. Hoy falla porque `F29CalculationService` usa `sale_order__isnull`.
- [ ] **Step 6: Replace** en `tax/services.py` el `Case(When(sale_order__isnull=False…))` por `fiscal_direction_expression()` y compara `row["direction"] == "sale"`. Run `…pytest tax/tests -q`. Expected: PASS (todo el módulo).
- [ ] **Step 7: Commit** `feat(billing): clave fiscal de Invoice y dirección fiscal única (ADR-0138 D2)`.

---

# Fase 2 — Documento de venta derivado del pago

### Task 2: Reparto proporcional de líneas y totales

**Files:**
- Create: `backend/billing/line_split.py`
- Test: `backend/billing/tests/test_line_split.py`

**Interfaces:**
- Produces:
  - `split_proportional(value: Decimal, amounts: list[Decimal]) -> list[Decimal]`: reparte un entero CLP en proporción a `amounts`. Cada parte, salvo la última, es `floor(value * a / sum(amounts))`; la última es lo que queda. Si `sum(amounts) == 0`, todo va a la primera.
  - `@dataclass(frozen=True) LineAmount(key: int, quantity: Decimal, subtotal: Decimal)`.
  - `@dataclass(frozen=True) LineShare(key: int, quantity: Decimal, subtotal: Decimal)`.
  - `split_lines(lines: list[LineAmount], amounts: list[Decimal]) -> list[list[LineShare]]`: una lista por monto, en el mismo orden. Invariantes:
    - **Filas:** por cada `key`, la suma de los subtotales repartidos es igual al subtotal de la línea, y la suma de las cantidades es igual a la cantidad de la línea.
    - **Columnas:** la suma de subtotales de la porción `i` es igual a `amounts[i]`, siempre que `sum(amounts) == sum(subtotales)`.
    - Una línea con `subtotal == 0` va completa a la porción 0.
    - Las cantidades se cuantizan a `0.01`.
- Algoritmo (no lo determina la firma). Para cada porción `i < n-1`:
  1. base por línea = `floor(restante_línea * amounts[i] / restante_total)`;
  2. reparte el residuo `amounts[i] - Σbase` de a 1 peso entre las líneas con mayor parte fraccionaria, sin pasar el restante de cada línea;
  3. la cantidad de la línea = `cantidad_restante * share / subtotal_restante`, cuantizada.

  La última porción toma todo lo restante de cada línea, cantidad y subtotal.

- [ ] **Step 1: Write the failing tests:**
  - `test_single_amount_is_identity`: un solo monto igual al total devuelve las líneas tal cual.
  - `test_rows_and_columns_sum_exactly`: líneas `[(1, 3, 10000), (2, 1, 3333), (3, 2, 1)]` y montos `[6000, 7334]`. Por fila, Σsubtotal y Σcantidad son iguales a los de la línea; por columna, Σsubtotal es `[6000, 7334]`.
  - `test_zero_subtotal_line_goes_to_first`.
  - `test_quantities_have_two_decimals`: ninguna cantidad tiene más de 2 decimales.
  - `test_split_proportional_last_absorbs`: `split_proportional(Decimal(1597), [Decimal(6000), Decimal(4000)]) == [Decimal(958), Decimal(639)]`.
- [ ] **Step 2: Run** `…pytest billing/tests/test_line_split.py -q`. Expected: FAIL (import).
- [ ] **Step 3: Implement** `billing/line_split.py`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(billing): reparto proporcional de líneas para documentos divididos`.

### Task 3: Resolver clase de documento + pagos → documentos

**Files:**
- Create: `backend/billing/sale_documents.py`
- Test: `backend/billing/tests/test_sale_documents.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) PaymentPortion(amount: Decimal, integrated: bool, index: int | None)`. `index` es la posición en la lista `payments` del checkout; `None` en el flujo de pago único.
  - `@dataclass(frozen=True) DocumentPlan(dte_type: str, amount: Decimal, payment_indexes: tuple[int | None, ...])`.
  - `plan_sale_documents(document_class: str, portions: list[PaymentPortion], order_total: Decimal) -> list[DocumentPlan]`. Reglas:
    - **Clase `FACTURA`, `FACTURA_EXENTA` o `BOLETA_EXENTA`:** un solo plan de ese tipo, por `order_total`, con todos los índices.
    - **Clase `BOLETA`:**
      - `integrated = min(Σ portions integrados, order_total)`;
      - si `integrated > 0`, un plan `COMPROBANTE_PAGO` por `integrated` con los índices integrados;
      - si `order_total - integrated > 0` o no hay porciones, un plan `BOLETA` por el resto con los índices no integrados. El saldo impago o a crédito queda en el 39.
    - **Orden de la lista:** el de mayor monto primero; si empatan, va primero `BOLETA`. El primero es el «documento principal» que devuelve el checkout.
    - **Clase no reconocida:** `ValidationError`.
  - `folio_exempt_for_session(pos_session_id: int | None) -> bool`: `True` si la sesión existe y su `terminal.allowed_payment_methods` tiene algún método con `method_type == CARD_TERMINAL` y `linked_terminal_device` no nulo (`PaymentMethod.is_integrated`). Usa una sola consulta con `exists()`.
  - `FOLIO_EXEMPT_DTE_TYPES` (Global Constraints).

- [ ] **Step 1: Write the failing tests:**
  - `test_cash_only_boleta`: `[(10000, False, 0)]` → `[DocumentPlan("BOLETA", 10000, (0,))]`.
  - `test_integrated_only_is_48`: `[(10000, True, 0)]` → `[DocumentPlan("COMPROBANTE_PAGO", 10000, (0,))]`.
  - `test_mixed_splits`: `[(6000, True, 0), (4000, False, 1)]`, total 10000 → `[("COMPROBANTE_PAGO", 6000, (0,)), ("BOLETA", 4000, (1,))]`.
  - `test_overpayment_capped` (Review Focus 1): `[(12000, True, 0)]`, total 10000 → un solo `COMPROBANTE_PAGO` por 10000. Con `[(8000, True, 0), (5000, False, 1)]` y total 10000 → 48 por 8000 y 39 por 2000.
  - `test_partial_card_rest_on_credit` (Review Focus 2): `[(3000, True, 0)]`, total 10000 → 39 por 7000 primero y 48 por 3000 después.
  - `test_factura_ignores_terminal`: clase `FACTURA` con `[(10000, True, 0)]` → `[("FACTURA", 10000, (0,))]`.
  - `test_boleta_exenta_never_48`.
  - `test_no_portions_boleta`: `[]`, total 5000 → `[("BOLETA", 5000, ())]`.
  - `test_folio_exempt_for_session` (con BD): `True` con un método integrado en el terminal de la sesión; `False` sin él; `False` con `None`.
- [ ] **Step 2: Run** `…pytest billing/tests/test_sale_documents.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** `billing/sale_documents.py`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(billing): resolver del documento de venta según medio de pago (ADR-0138 D3)`.

### Task 4: `create_sale_invoice` por porción y sin folio inventado

**Files:**
- Modify: `backend/billing/services.py:491-647` (`create_sale_invoice`), `backend/billing/invoicing.py` (nuevo método), `backend/billing/models.py:230-241` (`display_id`)
- Create: `backend/billing/tests/conftest.py`. Se **mueve** ahí el fixture `env` de `billing/tests/test_invoice_from_lines.py:35` junto con `_any_account_is_cash`, y se borran del archivo original.
- Test: `backend/billing/tests/test_sale_invoice_share.py`

**Interfaces:**
- Consumes: `LineShare`, `split_proportional`, `split_lines` (tarea 2) y `FOLIO_EXEMPT_DTE_TYPES` (tarea 3).
- Produces:
  - `BillingService.create_sale_invoice(order, dte_type, payment_method="CREDIT", status=POSTED, number=None, date=None, *, amount: Decimal | None = None, line_shares: list[LineShare] | None = None, net_tax_discount: tuple[Decimal, Decimal, Decimal] | None = None, folio_exempt: bool = False, link_advances: bool = True) -> Invoice`.
    - Con `amount=None` el comportamiento es el actual (espejo completo).
    - Con `amount`, los totales son `total=amount` y `(total_net, total_tax, total_discount_amount) = net_tax_discount`, y las líneas salen de `InvoicingService.create_share_lines(invoice, order, line_shares)`.
  - `InvoicingService.create_share_lines(invoice: Invoice, order, shares: list[LineShare]) -> list[InvoiceLine]`: igual que `mirror_order_lines`, pero con la `quantity` y el `subtotal` del share (`key` = `SaleLine.pk`). `unit_price`, `tax_rate` y `uom` se copian de la línea de la OV.
  - **Folio:**
    - se elimina el bloque `SequenceService` de `create_sale_invoice:516-520`;
    - si `status == POSTED`, no hay `number` y `folio_exempt and dte_type in FOLIO_EXEMPT_DTE_TYPES`, el documento queda `POSTED`;
    - en cualquier otro caso sin número sigue la regla actual y baja a `DRAFT`.
  - `link_advances=False` omite el bloque de anticipos.
  - `Invoice.display_id`: si `status == POSTED` y `number == ""`, devuelve `f"{prefix}-#{self.pk}"`. El resto no cambia.

- [ ] **Step 1: Move** el fixture `env` y `_any_account_is_cash` a `billing/tests/conftest.py`. Run `…pytest billing/tests/test_invoice_from_lines.py -q`. Expected: PASS (sin cambios de comportamiento).
- [ ] **Step 2: Write the failing tests** en `test_sale_invoice_share.py`. Usan `env` y una OV confirmada con dos líneas (10000 y 3333 brutos):
  - `test_full_invoice_unchanged`: sin `amount`, el total es igual al de la OV y hay una línea por cada línea de la OV.
  - `test_share_invoice_totals_and_lines`: con `amount=6000` y los shares de `split_lines`, `invoice.total == 6000`, `Σ lines.subtotal == 6000`, y el asiento cuadra (debe = haber) con CxC por 6000.
  - `test_two_shares_invoice_order_exactly`: dos documentos (6000 y 7334). Después de `InvoicingService.recompute_order(order)`, cada línea de la OV queda con `quantity_invoiced == quantity`.
  - `test_boleta_without_folio_exempt_is_posted`: `BOLETA` con `folio_exempt=True` y sin `number` → `status == POSTED`, `number == ""`, `display_id.endswith(f"-#{inv.pk}")`.
  - `test_boleta_without_folio_not_exempt_is_draft`: sin `folio_exempt` → `DRAFT`. **No** recibe un número de secuencia (`number == ""`).
  - `test_factura_never_folio_exempt`: `FACTURA` con `folio_exempt=True` y sin número → `DRAFT`.
- [ ] **Step 3: Run** `…pytest billing/tests/test_sale_invoice_share.py -q`. Expected: FAIL.
- [ ] **Step 4: Implement** los cambios en `services.py`, `invoicing.py` y `models.py`.
- [ ] **Step 5: Run** `…pytest billing -q`. Expected: PASS (todo el módulo; algún test que esperaba folio de secuencia en boletas se actualiza para esperar `""`, y se anota en el commit).
- [ ] **Step 6: Commit** `feat(billing): facturas por porción y boletas POS sin folio inventado (ADR-0138 D3)`.

### Task 5: Checkout POS multi-documento

**Files:**
- Modify: `backend/billing/services.py` (`_pos_checkout_internal`, bloques «4. Create Invoice» en `:1250-1272` y pagos en `:1278-1450`)
- Modify: `backend/billing/views.py:155-162` (respuesta)
- Test: `backend/billing/tests/test_pos_checkout_documents.py`

**Interfaces:**
- Consumes: `PaymentPortion`, `plan_sale_documents`, `folio_exempt_for_session` (tarea 3), `split_lines`, `split_proportional` (tarea 2) y `create_sale_invoice(..., amount, line_shares, net_tax_discount, folio_exempt, link_advances)` (tarea 4).
- Produces:
  - `_pos_checkout_internal(...)` interpreta `dte_type` como **clase de documento**. El payload no cambia de nombre.
    - **Construcción de porciones:**
      - en el flujo multi-pago, una `PaymentPortion` por cada `alloc` con método distinto de `CREDIT`; `integrated` es `PaymentMethod.objects.get(pk=alloc["payment_method_id"]).is_integrated` (no se confía en `isTerminalIntegration`);
      - en el flujo de pago único, una porción con `index=None`.
      - Los métodos se cargan con una sola consulta `in_bulk` por `payment_method_id`.
    - **Creación de documentos:** un `create_sale_invoice` por plan.
      - `folio_exempt` es `folio_exempt_for_session(pos_session_id)`.
      - `document_number` y `document_attachment` solo se aplican al plan `BOLETA`/`FACTURA*`, nunca al 48.
      - `is_pending_registration=True` → `status=DRAFT` en todos.
      - `link_advances=True` solo en el primer plan cuyo tipo no sea `COMPROBANTE_PAGO`, o en el primero si todos lo son.
    - **Movimientos:** cada movimiento del `alloc` `i` recibe `invoice=` el documento cuyo `payment_indexes` contiene `i`. Con pago único, el documento principal.
    - **Valor de retorno:** el documento principal, con el atributo no persistido `invoice.checkout_documents: list[Invoice]` (todos, en orden de plan).
  - La vista responde con `{**InvoiceSerializer(invoice).data, "documents": [{"id", "display_id", "dte_type", "total"} …]}`. Es un campo aditivo: los consumidores actuales siguen leyendo el documento principal.

- [ ] **Step 1: Write the failing tests.** Llaman a `BillingService._pos_checkout_internal(order_data={"id": order.id}, …)` con una OV confirmada de 10000, `env`, una sesión POS (`treasury.tests.helpers.make_pos_session`) cuyo terminal permite un `PaymentMethod` `CARD_TERMINAL` con `linked_terminal_device` y un método de efectivo:
  - `test_boleta_paid_with_integrated_terminal_is_48`: un solo documento `COMPROBANTE_PAGO`, `POSTED`, `number == ""`, con su movimiento enlazado.
  - `test_boleta_cash_is_39_without_invented_folio`: `BOLETA` `POSTED` con `number == ""`.
  - `test_mixed_payment_creates_two_documents`: con `payments=[{card 6000}, {cash 4000}]` hay dos `Invoice` en la OV (48 por 6000 y 39 por 4000); el movimiento de tarjeta apunta al 48 y el de efectivo al 39; la OV queda totalmente facturada; el retorno es el 48 y `len(checkout_documents) == 2`.
  - `test_factura_with_terminal_single_document`: clase `FACTURA`, `document_number="991"` → un solo `FACTURA` con folio 991.
  - `test_user_folio_goes_to_boleta_not_48`: con pago mixto y `document_number="777"`, el 39 tiene folio 777 y el 48 tiene `""`.
  - `test_checkout_queries_do_not_grow_with_payments`: con `CaptureQueriesContext`, el número de consultas para 2 y para 4 asignaciones en efectivo difiere a lo sumo en las inserciones de movimientos (se aserta `delta <= 4 * k`, con `k` = las consultas por movimiento medidas en el caso de 2). Es una guarda para no cargar `PaymentMethod` por fila.
- [ ] **Step 2: Run** `…pytest billing/tests/test_pos_checkout_documents.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** en `_pos_checkout_internal` y en la vista.
- [ ] **Step 4: Run** `…pytest billing sales treasury -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(billing): checkout POS deriva 39/48 del pago y divide el pago mixto (ADR-0138 D3)`.

### Task 6: Checkout de venta (frontend)

**Files:**
- Modify: `frontend/features/sales/components/checkout/Step2_DTE.tsx:58-63` (copy de la opción boleta)
- Modify: `frontend/features/sales/types/index.ts:184` (`CheckoutResponse`)
- Modify: el consumidor de `onComplete(response)` en `frontend/features/pos/components/POSClientView.tsx`, en el resumen de éxito
- Test: `frontend/features/sales/components/checkout/__tests__/Step2_DTE.test.tsx` (crear si no existe) y el test del resumen de éxito del POS

**Interfaces:**
- Consumes: el campo `documents` de la respuesta (tarea 5).
- Produces:
  - `CheckoutDocument { id: number; display_id: string; dte_type: string; total: string }`;
  - `CheckoutResponse.documents?: CheckoutDocument[]`.

- [ ] **Step 1: Write the failing tests:**
  - `Step2_DTE` muestra en la opción `BOLETA` la descripción exacta «Consumidor final. Si se cobra con terminal integrado se registra como Comprobante de Pago (48).»
  - El resumen de éxito con `documents` de largo 2 lista ambos `display_id`. Con un solo documento, o sin `documents`, se ve igual que hoy.
- [ ] **Step 2: Run** `npm run test -- features/sales/components/checkout features/pos`. Expected: FAIL.
- [ ] **Step 3: Implement** el copy, el tipo y la lista de documentos en el éxito (con `StatusBadge` si muestra estado; sin colores crudos).
- [ ] **Step 4: Run** los tests, `npm run type-check` y `npm run lint`. Expected: PASS, 0 errores.
- [ ] **Step 5: Commit** `feat(sales): checkout informa los documentos generados por pago mixto`.

---

# Fase 3 — Cuadre ERP ↔ TUU

### Task 7: `MatchStatus`, campos de cuadre y configuración

**Files:**
- Create: `backend/core/fiscal_match.py`
- Modify: `backend/treasury/models.py` (`TerminalSale`, `:3939`), `backend/accounting/models.py` (`RCVSettings`, `:1791`; `RCVDocument`, `:2038`)
- Create: migraciones `treasury/0107_terminalsale_fiscal_match.py`, `accounting/0048_fiscal_match.py` (`makemigrations`)
- Modify: `backend/accounting/rcv_serializers.py` (settings), `backend/treasury/serializers.py:1910` (list y detail)
- Test: `backend/treasury/tests/test_terminal_sale_match_fields.py`

**Interfaces:**
- Produces:
  - `core.fiscal_match.MatchStatus(models.TextChoices)` con los 7 valores de Global Constraints. Etiquetas en español: Cuadrado, Diferencia de monto, Diferencia de tipo, Ambiguo, Falta en el ERP, Falta en el externo, Excluido.
  - En `TerminalSale` y en `RCVDocument`, los mismos tres campos:
    - `matched_invoice = FK("billing.Invoice", null, blank, SET_NULL)`, con `related_name="terminal_sales"` en `TerminalSale` y `related_name="rcv_documents"` en `RCVDocument`;
    - `match_status = CharField(max_length=20, choices=MatchStatus.choices, blank=True, default="", db_index=True)`;
    - `matched_manually = BooleanField(default=False)`;
    - `UniqueConstraint(fields=["matched_invoice"], condition=Q(matched_invoice__isnull=False), name="<modelo>_matched_invoice_uniq")`.
  - `RCVSettings`: `fiscal_match_start_date = DateField(null=True, blank=True)` (sin fecha no se cuadra nada) y `terminal_match_window_minutes = PositiveSmallIntegerField(default=15, validators=[MinValueValidator(1), MaxValueValidator(240)])`.
  - Los serializers exponen `match_status`, `match_status_display`, `matched_invoice` (id) y `matched_invoice_display` (`display_id`), con `select_related("matched_invoice")` en los selectores de lista.

- [ ] **Step 1: Write the failing tests:**
  - `test_matched_invoice_is_unique`: dos `TerminalSale` con el mismo `matched_invoice` → `IntegrityError`.
  - `test_list_exposes_match_fields_without_n_plus_one`: `GET /api/treasury/terminal-sales/` con 3 y con 6 ventas enlazadas hace el mismo número de consultas, y cada fila trae `matched_invoice_display`.
- [ ] **Step 2: Run** `…pytest treasury/tests/test_terminal_sale_match_fields.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** los modelos, `makemigrations treasury accounting` y los serializers y selectores.
- [ ] **Step 4: Run** `…pytest treasury accounting -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): estados de cuadre fiscal y campos de vínculo en TUU/RCV (ADR-0138 D6)`.

### Task 8: Servicio de cuadre TUU

**Files:**
- Create: `backend/tax/reconciliation/__init__.py`, `backend/tax/reconciliation/terminal.py`
- Test: `backend/tax/tests/test_reconcile_terminal.py`

**Interfaces:**
- Consumes: `MatchStatus` y los campos de la tarea 7; `RCVSettings.get_settings()` (`fiscal_match_start_date`, `terminal_match_window_minutes`).
- Produces: `reconcile_terminal_sales(start: date, end: date) -> dict[str, int]`, con conteos por `MatchStatus`, dentro de `@transaction.atomic`.

**Algoritmo:**
1. **Selección.** Ventas `S` con `transaction_at` en `[start, end]` y `transaction_at >= fiscal_match_start_date` (si no hay fecha, devuelve `{}`), excluyendo `matched_manually=True`. Se limpian `matched_invoice` y `match_status` de `S` antes de recalcular.
2. **Excluidas.** Las ventas con `status != COMPLETED` → `EXCLUDED`.
3. **Candidatos.** Movimientos `TreasuryMovement` `INBOUND` con `invoice` `POSTED` de venta con `dte_type` en {39, 41, 48, 33}, y `created_at` en `[start - w, end + w]`. Se cargan en una sola consulta con `select_related("invoice", "payment_method_new", "pos_session")` y se excluyen las facturas ya enlazadas manualmente a otra venta.
4. **Compatibilidad** de la venta `s` con el movimiento `m`:
   - `|m.created_at - s.transaction_at| <= w`;
   - `m.invoice.total == s.sale_amount`;
   - tipo de pago:
     - si `s.payment_type == CASH`, `m.payment_method == "CASH"` y `m.pos_session.terminal_id ∈ terminales(s.device)`;
     - si no, `m.payment_method_new.linked_terminal_device_id == s.device_id`;
   - `terminales(device)` = los ids de `POSTerminal` cuyo `allowed_payment_methods` incluye algún método con `linked_terminal_device=device`. Se precalcula en un dict con una sola consulta.
   - Si `s.device_id` es nulo, se omite el filtro de dispositivo y terminal.
5. **Asignación.** Si `s` tiene exactamente una factura candidata y esa factura tiene exactamente una venta candidata → se enlaza:
   - `TYPE_DIFF` si `s.document_type` no es nulo y difiere de `invoice.sii_code`;
   - `MATCHED` en otro caso.

   Si hay más de un candidato en cualquiera de los dos sentidos → `AMBIGUOUS` sin enlace. Sin candidatos → `ONLY_EXTERNAL`.
6. **Escritura.** Un solo `bulk_update`.

- [ ] **Step 1: Write the failing tests** (fábricas locales para venta POS + movimiento + `TerminalSale`):
  - `test_card_sale_matches_48`: tarjeta en el dispositivo D, 6000, ±3 min, documento 48 → `MATCHED` con el vínculo correcto.
  - `test_cash_sale_matches_39_by_terminal`.
  - `test_type_diff_when_tuu_says_48_and_erp_39`: queda enlazada y marcada `TYPE_DIFF`.
  - `test_same_amount_same_window_is_ambiguous` (Review Focus 3): dos ventas TUU de 5000 en D, a 2 y 4 minutos de dos facturas de 5000 → ambas `AMBIGUOUS`, `matched_invoice is None`.
  - `test_outside_window_is_only_external`: una diferencia de 16 minutos con `w=15` da `ONLY_EXTERNAL`.
  - `test_reversed_is_excluded`.
  - `test_before_start_date_untouched`: una venta anterior a `fiscal_match_start_date` conserva `match_status == ""`.
  - `test_manual_link_survives_rerun` (Review Focus 4): una venta `matched_manually=True` mantiene su vínculo, y su factura no se le asigna a otra venta.
  - `test_idempotent`: dos ejecuciones dan el mismo resultado.
  - `test_query_count_constant`: el mismo número de consultas con 5 y con 20 ventas.
- [ ] **Step 2: Run** `…pytest tax/tests/test_reconcile_terminal.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** `tax/reconciliation/terminal.py`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): cuadre de ventas TUU contra documentos POS (ADR-0138 D4)`.

### Task 9: Disparo automático, recálculo y vínculo manual (API)

**Files:**
- Modify: `backend/treasury/tasks.py:943-962` (`sync_terminal_run`)
- Create: `backend/tax/reconciliation_views.py`, `backend/tax/reconciliation_serializers.py`
- Modify: `backend/tax/urls.py`
- Modify: `backend/tax/reconciliation/terminal.py` (servicios manuales)
- Test: `backend/tax/tests/test_reconciliation_terminal_api.py`, `backend/treasury/tests/test_terminal_sync_tasks.py` (agregar un caso)

**Interfaces:**
- Consumes: `reconcile_terminal_sales` (tarea 8).
- Produces:
  - **Al final de `sync_terminal_run`:** si `status in (SUCCESS, PARTIAL)`, se llama a `reconcile_terminal_sales(run.start_date, run.end_date)` con import diferido y dentro de `try/except Exception` con `logger.exception`. Si el cuadre falla, la sincronización no falla.
  - **Servicios manuales:**
    - `match_terminal_sale(sale: TerminalSale, invoice: Invoice) -> TerminalSale`: valida que la factura sea un documento de venta `POSTED` y que no esté enlazada a otra venta; deja `matched_manually=True` y el estado `MATCHED`, o `TYPE_DIFF` según el tipo.
    - `unmatch_terminal_sale(sale) -> TerminalSale`: limpia el vínculo, `matched_manually=False` y `match_status=""`.
    - `terminal_sale_candidates(sale) -> QuerySet[Invoice]`: documentos de venta `POSTED` del mismo día local con `total == sale.sale_amount`, sin otra venta enlazada; máximo 20.
  - **Endpoints** (permiso: el mismo que usa `tax/views.py` para escribir en períodos tributarios):
    - `POST /api/tax/reconciliation/terminal/run/` con `{year, month}` → conteos;
    - `GET /api/tax/reconciliation/terminal-sales/{id}/candidates/` → `[{id, display_id, dte_type, total, date}]`;
    - `POST /api/tax/reconciliation/terminal-sales/{id}/match/` con `{invoice_id}`;
    - `POST /api/tax/reconciliation/terminal-sales/{id}/unmatch/`.

- [ ] **Step 1: Write the failing tests:**
  - `test_sync_run_triggers_reconciliation`: se hace patch de `tax.reconciliation.terminal.reconcile_terminal_sales` y se verifica que se llama con el rango del run.
  - `test_reconciliation_error_does_not_fail_sync`.
  - `test_manual_match_and_unmatch`.
  - `test_cannot_match_invoice_linked_elsewhere` → 400.
  - `test_candidates_same_day_same_amount`.
  - `test_endpoints_require_permission` → 403 sin permiso.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** (vistas ≤ 20 líneas por acción).
- [ ] **Step 4: Run** `…pytest tax treasury -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): API de cuadre TUU y disparo tras sincronizar`.

### Task 10: Cuadre en ventas TUU (frontend)

**Files:**
- Modify: `frontend/features/treasury/entity-view/terminalSale.entity.ts` (columna `match_status`), `frontend/features/treasury/components/TerminalSaleDrawer.tsx` (sección «Documento ERP»)
- Create: `frontend/features/tax/api/reconciliationApi.ts`, `frontend/features/tax/hooks/useTerminalMatch.ts`
- Modify: `frontend/features/tax/index.ts` (barrel)
- Test: `frontend/features/treasury/components/__tests__/TerminalSaleDrawer.test.tsx`, `frontend/features/treasury/entity-view/terminalSale.entity.test.ts`

**Interfaces:**
- Consumes: los endpoints de la tarea 9 y los campos de la tarea 7.
- Produces:
  - Tipo `MatchStatus` (union de los 7 literales más `""`) en `features/tax/types/reconciliation.ts`.
  - Hooks:
    - `useTerminalSaleCandidates(saleId: number, enabled: boolean)`;
    - `useMatchTerminalSale()`, con `mutateAsync({saleId, invoiceId})`;
    - `useUnmatchTerminalSale()`.

    Ambas mutaciones invalidan las queries de ventas TUU y de cuadre.

- [ ] **Step 1: Write the failing tests:**
  - La entidad tiene la columna `match_status` renderizada con `StatusBadge`.
  - El drawer muestra «Documento ERP» con `matched_invoice_display`, que abre `billing.invoice` con `openEntity`.
  - Si no hay vínculo, lista los candidatos con la acción «Vincular». Con vínculo manual muestra «Desvincular».
- [ ] **Step 2: Run** `npm run test -- features/treasury`. Expected: FAIL.
- [ ] **Step 3: Implement** (`StatusBadge` con el mapeo de estados agregado donde `StatusBadge` registra sus dominios).
- [ ] **Step 4: Run** los tests, `type-check` y `lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(treasury): estado de cuadre y vínculo manual en ventas TUU`.

---

# Fase 4 — Cuadre ERP ↔ RCV

### Task 11: Servicio de cuadre RCV

**Files:**
- Create: `backend/tax/reconciliation/rcv.py`
- Modify: `backend/accounting/tasks.py:55-70` (`run_rcv_imports`)
- Test: `backend/tax/tests/test_reconcile_rcv.py`

**Interfaces:**
- Consumes: `fiscal_key`, `FISCAL_KEY_RELATED`, `fiscal_direction_expression` (tarea 1) y `MatchStatus` y los campos de la tarea 7.
- Produces: `reconcile_rcv_period(direction: str, year: int, month: int, rcv_import: RCVImport | None = None) -> dict[str, int]`, dentro de `@transaction.atomic`.

**Reglas:**
1. **Selección.** Los `RCVDocument` de la dirección y del período `f"{year}{month:02d}"`, excluyendo `matched_manually=True`. Si el período termina antes de `fiscal_match_start_date` (o no hay fecha), devuelve `{}`.
2. **Excluidos.** Un `RCVDocument` con `missing_since_import` no nulo se desenlaza y queda `EXCLUDED`. Los documentos de tipos 39, 41 y 48 (se cuadran por resumen) y de tipos fuera de `SII_CODE_TO_DTE_TYPE` también quedan `EXCLUDED`.
3. **Candidatos.** Facturas `POSTED` con dirección `direction` (mediante la expresión), `sii_code` en {33, 34, 56, 61}, `number != ""` y `date` en `[inicio - 60 días, fin + 60 días]`, sin vínculo manual con otro `RCVDocument`. Una sola consulta con `select_related(*FISCAL_KEY_RELATED)`, indexada por `fiscal_key`. La dirección RCV `PURCHASES`/`SALES` se traduce a `purchase`/`sale`.
4. **Cruce.** Clave `(direction, dte_type, folio, normalize_rut(counterparty_rut))`:
   - si hay par, se enlaza: `MATCHED` si `abs(rcv.total_amount) == invoice.total`, `AMOUNT_DIFF` si no. Se usa el valor absoluto porque el signo de las NC en el RCV no está garantizado; hay que verificarlo contra el fixture real de `accounting/tests/fixtures`.
   - si no hay par → `ONLY_EXTERNAL`.
5. **Período cerrado.** Si `TaxPeriodService.is_period_closed(date(year, month, 1))` y alguna fila pasa de `MATCHED` (o de `""`) a otro estado, y además hay `rcv_import`, se agrega a `rcv_import.warnings` el texto exacto «Hay N diferencia(s) nueva(s) del RCV en un período tributario cerrado.».
6. **Disparo.** En `run_rcv_imports`, después de cada `execute_import` con estado exitoso (ver `RCVImport.Status`), se llama a `reconcile_rcv_period(imp.direction, imp.year, imp.month, imp)` con import diferido y `try/except` con log.

- [ ] **Step 1: Write the failing tests** (`rcv_helpers` y facturas locales):
  - `test_purchase_invoice_matches_rcv` (Review Focus 5): factura de compra con folio `"000123"` y snapshot `"8.973.356-k"` contra un RCV de compras 33 con folio 123 y RUT `"8973356-K"` → `MATCHED` con el vínculo.
  - `test_amount_diff`.
  - `test_only_external_when_missing_in_erp`.
  - `test_credit_note_matches_by_absolute_amount`.
  - `test_boleta_and_48_detail_rows_are_excluded`.
  - `test_unsupported_type_excluded`: tipo 46.
  - `test_missing_since_import_unlinks`.
  - `test_manual_link_survives_rerun` (Review Focus 4).
  - `test_closed_period_new_diff_adds_warning`: el texto exacto queda en `rcv_import.warnings`.
  - `test_before_start_date_untouched`.
  - `test_query_count_constant`: el mismo número de consultas con 5 y con 25 documentos.
  - `test_import_task_triggers_reconciliation`: se hace patch del servicio.
- [ ] **Step 2: Run** `…pytest tax/tests/test_reconcile_rcv.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax accounting -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): cuadre del RCV contra facturas y notas del ERP (ADR-0138 D5)`.

### Task 12: Reporte de cuadre del período

**Files:**
- Create: `backend/tax/reconciliation/report.py`
- Modify: `backend/tax/reconciliation_views.py`, `backend/tax/reconciliation_serializers.py`, `backend/tax/reconciliation/rcv.py` (servicios manuales RCV)
- Test: `backend/tax/tests/test_reconciliation_report.py`

**Interfaces:**
- Consumes: las tareas 1, 7, 8 y 11.
- Produces:
  - `fiscal_reconciliation_report(year: int, month: int) -> dict`, con estas claves exactas:
    - **`start_date`:** `fiscal_match_start_date` o `None`.
    - **`documents`:** `{"purchase": {status: count}, "sale": {status: count}}`, a partir de los `RCVDocument` del período, más la clave `ONLY_ERP`. `ONLY_ERP` cuenta las facturas `POSTED` del período con `sii_code` en {33, 34, 56, 61}, con folio y fecha `>= start_date`, sin `rcv_documents`. Las boletas de compra nunca cuentan.
    - **`only_erp`:** hasta 50 `{id, label, amount, date}` con el mismo formato `_item` de `tax/services.py`.
    - **`summaries`:** una lista, para 39, 41 y 48 de ventas, con estas claves:
      - `dte_type`;
      - `erp_count` y `erp_total`: facturas `POSTED` de venta del mes con ese código;
      - `tuu_count` y `tuu_total`: `TerminalSale` `COMPLETED` del mes con ese `document_type`;
      - `rcv_count` y `rcv_total`: `RCVImportSummary` de la última `RCVImport` exitosa de `SALES` del período, o `null` si no hay;
      - `difference`: `erp_total - rcv_total`, o `null`.
    - **`terminal`:** `{status: count}` de las `TerminalSale` del mes, más `ONLY_ERP`. `ONLY_ERP` cuenta los documentos de venta 39, 41 y 48 con `pos_session` en sus movimientos, sin `terminal_sales`, y cuyo `created_at` es anterior a ahora menos la ventana.
  - `match_rcv_document(doc, invoice) -> RCVDocument`, `unmatch_rcv_document(doc) -> RCVDocument` y `rcv_document_candidates(doc) -> QuerySet[Invoice]`: misma dirección y `sii_code`, mismo RUT normalizado, y folio igual o total igual; máximo 20. Son análogos a la tarea 9.
  - **Endpoints:**
    - `GET /api/tax/reconciliation/?year=&month=` → reporte;
    - `POST /api/tax/reconciliation/rcv/run/` con `{year, month}` → recalcula ambas direcciones;
    - `GET|POST /api/tax/reconciliation/rcv-documents/{id}/candidates|match|unmatch/`.

- [ ] **Step 1: Write the failing tests:**
  - `test_report_three_column_summary`: con 2 boletas de venta del ERP (1000 y 2000), 2 ventas TUU de 39 por esos montos y un `RCVImportSummary` 39 con total 3000, la fila 39 da `erp_total=3000`, `tuu_total=3000`, `rcv_total=3000` y `difference=0`.
  - `test_report_rcv_null_when_no_import`.
  - `test_only_erp_excludes_purchase_boletas`.
  - `test_report_query_count_constant`: el mismo número de consultas con 5 y con 30 documentos por tipo.
  - `test_rcv_manual_match`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): reporte de cuadre fiscal por período`.

### Task 13: Pestaña «Cuadre» y acciones en documentos RCV (frontend)

**Files:**
- Modify: `frontend/features/accounting/navigation.ts:39` (agregar la sub-pestaña)
- Create: `frontend/app/(dashboard)/accounting/rcv/reconciliation/page.tsx`
- Create: `frontend/features/tax/components/FiscalReconciliationClientView.tsx`, `frontend/features/tax/hooks/useFiscalReconciliation.ts`, `frontend/features/tax/hooks/useRcvMatch.ts`
- Modify: `frontend/features/tax/api/reconciliationApi.ts`, `frontend/features/tax/types/reconciliation.ts`, `frontend/features/tax/index.ts`
- Modify: `frontend/features/accounting/entity-view/rcvDocument.entity.ts` (columna `match_status`, filtro por estado), `frontend/features/accounting/components/rcv/RcvDocumentDrawer.tsx` (sección «Documento ERP» igual a la de la tarea 10)
- Modify: `frontend/features/settings/components/RcvSettingsView.tsx` y `RcvSettingsView.schema.ts` (sección «Cuadre fiscal» con `fiscal_match_start_date` y `terminal_match_window_minutes`, de 1 a 240)
- Test: `frontend/features/tax/components/__tests__/FiscalReconciliationClientView.test.tsx`, `frontend/features/accounting/components/__tests__/RcvDocumentDrawer.test.tsx`, `frontend/features/settings/components/RcvSettingsView.schema.test.ts`, `frontend/features/accounting/__tests__/rcvNavigation.test.ts`

**Interfaces:**
- Consumes: los endpoints y la forma del reporte de la tarea 12.
- Produces:
  - Sub-pestaña `{ value: "reconciliation", label: "Cuadre", href: "/accounting/rcv/reconciliation", iconName: "scale" (o el ícono equivalente ya registrado en el mapa de íconos), headerTitle: "Cuadre fiscal", headerDescription: "ERP frente a TUU y el RCV del SII, por período." }`.
  - Hooks:
    - `useFiscalReconciliation(year, month)`;
    - `useRunReconciliation()`, con `mutateAsync({ source: "rcv" | "terminal", year, month })`;
    - `useRcvDocumentCandidates`, `useMatchRcvDocument` y `useUnmatchRcvDocument`.

- [ ] **Step 1: Write the failing tests:**
  - **Vista:**
    - muestra el selector de período;
    - tiene una `Section` «Boletas y comprobantes» con la tabla de tres columnas (ERP · TUU · SII) y la diferencia;
    - tiene una `Section` «Facturas y notas» con los conteos por estado (cada conteo filtra la colección de documentos RCV);
    - lista «Falta en el SII» con `openEntity` a `billing.invoice`;
    - ofrece las acciones «Recalcular RCV» y «Recalcular TUU»;
    - sin `start_date`, muestra un `Banner` «Configure la fecha de inicio del cuadre» con un enlace a `/accounting/settings/rcv`;
    - maneja los estados de carga, vacío y error.
  - **Drawer RCV:** igual que el drawer TUU de la tarea 10.
  - **Schema de ajustes:** rechaza `terminal_match_window_minutes` 0 y 241.
  - **Navegación:** la sub-pestaña existe y se marca activa.
- [ ] **Step 2: Run** `npm run test -- features/tax features/accounting features/settings`. Expected: FAIL.
- [ ] **Step 3: Implement** con componentes compartidos (`Section`, `Banner`, `StatusBadge`, `Collection`); colecciones vía `defineEntity`.
- [ ] **Step 4: Run** los tests, `type-check` y `lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(accounting): pestaña de cuadre fiscal y vínculo manual en documentos RCV`.

---

# Fase 5 — Compuerta F29

### Task 14: `fiscal_mismatches` en `status_check` y en los checklists

**Files:**
- Modify: `backend/tax/services.py:1104-1232` (`AccountingPeriodService.get_period_status`)
- Modify: `frontend/features/accounting/components/closures/AccountingPeriodCloseChecklist.tsx:70` (Sugeridos), `frontend/features/tax/components/DeclarationWizard.tsx` (auditoría, Sugeridos) y el tipo `AccountingPeriodStatus`
- Test: `backend/tax/tests/test_accounting_period_status.py` (agregar), `frontend/features/accounting/components/closures/__tests__/AccountingPeriodCloseChecklist.test.tsx` (agregar)

**Interfaces:**
- Consumes: `fiscal_reconciliation_report` (tarea 12).
- Produces: `status_check` agrega `fiscal_mismatches: { count: int, by_status: {ONLY_EXTERNAL, AMOUNT_DIFF, TYPE_DIFF, AMBIGUOUS} }`. Suma documentos RCV y ventas TUU del período; `ONLY_ERP` no se cuenta porque el RCV puede llegar tarde. Es **Sugerido**: no entra en `ensure_no_draft_invoices` ni en la compuerta del botón de cierre.
- Ítem de checklist:
  - clave `fiscal`;
  - título «Cuadre fiscal sin diferencias»;
  - `passed: count === 0`;
  - `detail`: «N diferencia(s) con TUU o el SII»;
  - `action`: enlace «Ir al cuadre» a `/accounting/rcv/reconciliation`.

- [ ] **Step 1: Write the failing tests:**
  - Backend:
    - `test_status_check_includes_fiscal_mismatches`: 1 `ONLY_EXTERNAL` más 1 `TYPE_DIFF` dan `count == 2`.
    - `test_fiscal_mismatches_do_not_block_close`: el cierre del período procede igual.
    - El test de query count existente de `status_check` sigue constante.
  - Frontend: el ítem aparece en Sugeridos con el enlace, y no deshabilita el botón de cierre.
- [ ] **Step 2: Run** los tests de backend y de frontend. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax -q`, `npm run test -- features/accounting features/tax`, `type-check` y `lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): diferencias del cuadre fiscal como pendiente sugerido del cierre (ADR-0138 D7)`.

---

# Fase 6 — El RCV alimenta el registro local

### Task 15: Completar borradores de compra desde el RCV

**Files:**
- Create: `backend/tax/reconciliation/feeding.py`
- Modify: `backend/tax/reconciliation_views.py`, `backend/tax/urls.py`
- Modify: `frontend/features/accounting/components/rcv/RcvDocumentDrawer.tsx`, `frontend/features/tax/hooks/useRcvFeeding.ts` (nuevo), `frontend/features/tax/api/reconciliationApi.ts`
- Test: `backend/tax/tests/test_rcv_feeding.py`, `frontend/features/accounting/components/__tests__/RcvDocumentDrawer.test.tsx`

**Interfaces:**
- Consumes: `fiscal_key` (tarea 1), `match_rcv_document` (tarea 12), `BillingService.confirm_invoice(invoice, number, document_attachment=None, date=None)` y `BillingService.create_purchase_bill(order, supplier_invoice_number, dte_type, document_attachment, date, status)`.
- Produces:
  - `draft_suggestions(doc: RCVDocument) -> list[Invoice]`: solo si `doc.direction` es de compras y `match_status == ONLY_EXTERNAL`. Devuelve facturas `DRAFT` de compra con el mismo RUT normalizado (contacto o proveedor de la OC) y `abs(total - abs(doc.total_amount)) <= 0.02 * abs(doc.total_amount)`, ordenadas por esa diferencia; máximo 10.
  - `confirm_draft_from_rcv(doc, invoice, attachment=None) -> Invoice`: llama a `confirm_invoice(invoice, number=str(doc.folio), document_attachment=attachment, date=doc.issue_date)` y luego a `match_rcv_document(doc, invoice)`. Los errores de `confirm_invoice` (por ejemplo, un adjunto obligatorio) se propagan como 400 sin enlazar.
  - `create_draft_from_rcv(doc, purchase_order: PurchaseOrder) -> Invoice`:
    - valida que el proveedor de la OC tenga el mismo RUT normalizado que el documento; si no, `ValidationError` «El proveedor de la OC no coincide con el RUT del documento.»;
    - llama a `create_purchase_bill(order, supplier_invoice_number=str(doc.folio), dte_type=SII_CODE_TO_DTE_TYPE[doc.dte_type], date=doc.issue_date, status=DRAFT)`.

    No hay variante sin OC: el modelo actual no tiene compras sin OC. Queda fuera de alcance, como se anota en la sección Fuera de alcance.
  - **Endpoints:**
    - `GET /api/tax/reconciliation/rcv-documents/{id}/draft-suggestions/`;
    - `POST /api/tax/reconciliation/rcv-documents/{id}/confirm-draft/` con `{invoice_id}` y un adjunto opcional (multipart);
    - `POST /api/tax/reconciliation/rcv-documents/{id}/create-draft/` con `{purchase_order_id}`.

    Los POST usan `@idempotent_endpoint` con el mismo patrón que `pos_checkout`.
  - **UI:** en `RcvDocumentDrawer`, para compras `ONLY_EXTERNAL`, una sección «Registrar en el ERP» con:
    - las sugerencias de borradores y la acción «Asignar folio y emitir»;
    - la acción «Crear borrador desde OC» con un selector de OC del proveedor.

    Ninguna acción corre sin un clic explícito.

- [ ] **Step 1: Write the failing tests:**
  - Backend:
    - `test_suggests_draft_same_rut_within_2_percent`: 100000 contra 101500 sí aparece; contra 103000 no.
    - `test_no_suggestions_for_sales_or_matched`.
    - `test_confirm_draft_assigns_folio_and_links`: queda `POSTED`, `number == "123"`, `date == issue_date` y el documento RCV en `MATCHED`.
    - `test_create_draft_rejects_other_supplier`: el texto exacto del error.
    - `test_create_draft_from_po_is_draft_with_folio`.
    - `test_feeding_endpoints_idempotent`: dos POST con la misma `Idempotency-Key` crean un solo borrador.
  - Frontend: la sección solo aparece en compras `ONLY_EXTERNAL`, y las acciones llaman a los hooks con los ids correctos.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax billing -q`, `npm run test -- features/accounting features/tax`, `type-check` y `lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): el RCV completa borradores de compra y crea borradores desde OC (ADR-0138 D8)`.

### Task 16: Documentación de contratos

**Files:**
- Modify: `docs/10-architecture/adr/0138-registro-dte-local-con-control-fiscal-externo.md`. Agregar una sección «Resolución de preguntas abiertas» con las decisiones del encabezado de este plan, y la nota de alcance de D8 (sin OC no hay borrador).
- Modify: `docs/10-architecture/adr/0084-document-status-decoupled-from-payment.md`. Agregar la nota de la excepción 39/41/48 sin folio con un enlace a ADR-0138.
- Modify: `docs/20-contracts/document-relations.md` y `docs/20-contracts/state-map.md`, solo si listan los estados de `TerminalSale` o `RCVDocument`; en ese caso, agregar `match_status`.

- [ ] **Step 1: Edit** los documentos.
- [ ] **Step 2: Run** `grep -n "0138" docs/10-architecture/adr/0084-*.md`. Expected: una coincidencia.
- [ ] **Step 3: Commit** `docs: resolución de preguntas abiertas de ADR-0138 y excepción de folio en ADR-0084`.

---

## Fuera de alcance (registrado)

- **Reclasificar el tipo de un documento POS** con `TYPE_DIFF` (ADR-0138 D4): esta iteración solo detecta y muestra la diferencia. La corrección auditada requiere su propio diseño.
- **Borrador de compra sin OC** (contra una cuenta de gasto): el modelo `Invoice` no lo soporta, porque `is_sale_document` trata como venta a toda factura sin OC.
- **Unificar `PURCHASE_INV` con `FACTURA`** en el enum: la clave fiscal ya los trata igual.
- **Verificar con datos reales** si TUU separa una transacción mixta en dos documentos, como asume D3. El cuadre lo revelará como `ONLY_ERP`/`ONLY_EXTERNAL`.
