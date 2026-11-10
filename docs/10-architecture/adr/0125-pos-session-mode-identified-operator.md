---
id: 0125
title: Modo de caja multiusuario y operador identificado en el POS
status: Accepted
date: 2026-11-10
author: backend-team
---

# 0125 — Modo de caja multiusuario y operador identificado en el POS

**Relacionado:** ADR-0122 (eliminación del PIN de POS), ADR-0091 (edit policy), ADR-0121 (panel de ventas del POS). Spec: `docs/superpowers/specs/2026-11-10-pos-modo-multiusuario-operador-design.md`.

## Contexto

El POS atribuye todo a `request.user`, la cuenta que inició sesión en el dispositivo: borradores, ventas (`salesperson`), retiros y movimientos (`created_by`), cierre (`closed_by`) e historial (`simple_history`). En cajas compartidas varias personas operan sobre un único login que dura días, así que no se sabe quién hizo cada cosa. El ADR-0122 eliminó el PIN, único mecanismo que separaba persona de login.

## Decisión

1. **Modo de caja.** `POSSession.mode` ∈ {`SINGLE` (defecto), `MULTI`}, elegido en el wizard de apertura, inmutable con la sesión abierta y expuesto de solo lectura. `SINGLE` no cambia en nada.
2. **Operador identificado (solo `MULTI`).** Cada transacción inicializadora exige un *pase de operador* (`POSOperatorPass`): crear/retomar un borrador, registrar un retiro o movimiento, cerrar la sesión y modificar un documento desde los drawers de ventas. El pase se emite con `POST pos-sessions/{id}/identify_operator/`, viaja en el header `X-POS-Operator-Pass` (guardado como sha256), va atado a sesión, operador, cuenta del dispositivo, pestaña (`tab_key` = clave del bloqueo de borradores), propósito y destino.
3. **Vida del pase.** Emitir un pase invalida el anterior de la misma sesión y pestaña. Borrador: vive mientras la pestaña conserve el bloqueo (30 min sin destino). Movimiento y cierre: un solo uso, vencen a los 5 min. Documento: termina al salir de él.
4. **Rechazo.** Sin pase válido el backend responde 403; por el manejador global de errores el código queda en `error.details.code = "pos_operator_required"` junto a `error.details.purpose`. El cliente abre el selector y reintenta con una `Idempotency-Key` nueva.
5. **Atribución.** En `MULTI` el actor es el operador; en `SINGLE`, `request.user`. La regla «solo quien abrió o un superusuario cierra» (#233) se evalúa contra el operador.
6. **Seguimiento.** `SaleTrackingEvent` (app `sales`) guarda quién tocó cada paso del borrador (una fila por borrador y paso, actualizada en sitio), pasa a la orden al cobrar (+ evento `CHECKOUT`) y suma una fila por cada edición posterior desde los drawers. Se expone en `GET sales/orders/{id}/tracking/` y en la pestaña «Seguimiento» de la ficha de la orden.
7. **Primera edición = registro de buena fe.** El operador se elige de una lista; no hay secreto. Cualquiera puede elegir el nombre de otro y la interfaz no lo presenta como verificación. `POSOperatorService.verify_identity` es el único punto donde entrarán PIN y tarjeta; esa edición **reemplazará** este ADR (y completará lo que el ADR-0122 quitó).
8. `simple_history` sigue registrando la cuenta del dispositivo; el operador se obtiene del seguimiento y de los pases (que no se borran).

## Consecuencias

- Las cajas de un solo usuario no cambian (ningún modal, clic ni espera extra).
- En `MULTI` la exigencia vive en el backend: llamar a la API sin pase falla aunque se salte la pantalla.
- Riesgo asumido: en `MULTI` solo un operador igual a la cuenta que abrió la sesión (o un superusuario) puede cerrarla.
- Cerrar una sesión `MULTI` desde el listado de sesiones (fuera de la pantalla del POS) no tiene selector y devuelve el 403; se cierra desde el POS.
- Tras un pase superado por otra identificación en la misma pestaña, la siguiente modificación vuelve a pedir operador; el carrito en pantalla no se pierde.

## Alternativas

- **PIN/tarjeta desde el inicio:** descartado por el dueño del producto para la primera edición.
- **Token firmado en lugar de fila:** no permite invalidar al emitir otro ni sirve de registro.
- **Cambiar el modo a mitad de sesión:** fuera de alcance; se cierra y se abre otra.
