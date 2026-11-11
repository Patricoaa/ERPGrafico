---
id: 0131
title: El retiro de socio en el POS siempre nombra al socio
status: Accepted
date: 2026-11-11
author: backend-team
---

# 0131 — El retiro de socio en el POS siempre nombra al socio

**Relacionado:** ADR-0128, ADR-0129, ADR-0130.

## Contexto

Al justificar una diferencia o retirar efectivo al cerrar con «Retiro de socio», el movimiento se creaba sin contacto. Tesorería solo aplica su lógica de socio (dividendos por pagar o retiro provisorio) y crea el `PartnerTransaction` cuando el movimiento trae un socio; sin él, el retiro iba a una cuenta genérica y no aparecía en la ficha del socio.

## Decisión

1. `close_session` acepta `withdrawal_partner_id`, obligatorio cuando `withdrawal_kind="PARTNER_WITHDRAWAL"`. Para una diferencia justificada como retiro de socio (apertura o cierre), `justify_target_id` es el socio.
2. El socio debe estar activo y marcado `is_partner`. El movimiento lleva `partner=<socio>` y, en ese caso, no se fija cuenta de contrapartida: se aplica la lógica de socio existente.
3. `justify_options.partners` entrega solo `id` y `name` de los socios activos. La UI pregunta «¿Qué socio retira?»; con un único socio se toma ese y se omite el paso.

## Consecuencias

El retiro queda a nombre del socio y en su ficha. Queda abierto exigir autorización (pase de operador) para que un cajero no registre retiros a nombre de otro socio.
