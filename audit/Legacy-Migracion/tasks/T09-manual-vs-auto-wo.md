# T09 — Manual vs auto WorkOrder (decision: always manual)

> **Phase**: 3
> **Tiempo estimado**: 10 min
> **Complejidad**: baja (decisión, no código nuevo)

## Precondiciones

- [ ] T08 cerrada.

## Decisión

**Todas las NVs legacy crean una OT `is_manual=True` finalizada.**

Razones:
1. El legacy no siguió ningún flujo de producción: cada NV es "histórica".
2. Re-ejecutar el flujo de producción para 7.960 NVs es costoso y sin valor.
3. La OT se crea para que el equipo de producción pueda consultarla/editar si necesita.

## Implementación

Esta tarea es de **decisión, no de código**. Se documenta en:

- `04-backend-import-pipeline.md` §7.
- `phases/phase-4-work-orders.md`.

La implementación concreta está en T11 (`build_work_order_for_legacy_note`).

## Configuración futura (opcional)

Si en el futuro se quiere permitir OTs auto para NVs nuevas que vengan de integraciones, se introduce un setting:

```python
# backend/legacy/settings.py
LEGACY_WO_MODE = 'manual'  # 'manual' | 'auto'
```

Por ahora **siempre manual**, no se introduce el setting.

## DoD

- [ ] Decisión documentada en `01-architecture-decision.md` y `04-backend-import-pipeline.md`.
- [ ] `phases/phase-4-work-orders.md` refleja la decisión.
- [ ] T11 implementa la OT manual con `is_manual=True` y `current_stage='FINISHED'`.

## Comandos de verificación

```bash
grep -r "is_manual=True" backend/legacy/
grep -r "LEGACY_WO_MODE" backend/legacy/  # debe no aparecer
```

## Riesgos

- **Futuro cambio de decisión**: si se quiere auto OT, hay que refactorizar el builder. Aceptable.
