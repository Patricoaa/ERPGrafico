---
id: 0135
title: Toda cuenta contable de socio se contabiliza en una subcuenta por socio
status: Accepted
date: 2026-11-12
author: backend-team
---

# 0135 — Subcuentas contables por socio

## Contexto

`AccountingSettings` guarda cuentas globales de socio (capital social, aportes, retiros provisorios, utilidades retenidas, dividendos por pagar, aportes por cobrar). Solo capital social y aportes por cobrar se resolvían a una subcuenta por socio (`_resolve_partner_*`); el resto se contabilizaba directo en la cuenta global. Si la cuenta global tenía hijos (datos demo, o subcuentas creadas a mano), `JournalItem.clean` la rechazaba («tiene subcuentas y no es seleccionable») y, por ejemplo, ejecutar una distribución respondía 400.

## Decisión

1. Las siete cuentas de socio se contabilizan siempre en la **subcuenta del socio** bajo la cuenta global, creada la primera vez que se necesita (`contacts/partner_accounts.resolve_partner_account`). Crear al socio no crea cuentas.
2. Nombre: `{cuenta padre} - {socio}`. Si otro socio **más antiguo** tiene el mismo nombre, se agrega el identificador: `{cuenta padre} - {socio} ({SOC-id})`, de modo que nunca haya dos subcuentas con el mismo nombre. La búsqueda compara el sufijo, así que tolera renombrar la cuenta padre.
3. `PartnerService._resolve_partner_{receivable,social,contribution,withdrawal,retained,dividends}_account` son los únicos puntos de entrada; distribución, pagos de dividendos, tesorería e inventario los usan.
4. La cuenta de resultado del ejercicio (`partner_current_year_earnings_account`) no es por socio.

## Consecuencias

- Los asientos nuevos en esas cuentas van a hojas; el saldo de la cuenta global es la suma de sus hijos. Los asientos antiguos que ya estuvieran en la cuenta global quedan ahí.
- Limitación conocida: el vínculo cuenta↔socio es el nombre; renombrar a un socio hace que se cree una subcuenta nueva. Un vínculo explícito (campo `partner` en `Account`) requeriría migración y queda como mejora.
- Se agregó `partner=` al apunte de dividendos por pagar de la ejecución de distribución, que no lo tenía.
