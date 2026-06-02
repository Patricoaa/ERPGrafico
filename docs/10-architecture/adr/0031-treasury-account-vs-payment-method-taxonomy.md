---
id: 0031
title: Treasury Account vs Payment Method — Two-Layer Taxonomy
status: Accepted
date: 2026-06-01
author: core-team
---

# 0031 — Treasury Account vs Payment Method — Two-Layer Taxonomy

## Context

`TreasuryAccount` conflaba dos conceptos distintos y los codificaba de forma redundante, haciendo la configuración confusa y abrumadora para el usuario PYME:

- **Dónde está el dinero** (ubicación con saldo + cuenta contable): `CASH`, `CHECKING`, `CREDIT_CARD`, `BRIDGE`, `MERCHANT`.
- **Cómo se paga** (tender), expresado en *tres* lugares que se pisaban:
  - `TreasuryAccount.account_type` con valores `DEBIT_CARD` y `CHECKBOOK`,
  - los flags `allows_cash/card/transfer/check`,
  - y `PaymentMethod.method_type` (`DEBIT_CARD`/`CREDIT_CARD`/`CHECK`...).

`DEBIT_CARD` y `CHECKBOOK` **no son ubicaciones**: una tarjeta de débito gasta *desde* una cuenta corriente; una chequera gira cheques *contra* ella. Además, el operador debía togglear manualmente `allow_for_sales`/`allow_for_purchases` y re-elegir la cuenta en cada método.

## Decision

Separar el dominio en dos capas explícitas:

1. **Capa 1 — Cuentas e Instrumentos** (`TreasuryAccount`): solo ubicaciones reales — `CASH`, `CHECKING`, `CREDIT_CARD`, `MERCHANT`, `BRIDGE` (interna). `DEBIT_CARD` y `CHECKBOOK` quedan **deprecados** como tipos de cuenta.
2. **Capa 2 — Formas de cobro/pago** (`PaymentMethod`): único lugar donde se configura "cómo se paga". `method_type` conserva `DEBIT_CARD`/`CREDIT_CARD`/`CHECK` como tenders sobre una cuenta de Capa 1.

Cambios concretos:

- **Alta guiada + auto-provisión.** Las cuentas nuevas se crean con `TreasuryAccountWizard` (frontend) que recolecta tipo + tenders y llama `POST /treasury/accounts/provision/`. El backend `TreasuryProvisioningService` crea la cuenta y sus `PaymentMethod` lógicos en una transacción atómica. El `TreasuryAccountDrawer` queda solo para ver/editar.
- **Defaults por tipo.** `allow_for_sales/allow_for_purchases` se derivan del `method_type` (débito/crédito empresa → solo compras; terminal → solo ventas; resto → ambos). El toggle pasa a una sección "Avanzado" colapsada.
- **Plomería interna oculta.** `settlement_account` y las cuentas `BRIDGE` no se exponen al operador (se auto-resuelven).
- **Convergencia de datos.** El command `converge_treasury_accounts` (dry-run por defecto, `--apply` para persistir; defensivo e idempotente) re-tipa cuentas `DEBIT_CARD`/`CHECKBOOK` a `CHECKING` y les crea su `PaymentMethod`. Las que no pueden convertirse (p. ej. chequera sin banco/número) se omiten y reportan para resolución manual.

**Fuera de alcance (deferido):** corregir el mapeo contable de `CREDIT_CARD` para que apunte a un **pasivo** (2.x) en vez de `1.1.01`. Se trata en un mini-roadmap separado.

## Consequences

**Positivas:**
- Una sola fuente de verdad para "cómo se paga" (Capa 2); el usuario ve cuentas reales (caja, banco, tarjeta de crédito) en lugar de instrumentos duplicados.
- Menos pasos de configuración (auto-provisión + defaults), menos errores.
- Base limpia para incorporar Cheques y Créditos bancarios como entidades sobre la Capa 1.

**Negativas / pendientes:**
- Requiere correr la convergencia (`--apply`) en cada entorno con datos legacy; las chequeras sin banco/número necesitan resolución manual.
- Los valores `DEBIT_CARD`/`CHECKBOOK` permanecen en el enum `TreasuryAccount.Type` hasta purgar todas las referencias en código (`models.py` `clean()`, `PaymentMethod.TYPE_COMPATIBILITY`); su eliminación del enum es un follow-up gated en "0 cuentas legacy restantes".

## References

- Backend: `backend/treasury/provisioning_service.py`, `backend/treasury/convergence.py`, `backend/treasury/management/commands/converge_treasury_accounts.py`, `TreasuryAccountViewSet.provision`.
- Frontend: `frontend/features/treasury/components/TreasuryAccountWizard.tsx`, `useProvisionAccount`.
- Tests: `backend/treasury/tests/test_provisioning.py`, `backend/treasury/tests/test_convergence.py`.
