---
id: 0130
title: Diferencias de efectivo del POS contra la cuenta de su motivo, sin caer en CxC/CxP
status: Accepted
date: 2026-11-11
author: backend-team
---

# 0130 — Diferencias de efectivo contra la cuenta de su motivo

**Relacionado:** ADR-0128 (opciones de justificación), ADR-0129 (efectivo al cerrar).

## Contexto

Las diferencias de apertura y cierre se justifican con un motivo cuya cuenta contable sale de `TreasuryService._get_reason_account`. Sin motivo (`UNKNOWN`), o con uno sin cuenta, el asiento caía en la cuenta por cobrar/pagar por defecto sin avisar. Las cuentas genéricas `pos_cash_difference_gain_account` / `_loss_account` estaban configuradas pero no se usaban, y un traspaso sin cuenta válida se aceptaba con un lado vacío.

## Decisión

1. La diferencia va a la cuenta de su motivo; sin motivo o sin cuenta propia, a «Sobrante de caja» (IN) / «Faltante de caja» (OUT). Si tampoco existe, la apertura o el cierre se rechaza con un mensaje claro: nunca cae en CxC/CxP.
2. Un traspaso exige una cuenta activa y distinta de la propia caja.
3. `justify_options.reasons` informa por motivo si tiene cuenta (más `UNEXPLAINED_GAIN` / `UNEXPLAINED_LOSS`); la UI solo ofrece los motivos con cuenta. Se agregan «Otro egreso», «Otro ingreso» y «Sin explicación».

## Consecuencias

Una instalación sin cuentas configuradas no puede cerrar con diferencia hasta configurarlas.
