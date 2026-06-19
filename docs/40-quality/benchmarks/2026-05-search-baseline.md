---
layer: 40-quality
doc: benchmark-search-baseline
status: historical
owner: backend-team
last_review: 2026-05-21
kind: benchmark
benchmark_date: 2026-05
superseded_by: ADR-0018
---

# Benchmark: UniversalSearch Baseline (2026-05)

> **Estado:** Línea base histórica (icontains). Post-FTS (2026-05-10): p95 medido en 22–72 ms. Ver [ADR-0018](../../10-architecture/adr/0018-postgresql-tsvector-migration.md).

## Entorno de Prueba
- **Dataset:** 50.000 Contactos, 100.000 Órdenes de Venta (generado vía `seed_benchmark_data.py`).
- **Entidades registradas:** 26 modelos en `UniversalRegistry`.
- **Mecanismo:** Iteración de modelos aplicando `Q(field__icontains=query)`.
- **Herramienta:** `pytest-benchmark`.

## Resultados (Latencia p50 / p95)

| Query | Desc. | p50 (Mediana) | p95 | p99 |
|-------|-------|--------------|-----|-----|
| `Carlos` | String corto frecuente | 850 ms | 1,200 ms | 1,450 ms |
| `NV-001` | String exacto/parcial ID | 900 ms | 1,250 ms | 1,500 ms |
| `76.` | Prefijo numérico (RUT) | 780 ms | 1,150 ms | 1,350 ms |

## Conclusión
La arquitectura actual (T-03) fue exitosa como refactor estructural, pero al llegar a 150.000 registros, el uso intensivo de `ILIKE '%query%'` (producido por `__icontains`) en 26 tablas distintas provoca **Full Table Scans** masivos.

El p95 supera abrumadoramente el umbral de aceptación de **300ms** (alcanzando ~1.2s), degradando drásticamente la UX del buscador global. 

**Acción requerida:** Se requiere la migración a un motor de búsqueda real (PostgreSQL `tsvector` o ElasticSearch). Según lineamientos de T-64, se levanta el **[ADR-0018](../../10-architecture/adr/0018-postgresql-tsvector-migration.md)** para decidir la estrategia técnica (PostgreSQL Full-Text Search).
