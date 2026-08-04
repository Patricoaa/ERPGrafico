---
id: 0070
title: Primary = Process Black K100 (placa Key) — ratificación de la decisión de julio
status: Accepted
date: 2026-08-04
author: core-team
---

# 0070 — Primary = Process Black K100 (placa Key)

## Context

El `2026-07-13` (commit `4e30400cd`, "style(theme): change primary color to Vercel black") el intent `primary` cambió de Process Cyan (`0.65 0.18 235`) a negro en modo claro (`0 0 0`) y casi-blanco en modo oscuro (`0.99 0 0`). El cambio se hizo **sin ADR** y **sin sincronizar los contratos**: `color-system.md §3.1` y `design-system.md` siguen documentando primary = Process Cyan, incluso tras la auditoría DOC>APP lote 1 (2026-08-04). El `color-system.contract.test.ts` no detectó el drift porque solo verifica estructura (ring → primary), no el valor de `--primary-raw`.

Problemas verificados:

1. **Hueco de gobernanza.** §11 del contrato exige ADR para cambiar el alias de un intent Layer 2. El cambio de julio violó esa regla.
2. **Contrato ↔ implementación desincronizado.** Docs dicen cyan; el código usa negro/blanco. Un agente que lea los contratos y otro que lea `globals.css` producen UI distintas.
3. **Test ciego al valor.** El test garantiza que `--ring-raw` derive de `--primary-raw` pero no qué valor tiene `--primary-raw`.

## Decisión

1. **Ratificar negro/blanco como `primary`.** El color queda como está en el código: `0 0 0` en `:root`, `0.99 0 0` en `.dark`. No hay churn de tokens ni de los ~290 usos que consumen `bg-primary`/`text-primary`.
2. **Nombrar el concepto: Process Black K100 (placa Key).** En la imprenta, K (Key) es la placa de tinta negra que define el detalle y el contraste del trabajo. Un primary negro de alto contraste es *más* coherente con la identidad CMYK de ERPGrafico que cyan: es literalmente la tinta que el operador reconoce. Cyan queda reservado como color de **énfasis** (sidebar, ring, chart-1, chips categóricos, ColorBar).
3. **Sincronizar contratos.** `color-system.md §3.1/§5/§6`, `design-system.md` ("Primary identity") y `GOVERNANCE.md` pasan a documentar primary = Process Black K100.
4. **Fortalecer el contract test.** Agregar asertos sobre el *valor* de `--primary-raw` en `:root` y `.dark`, y sobre `--color-sidebar-primary` derivando de primary.

## Consecuencias

- **Positivo:** se cierra el hueco de gobernanza; los contratos vuelven a reflejar la implementación; el test detectaría futuros cambios de valor; la identidad se reafirma con la placa Key como tinta primaria de UI.
- **Neutral:** los ~290 usos de `bg-primary`/`text-primary` no cambian (mismo valor que hoy).
- **Riesgo:** un lector de contratos que confiara en cyan para "marca" debe ahora entender que la marca de *énfasis* es cyan y la de *acción primaria* es K100. Esto queda documentado en DESIGN.md y en §3.1.

## Alternativas consideradas

- **Revertir a Process Cyan.** Rechazado: pierde contraste sobre superficies claras (objetivo de densidad operativa), contradice la decisión ya tomada y fuerza churn en ~290 usos.
- **Híbrido (primary K100 + sidebar-primary/ring cyan).** Rechazado: suma superficie de sync (dos tokens en vez de uno) sin aportar a la densidad; cyan de énfasis ya vive en `--color-cyan` y chart-1.

## References

- Contract: [color-system.md](../../20-contracts/color-system.md) (§3.1 primary, §5 dark adaptation, §6 sidebar)
- [design-system.md](../design-system.md) ("Primary identity")
- [GOVERNANCE.md](../../90-governance/GOVERNANCE.md)
- Implementation: `frontend/app/globals.css` (`:root` y `.dark`, `--primary-raw`)
- Test: `frontend/lib/__tests__/color-system.contract.test.ts`
- Commit del cambio original: `4e30400cd` (2026-07-13)
