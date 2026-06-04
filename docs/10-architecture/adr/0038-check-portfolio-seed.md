---
id: 0038
title: Seed del puente de Cheques en Cartera — pre-cableado de CoA y AccountingSettings
status: Accepted
date: 2026-06-04
author: core-team
---

# 0038 — Seed del puente de Cheques en Cartera — pre-cableado de CoA y AccountingSettings

## Contexto

ADR-0032 introdujo la cuenta puente `CHECK_PORTFOLIO` (`TreasuryAccount` con
`account_type='CHECK_PORTFOLIO'`) para registrar los cheques de terceros
recibidos hasta su depósito/cobro. ADR-0035 extendió el patrón a los cheques
girados (`account_type='ISSUED_CHECKS'`) y al endoso.

Ambas cuentas puente dependen de que el operador asigne, vía UI de
Ajustes Contables, dos cuentas contables (`Account`):

- `AccountingSettings.check_portfolio_account` — cuenta de **activo**
  (ASSET), tipicamente una sub-cuenta de "Efectivo y Equivalentes".
- `AccountingSettings.issued_checks_account` — cuenta de **pasivo**
  (LIABILITY), tipicamente una sub-cuenta de "Pasivos Financieros".

`AccountingService.populate_ifrs_coa` creaba 60+ cuentas contables pero
**ninguna** dedicada explícitamente a Cheques en Cartera ni a Cheques
Girados por Pagar. El modelo de `AccountingSettings` ya tenía ambas FK
declaradas como `null=True, blank=True` con `on_delete=SET_NULL`, pero el
seed demo no las cableaba. Esto provocaba la siguiente fricción:

1. Operador abre el POS, selecciona Cheque, confirma una venta de $X.
2. `BillingService._pos_checkout_internal` delega a `PaymentOrchestrator`
   → `_handle_check` → `CheckService.receive`.
3. `CheckService.receive` invoca `ensure_portfolio_account()`, que
   levanta `ValidationError("No hay cuenta 'Cheques en Cartera'
   configurada. Configúrela en Ajustes Contables antes de registrar
   cheques.")` con HTTP 400.
4. Recién entonces el operador debe ir a Ajustes Contables, crear o
   seleccionar una `Account` ASSET/LIABILITY y guardar — el signal
   `ensure_check_portfolio_treasury_account` (en `treasury/signals.py`)
   detecta la transición None→algo y crea la `TreasuryAccount` puente.

La fricción es asimétrica con el patrón ya existente para
`PUENTE-TUU` (cuenta puente de liquidación de tarjetas TUU), que SÍ
está pre-cableado en el seed: `setup_demo_data.py` crea la cuenta
contable `1.1.01.16 "Cuenta Puente Liquidación TUU"` y la
`TreasuryAccount` `PUENTE-TUU` con `account_type='BRIDGE'`. El
operador no tiene que configurar nada para empezar a usar tarjetas.

## Decisión

### 1. Agregar 3 cuentas al CoA IFRS (en `populate_ifrs_coa`)

| Código | Nombre | Tipo | Padre | Atributos |
|---|---|---|---|---|
| `1.1.01.50` | Cheques en Cartera | ASSET | `1.1.01` | `is_reconcilable=True` (auto por tener 2+ puntos) |
| `2.1.05` | Pasivos por Cheques Girados | LIABILITY | `2.1` | `cf_category=FINANCING`, grupo |
| `2.1.05.01` | Cheques Girados por Pagar | LIABILITY | `2.1.05` | `is_reconcilable=True` (auto por tener 2+ puntos) |

Razones de los códigos:

- `1.1.01.50` cuelga del mismo grupo que `1.1.01.16` (Puente TUU). Sub-cuenta
  50 reservada para no chocar con las cajas (11-15), bancos (20-22) ni 16 TUU.
  1.1.05 y 1.1.06 ya estaban tomados para "Cuentas por Cobrar Socios" y
  "Cuentas Puente Activo" (stock, comisiones TUU, IVA comisiones).
- `2.1.05` (nuevo grupo) entre `2.1.04` (Pasivos Financieros) y `2.1.06`
  (Cuentas Puente Pasivo). Esto evita reusar 2.1.04.03 (sub-asumido por
  futuras cuentas financieras) y mantiene simetría con el grupo 1.1.06
  "Cuentas Puente Activo" — los cheques son cuentas puente.
- `2.1.05.01` es la hoja operativa que el operador expone vía UI.

El loop de `populate_ifrs_coa` usa `get_or_create` por `code`, por lo que
la inserción es **idempotente**: re-runs sin `--purge` no duplican ni
modifican cuentas existentes.

### 2. Cablear `AccountingSettings` en el mismo `populate_ifrs_coa`

Agregar 2 entradas al `mapping` que el final del método recorre:

```python
'check_portfolio_account': '1.1.01.50',
'issued_checks_account': '2.1.05.01',
```

`AccountingSettings.objects.get_or_create()` asegura el singleton;
`setattr(settings, field, account)` setea cada FK; `settings.save()`
dispara el signal `post_save ensure_check_portfolio_treasury_account`,
que a su vez invoca `CheckService.ensure_portfolio_account(account=...)`
y `CheckService.ensure_issued_checks_account()`. Estos métodos son
`get_or_create` por `account_type` y crean las `TreasuryAccount` puente
con códigos `CHEQUES-CARTERA` y `CHEQUES-GIRADOS`.

