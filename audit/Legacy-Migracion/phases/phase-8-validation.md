# Phase 8 — Validation

> Cierre del proyecto: ADR final, smoke scripts, reconciliación de datos, documentación de deprecación.

## Precondiciones

- [ ] Phases 1–7 cerradas.
- [ ] Todos los `T-NN` tienen ✅.
- [ ] `pytest` y `npm run test` verdes.

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T36](../tasks/T36-adr-0029.md) | ADR-0029 firmado | `docs/10-architecture/adr/0029-legacy-migration.md` |
| [T37](../tasks/T37-smoke-scripts.md) | Smoke scripts | `scripts/smoke_legacy_import.sh` + `scripts/smoke_legacy_api.sh` |

## Entregables

- `docs/10-architecture/adr/0029-legacy-migration.md` con estado "Accepted" y firmas.
- `scripts/smoke_legacy_import.sh` (ejecutable).
- `scripts/smoke_legacy_api.sh` (ejecutable).
- Reporte de reconciliación ejecutado y archivado en `docs/50-audit/Legacy-Migracion/RECONCILIATION-2026-06-02.md`.
- Tag de release: `vX.Y.Z+legacy-import`.

## DoD de la fase

- [ ] ADR-0029 firmado por los 3 revisores (backend, frontend, PO).
- [ ] `bash scripts/smoke_legacy_import.sh` ejecuta 4 stages + idempotencia y termina con `OK: smoke import completo`.
- [ ] `bash scripts/smoke_legacy_api.sh` ejecuta 5 curls y termina con `OK: smoke API completo`.
- [ ] Reconciliación cuadra: 2.843 clientes + 137 vendedores + 7.980 NVs + 8.556 pagos + 7.980 OTs = 27.496.
- [ ] `pytest` verde en `backend/`.
- [ ] `npm run type-check` y `npm run lint` verdes en `frontend/`.
- [ ] Tag de release pusheado.

## Decisiones tomadas en esta fase

1. **ADR-0029** se numera con el siguiente correlativo al último ADR existente (verificar `docs/10-architecture/adr/`).
2. **Smoke scripts** son ejecutables (`chmod +x`) y se commitean al repo.
3. **Reporte de reconciliación** es un `.md` con el output del comando shell, archivado por fecha.
4. **Tag de release** sigue semver: `vMAJOR.MINOR.PATCH+legacy-import` (sufijo descriptivo).
5. **Documentación de deprecación** se crea como `docs/50-audit/Legacy-Migracion/DEPRECATION.md` con el playbook a seguir cuando se decida re-importar como `SaleOrder` real.

## ADR-0029 (T36)

```markdown
# ADR-0029: Migración de notas de venta legacy

## Estado
Accepted — 2026-06-02

## Contexto
[copiar de 01-architecture-decision.md]

## Decisión
[copiar de 01-architecture-decision.md]

## Consecuencias
[copiar de 01-architecture-decision.md]

## Revisores
- [ ] Mantenedor backend — @username — YYYY-MM-DD
- [ ] Mantenedor frontend — @username — YYYY-MM-DD
- [ ] PO del módulo de ventas — @username — YYYY-MM-DD
```

## Smoke scripts (T37)

Ver `08-testing-and-validation.md` §3 para el código completo.

**`smoke_legacy_import.sh`** ejecuta 4 stages + idempotencia, valida counts.
**`smoke_legacy_api.sh`** ejecuta 5 curls con `jq` para validar shape.

## Reporte de reconciliación

`docs/50-audit/Legacy-Migracion/RECONCILIATION-2026-06-02.md`:

```markdown
# Reconciliación 2026-06-02

## Conteos finales

| Tabla | Esperado | Real | OK |
|---|---|---|---|
| contacts_contact | ≥ 2843 | <n> | ✅ |
| legacy_contactlegacyorigin | 2843 | <n> | ✅ |
| legacy_legacyvendor | 137 | <n> | ✅ |
| legacy_legacysalenote | 7980 | <n> | ✅ |
| legacy_legacypayment | 8556 | <n> | ✅ |
| production_workorder (legacy: is_manual FINISHED) | 7980 | <n> | ✅ |
| legacy_legacyimport (COMPLETED) | ≥ 1 | <n> | ✅ |

## Riesgos materializados
- 1 RUT inválido con tax_id_exception=True.
- 20 NVs anuladas omitidas.
- 31 NVs sin pagos históricos.

## Tests
- pytest: <N> tests passed.
- npm test: <N> tests passed.
- npm run type-check: OK.
- npm run lint: OK.

## Tag
vX.Y.Z+legacy-import

## Decisión de cierre
✅ Proyecto cerrado.
```

## Documentación de deprecación

`docs/50-audit/Legacy-Migracion/DEPRECATION.md`:

```markdown
# Deprecación futura de la app `legacy`

## Trigger
Cuando se decida re-importar todas las NVs como `SaleOrder` real.

## Pasos
1. Marcar `ContactLegacyOrigin.migrated_at` por cada `Contact` (nueva columna nullable).
2. Re-importar con un nuevo importador que cree `SaleOrder` reales (sin `LegacySaleNote`).
3. Switch del flag `?include=legacy` → `?include=none` en el frontend (commit único).
4. Marcar `LegacyImport.status='DEPRECATED'` para todos los runs.
5. Deprecar app `legacy` siguiendo `deprecate-feature.md`.
6. Mantener `LegacyPaymentRegistration` para auditoría de pagos nuevos históricos.

## Compatibilidad
- Mientras `?include=none` esté activo, el frontend NO ve NVs legacy.
- Las NVs legacy ya re-importadas como `SaleOrder` se ven en su lugar.
- Los pagos nuevos sobre NVs legacy que ya no existen se preservan en `LegacyPaymentRegistration` con FK rota a `LegacySaleNote` (que se borrará).

## Reversibilidad
- La app `legacy` se puede reactivar cambiando `?include=none` → `?include=legacy` en el frontend.
- Los datos legacy se pueden volver a importar desde CSV/DSN.
```

## Tag de release

```bash
git tag -a vX.Y.Z+legacy-import -m "Migración de NVs legacy completada (7.980 NVs + 8.556 pagos + 7.980 OTs + 2.843 clientes + 137 vendedores)"
git push origin vX.Y.Z+legacy-import
```

## Comunicación al equipo

Email/Slack al equipo de ventas:

> "Las NVs legacy ya están integradas en el módulo de ventas. Las verán con un chip 'LEGACY' ámbar. Pueden buscar por número (ej. 'NV-12.345'), ver el detalle (read-only), y registrar pagos nuevos. Si tienen preguntas, contactar a @equipo-migracion."

## Monitoreo post-deploy (1 semana)

- [ ] Logs de `legacy.import` revisados (no debe haber errores nuevos).
- [ ] Conteos de `LegacyPaymentRegistration` revisados (debe crecer ~5–10 por día).
- [ ] Tickets de soporte sobre el chip, búsqueda, o drawers read-only (esperado: 0 o pocos).
- [ ] Performance: `SalesOrdersView?include=legacy` load time < 2s.

## Cierre del proyecto

Una vez cumplimentado el DoD:

1. ✅ ADR firmado.
2. ✅ Smoke scripts pasan.
3. ✅ Reconciliación cuadrada.
4. ✅ Tag pusheado.
5. ✅ Comunicación enviada.
6. ✅ Monitoreo 1 semana sin issues críticos.

**Proyecto cerrado.**
