---
layer: 50-audit
doc: bancos/00-estado-actual
status: active
owner: core-team
last_review: 2026-06-02
kind: context
---

# Estado actual del dominio bancario

Mapa self-contained de lo que existe hoy. Un agente LLM puede leer esto y saber qué
reutilizar y qué falta, sin explorar el código a ciegas.

## Apps y features

- **Backend:** `backend/treasury` (núcleo bancario), `backend/finances` (estados
  financieros / flujo de caja), `backend/accounting` (plan de cuentas, asientos,
  `AccountingSettings`).
- **Frontend:** `frontend/features/treasury` (+ subcarpeta `checks/`),
  `frontend/features/finance/bank-reconciliation`, `frontend/features/finance`.
- ⚠️ `frontend/features/credits` = **cartera de crédito de CLIENTES** (sobre `contacts`),
  **no** créditos bancarios. No confundir.

## Eje central (cómo se relaciona todo)

```
Bank ──< TreasuryAccount ──1:1── accounting.Account (exclusiva)
              │                    (ASSET 1.1.01 efectivo, o LIABILITY para tarjeta crédito)
              └──< TreasuryMovement ──1:1── JournalEntry (DRAFT)   ← _create_accounting_entry()
                        │  (INBOUND / OUTBOUND / TRANSFER / ADJUSTMENT)
              alloc GFK · invoice/sale_order/purchase_order/payroll · pos_session ·
              terminal_batch · bank_statement_line · reconciliation_match · check
```

- `TreasuryService.create_movement(...)` (`treasury/services.py:13`) es el **único** punto
  que crea un movimiento **y** su asiento. Toda nueva entidad financiera debe generar sus
  movimientos a través de él. La doble partida ya funciona con cuentas de pasivo como
  origen/destino (validado con tarjeta de crédito y cuenta puente de cheques).
- Cuentas configurables del negocio → `accounting.AccountingSettings` (singleton,
  `get_solo()`), FK a `Account`.

## Modelo de tesorería (taxonomía vigente — ADR-0031)

`TreasuryAccount.Type`:
- `CASH` — caja física (ASSET 1.1.01).
- `CHECKING` — cuenta bancaria corriente/vista (ASSET 1.1.01, requiere bank + número).
- `CREDIT_CARD` — tarjeta de crédito propia (**LIABILITY**, deuda rotativa).
- `BRIDGE` — puente/clearing de terminales (system-managed).
- `MERCHANT` — recaudadora/pasarela (system-managed).
- `CHECK_PORTFOLIO` — "Cheques en Cartera" (ASSET, system-managed; ADR-0032).
- `DEBIT_CARD`, `CHECKBOOK` — **DEPRECADOS** como tipos de cuenta (son formas de pago).
  Permanecen en el enum hasta purgar referencias y converger datos (ver Fase 1).

`PaymentMethod` = Capa 2 ("cómo se paga"): tipos `CASH/TRANSFER/DEBIT_CARD/CREDIT_CARD/
CARD_TERMINAL/CHECK`, con `allow_for_sales`/`allow_for_purchases` derivados del tipo.
Alta de cuentas vía `TreasuryAccountWizard` que auto-provisiona los métodos
(`TreasuryProvisioningService`, `POST /treasury/accounts/provision/`).

## Inventario de procesos

| Proceso | Estado | Dónde / Pendiente |
|---------|--------|-------------------|
| Banco | ✅ | `treasury.Bank` |
| Cuenta bancaria / cuentas de tesorería | ✅ | `TreasuryAccount` + wizard + provisión |
| Movimiento de tesorería | ✅ | `TreasuryMovement` (hub) |
| Conciliación bancaria | ✅ maduro | `BankStatement`/Line, `ReconciliationMatch`, matching engine, `bank-reconciliation-roadmap.md` |
| Adquirencia tarjeta (cobrar con terminal) | ✅ maduro | `TerminalBatch` + `PaymentTerminalProvider`/`Device` + factura mensual |
| Tarjeta de crédito propia — mapeo pasivo | ✅ | `clean()` exige LIABILITY (ADR-0031) |
| Tarjeta de crédito propia — estado/pago | ❌ | **Fase 3** |
| Cheques recibidos de terceros | ✅ | `Check` + `CheckService` + `CHECK_PORTFOLIO` (ADR-0032) |
| Cheques propios girados / endoso / folios | ❌ | **Fase 4** |
| Créditos bancarios (préstamos) | ❌ | **Fase 2** |
| Pago de créditos bancarios (cuotas) | ❌ | **Fase 2** |
| Indexación UF / tipo de cambio | ❌ | No existe modelo `ExchangeRate`/UF → **Fase 2** |
| Centro de Bancos unificado | ❌ | **Fase 5** |
| Proyección de flujo de caja con vencimientos | ⚠️ parcial | `FinanceService.get_cash_flow` (`finances/services.py:267`) no incluye cuotas/cheques/tarjeta → **Fase 5** |
| Cuentas de gasto financiero (intereses, seguros) | ❌ | `AccountingSettings` no las tiene → **Fase 5** |

## Entregado en `feat/integración-bancaria` (referencia)

- `feat(treasury): taxonomía de dos capas` (`0c064735`) — provisión + wizard + convergencia.
- `feat(treasury): tarjeta de crédito como pasivo` (`294c15e8`) — migración `0048`.
- `feat(treasury): cartera de cheques recibidos` (`47bf7a3a`) — `Check`, `CheckService`,
  `CHECK_PORTFOLIO`, migraciones `treasury/0049` + `accounting/0020`, ADR-0032.

## Servicios y archivos clave a reutilizar

| Necesidad | Reutiliza |
|-----------|-----------|
| Crear movimiento + asiento | `TreasuryService.create_movement` (`treasury/services.py`) |
| Saldar factura/orden al pagar | `TreasuryService.update_related_document_status` |
| Provisión cuenta + métodos | `TreasuryProvisioningService` (`treasury/provisioning_service.py`) |
| Lifecycle con estados + reversa (ejemplo) | `CheckService` (`treasury/check_service.py`) |
| Cuenta puente system-managed (ejemplo) | `TreasuryAccount.Type.CHECK_PORTFOLIO` |
| Entidad con status + JE + movimiento (ejemplo) | `TerminalBatch` (`treasury/models.py`) |
| Cuentas configurables | `accounting.AccountingSettings` |
| Celery task | `treasury/tasks.py` (`@shared_task`) + `config` beat schedule |
| Flujo de caja | `finances/services.py:get_cash_flow` |
| Settings UI | `frontend/features/settings/components/TreasurySettingsView.tsx` |
| Badge de estado | `frontend/lib/badge-resolvers.ts` (`STATUS_MAP`) |

## Entorno de verificación real

El sandbox SQLite no corre migraciones (Postgres-specific SQL en `treasury/0008`). La
verificación canónica es contra **Postgres + Redis reales** en el dev box:

```bash
ssh pato@192.168.1.93
# El checkout /home/pato/ERPGrafico se sincroniza desde el working tree local
docker exec erpgrafico-backend-1 sh -c 'cd /app && python manage.py migrate'
docker exec erpgrafico-backend-1 sh -c 'cd /app && python manage.py makemigrations --check'
# pytest no está en la imagen de prod: instalar on-the-fly o ejercitar vía manage.py shell
docker exec -i erpgrafico-backend-1 sh -c 'cd /app && python manage.py shell' < script.py
```

Para tests que crean datos: envolver en `transaction.atomic()` + `transaction.set_rollback(True)`
para no dejar datos en la DB de dev.