Idempotencia del signal:
- `pre_save` captura el `_prev_check_portfolio_id` desde la DB.
- `post_save` compara `prev == new`; si son iguales, no-op. Re-runs
  seguros.

### 3. Verificación visible en el seed

`setup_demo_data.py::_configure_inventory_accounting` ahora muestra,
junto al resto de mapeos clave, las 2 nuevas entradas
(`Check Portfolio (Asset)` y `Issued Checks (Liability)`) y un
segundo bloque que lista las `TreasuryAccount` puente existentes
(`CHEQUES-CARTERA` y `CHEQUES-GIRADOS`) con su vínculo GL. Esto da
feedback inmediato al operador y al test de smoke que las 2 cuentas
puente están vivas.

### 4. Política de override del operador

El operador puede cambiar la cuenta puente vía UI de Ajustes
Contables en cualquier momento. El signal respeta la transición:

- None → 1.1.01.50: crea la `TreasuryAccount` puente.
- 1.1.01.50 → 1.1.06.04 (cualquier otra ASSET): re-vincula la
  `TreasuryAccount` existente (update de `account_id`). No destruye
  historial.
- 1.1.01.50 → None: la `TreasuryAccount` queda huérfana de FK GL;
  `CheckService.ensure_portfolio_account` levantará `ValidationError`
  en el próximo cheque hasta que se reasigne.

`ensure_issued_checks_account` mantiene un fallback defensivo (crea
`Account 2.1.05.001` con tres ceros si no encuentra settings) — ese
fallback queda documentado pero no es la ruta primaria. La ruta
primaria es ahora el cableado de `populate_ifrs_coa`.

### 5. Sin migración Django nueva

Las FKs `check_portfolio_account` y `issued_checks_account` ya
existen en `accounting/0020` y `accounting/0022` (ambas `null=True,
blank=True, on_delete=SET_NULL`). No se agregan columnas ni índices
nuevos. La creación de las 3 cuentas contables se hace vía
`Account.objects.get_or_create`, que es segura en re-runs.

## Consecuencias

**Positivas:**
- El primer pago con Cheque en el POS funciona out-of-the-box en
  cualquier entorno que haya corrido `populate_ifrs_coa` (incluyendo
  la demo). Se elimina la fricción "configurar antes de usar".
- El patrón queda alineado con `PUENTE-TUU`: el seed pre-cablea tanto
  la cuenta contable como la `TreasuryAccount` puente.
- El operador mantiene control total: puede reasignar la cuenta
  puente vía UI sin regenerar el seed.
- Idempotencia total: re-runs sin `--purge` son no-op; re-runs con
  `--purge` reconstruyen todo limpiamente.

**Trade-offs / neutrales:**
- +3 cuentas en el CoA de cualquier instancia con `populate_ifrs_coa`
  ejecutado. No invasivo, mismo patrón que el seed de TUU.
- La `2.1.05.001` (con tres ceros) del fallback defensivo en
  `ensure_issued_checks_account` queda como reliquia histórica: si
  alguna vez se ejecuta sin `populate_ifrs_coa`, crea una cuenta
  "alternativa" con código distinto. Es seguro, pero la divergencia
  de códigos puede confundir a un auditor. **Decisión**: dejar el
  fallback tal cual; el camino normal es vía `populate_ifrs_coa`.

**Fuera de alcance:**
- Crear un `PaymentMethod` con `method_type='CHECK'` y
  `allow_for_sales=True` — el modelo lo prohíbe vía `clean()`. El
  Cheque en POS sigue siendo virtual vía `POSTerminal.allows_check`
  (cf. ADR-0032).
- Modificar el comportamiento de `CHECKING` (TreasuryAccount) para
  ofrecer cheque como medio cobrable. Hoy se considera que el patrón
  de "medio hardcodeado vía `POSTerminal.allows_check`" es el
  correcto y suficiente.
- Cheques girados (ISSUED) con `PaymentMethod` de `allow_for_purchases=True`:
  el flujo de pago a proveedor con cheque propio sigue funcionando vía
  `CheckService.issue()` sin necesidad de un `PaymentMethod` CHECK en
  la base (idem ADR-0032).

## Referencias

- Backend:
  - `backend/accounting/services.py` — `populate_ifrs_coa` (modificado)
  - `backend/accounting/models.py:700-711` — `AccountingSettings.check_portfolio_account` y `issued_checks_account`
  - `backend/accounting/migrations/0020` y `0022` — columnas FK
  - `backend/treasury/check_service.py:464-546` — `ensure_portfolio_account` y `ensure_issued_checks_account`
  - `backend/treasury/signals.py:180-219` — `ensure_check_portfolio_treasury_account`
  - `backend/core/management/commands/setup_demo_data.py` — `_configure_inventory_accounting` (modificado, display de cheque)
- Tests:
  - `backend/treasury/tests/test_check_portfolio_signal.py` (8 tests pre-existentes, sigue verde)
  - `backend/treasury/tests/test_orchestrator_check.py`
- ADRs previos:
  - ADR-0031 — taxonomía CAPA 1 / CAPA 2 (TUU bridge)
  - ADR-0032 — cheques recibidos y cuenta puente
  - ADR-0035 — cheques girados y endosos
