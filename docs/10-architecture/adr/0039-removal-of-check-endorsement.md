---
id: 0039
title: Remoción del endoso de cheques recibidos
status: Accepted
date: 2026-06-04
author: core-team
supersedes: 0035 (parcial — sección "Endoso de cheques recibidos")
---

# 0039 — Remoción del endoso de cheques recibidos

## Contexto

ADR-0035 introdujo en F4.2 el endoso de cheques recibidos: el operador podía
entregar un cheque de tercero a un proveedor como medio de pago (`endorse()`),
lo que generaba un `TreasuryMovement` OUTBOUND desde `CHECK_PORTFOLIO` saldando
al proveedor y dejando el cheque en estado terminal `ENDORSED`.

En la práctica operativa el flujo no se usa:

- El POS no expone el endoso como medio de pago (`PaymentMethod.method_type` no
  acepta `CHECK` con `allow_for_purchases=True`; cf. ADR-0038 §"Fuera de
  alcance"). La compra a proveedor con cheque de un tercero se modela hoy vía
  un `TreasuryMovement` OUTBOUND manual con `payment_method=OTHER`, no vía
  `CheckService.endorse`.
- Los pagos a proveedor con cheque se hacen con **cheques propios** (F4.1
  `CheckService.issue`), no endosando cheques de clientes — el endoso
  introduce un riesgo de contraparte (firmar/endosar un cheque sin certeza de
  cobro) que no compensa frente a emitir un cheque propio.
- El cheque queda fuera del control del operador al endosarlo: ya no aparece
  en cartera ni en tránsito, y si el proveedor no logra cobrarlo, el protesto
  (`bounce()`) deja de aplicar — solo podría gestionarse como incobrable
  manual, sin flujo.
- El estado `ENDORSED` y los campos `endorsed_to` / `endorsement_movement`
  añadidos en la migración `0053` nunca llegaron a producción con datos
  significativos (F4.2 se cerró pero la fase siguiente F4.5 de reportería ya
  ignora el estado).

Adicionalmente, el estado `ENDORSED` arrastraba un **typo en el valor de
TextChoices**: `models.py:1896` declara `ENDORSED = 'ENDORSSED'` (tres eses).
Esto significa que cualquier `Check.objects.filter(status='ENDORSED')` no
devolvía filas, y los cheque endosados quedaban en el limbo
`'ENDORSSED'` ↔ `'ENDORSED'`. La remoción elimina el bug de raíz.

## Decisión

Eliminar completamente el dominio del endoso:

1. **Backend** — Remover `CheckService.endorse`, `CheckViewSet.endorse`,
   `Check.endorsed_to` (FK Contact), `Check.endorsement_movement`
   (OneToOne TreasuryMovement), y el valor `ENDORSED` del `Status.choices`
   en `Check` y `HistoricalCheck`.
2. **Frontend** — Remover el modal `CheckEndorseModal`, la acción "Endosar"
   en `ChecksView`, la mutation `endorse` en `useCheckMutations`, el método
   `endorse` en `checksApi`, y el literal `'ENDORSED'` de `CheckStatus`.
3. **Contratos** — Actualizar `docs/20-contracts/state-map.md` quitando la
   fila `ENDORSED` del state machine del Check y los bullets contables
   asociados. La tabla pasa de 7 estados a 6.
4. **Migraciones** — Dos migraciones nuevas:
   - `0064_data_migrate_endorsed_checks_to_portfolio.py` (RunPython): cualquier
     `Check` con `status='ENDORSSED'` o `status='ENDORSED'` se migra a
     `IN_PORTFOLIO` antes de tocar el schema. Cubre datos históricos de
     entornos de demo que usaron la feature en F4.2.
   - `0065_remove_check_endorsed_state_and_fields.py` (schema): `RemoveField`
     para los 4 campos (2 del modelo + 2 de la tabla histórica) y
     `AlterField` para el `choices` del `status` (sin `ENDORSED`).
5. **ADR-0035** — Marcar como "parcialmente superseded por 0039" en su
   frontmatter. La parte de cheques girados (`issue`/`mark_cashed`/`void`
   desde `ISSUED`) sigue vigente; solo la sección de endoso queda sin efecto.

## Consecuencias

**Positivas:**

- Se elimina un bug latente (typo `'ENDORSSED'` en `Status.ENDORSED`).
- Se reduce la superficie de UI: la vista `ChecksView` queda con 5 acciones
  por fila (`deposit`, `clear`, `bounce`, `mark_cashed`, `void`) en vez de 6.
- El state machine del cheque pasa de 7 a 6 estados, alineado con el patrón
  `IN_PORTFOLIO → DEPOSITED → {CLEARED, BOUNCED}` que es el flujo real.
- Quitar el estado terminal huérfano `ENDORSED` elimina la necesidad de
  manejarlo en filtros, KPIs, reportería y validaciones.

**Trade-offs / neutrales:**

- Si en el futuro se quisiera re-introducir el endoso, hay que rehacer el
  flujo (modelo + servicio + UI). La barrera es intencional: queremos que
  cualquier reintroducción venga con un ADR explícito, no como un "des-comentar".
- El historial (`HistoricalCheck`) preserva los registros con el valor
  `ENDORSSED` original. No se modifican (django-simple-history es append-only
  por diseño). Esto es aceptable: la historia refleja lo que pasó, no lo que
  el modelo permite hoy.
- El `test_state_map_consistency` no cubre `Check` (no está en
  `STATE_MAP_ENTITIES`), por lo que remover `ENDORSED` no rompe ese test. La
  cobertura de consistencia del state machine para `Check` es implícita vía
  los tests de `CheckService._assert_transition`.

**Fuera de alcance:**

- Modificar el comportamiento de cheques protestados (`bounce`) que sean
  resultado de un endoso previo. La realidad es que nunca hubo endosos en
  producción, por lo que no aplica.
- Cambiar el patrón de "medio de pago cheque" en POS (cf. ADR-0032 §"Medio
  de pago"). El cheque propio (`issue`) y el cheque en cartera (`receive`)
  siguen exactamente igual.
- Implementar un flujo alternativo de "pago a proveedor con cheque de
  tercero". Si surge la necesidad, se discute en un ADR aparte (cambia la
  arquitectura del orquestador de pagos).

## Alternativas consideradas

1. **Solo marcar como deprecated con headers `Deprecation` + `Sunset`** (Phase 2
   del playbook `deprecate-feature.md`). Rechazado: la feature nunca pasó de
   demo, no hay consumidores en producción que migrar, y mantener un código
   muerto 30+ días solo para borrarlo no aporta valor.
2. **Reemplazar endoso por factoring/descuento de cheques**. Rechazado: el
   alcance funcional de "adelanto de fondos sobre un cheque en cartera" es
   distinto y requiere un modelo aparte (operador, fecha de descuento,
   comisiones). No es lo que se está pidiendo.
3. **Mover el endoso a un módulo "circulación de documentos" opt-in**.
   Rechazado: añadiría complejidad (un nuevo app, una nueva entidad, una
   nueva pantalla) para una acción que el operador no usa. Mejor remover y
   volver a evaluar si la necesidad surge.

## Referencias

- ADR-0032 — cheques recibidos y cuenta puente.
- ADR-0035 — cheques girados y endosos (superseded parcialmente por 0039).
- ADR-0038 — seed del puente Cheques en Cartera.
- Playbook [deprecate-feature.md](../../30-playbooks/deprecate-feature.md).
- Backend:
  - `backend/treasury/models.py:1874-2044` (modelo Check).
  - `backend/treasury/check_service.py:387-425` (`endorse`, a remover).
  - `backend/treasury/views.py:1522-1533` (`CheckViewSet.endorse`, a remover).
  - `backend/treasury/migrations/0053_check_issued_endorsed_fields.py` (los
    campos `endorsed_to` y `endorsement_movement` que se eliminan).
- Frontend:
  - `frontend/features/treasury/checks/CheckEndorseModal.tsx` (a eliminar).
  - `frontend/features/treasury/checks/ChecksView.tsx:147-149,262-268`
    (botón y modal, a remover).
  - `frontend/features/treasury/checks/hooks.ts:88-93` (mutation, a remover).
  - `frontend/features/treasury/checks/api.ts:45-48` (método, a remover).
  - `frontend/features/treasury/checks/types.ts:1` (literal, a remover).
- Contratos:
  - `docs/20-contracts/state-map.md:222-260` (state machine del Check, a
    actualizar).
- Tests a remover:
  - `backend/treasury/tests/test_checks.py:286-342` (sección F4.2 endorse).
