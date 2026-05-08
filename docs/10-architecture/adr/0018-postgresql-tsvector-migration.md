# ADR 0018: Migración a PostgreSQL tsvector para UniversalSearch

## Estado
Propuesto

## Contexto
El `UniversalRegistry` introducido en el refactor de auditoría (T-03) unificó el catálogo de entidades mediante duck-typing y configuración dinámica, eliminando dependencias circulares. Sin embargo, su mecanismo de búsqueda dependía de consultas iterativas utilizando `field__icontains`, lo cual se traduce en SQL como `ILIKE '%query%'`.

El benchmark realizado en la T-64 (`docs/40-quality/benchmarks/2026-05-search-baseline.md`) con 150.000 registros demostró que el p95 de latencia supera los 1.2 segundos, rompiendo nuestro SLA de interfaz de 300ms. Esto se debe a que `ILIKE` anula el uso de índices B-Tree estándar, provocando Full Table Scans secuenciales a través de 26 tablas.

## Decisión
Se decide migrar el backend del `UniversalRegistry` a **PostgreSQL Full-Text Search (FTS)** utilizando vectores de búsqueda (`tsvector`) e índices GIN, descartando el uso de dependencias externas severas (como ElasticSearch o Meilisearch) para mantener la simplicidad de la infraestructura híbrida actual.

**Plan de Implementación:**
1. **Columna `search_vector`:** Inyectar un campo `SearchVectorField` (Django `django.contrib.postgres.search`) estandarizado en las clases base o directamente inyectado vía un mixin (`SearchableMixin`) para los 26 modelos registrados.
2. **Índice GIN:** Agregar un `GinIndex` apuntando al vector.
3. **Mantenimiento del Vector:** Implementar un trigger a nivel de PostgreSQL o depender de un `post_save` signal en Django para actualizar el vector cuando los campos vigilados (`search_fields`) cambien. (Se prefiere trigger SQL para performance).
4. **Modificación de UniversalRegistry:** Cambiar el método `_build_icontains_filter` para utilizar `SearchQuery` contra el `search_vector`.

## Consecuencias
- **Positivas:**
  - El p95 de la búsqueda global caerá de ~1.2s a <50ms, permitiendo búsquedas instantáneas reales (typeahead).
  - Soporte nativo para stemming y diccionarios en español.
  - No se agrega infraestructura (contenedores) extra.
- **Negativas:**
  - Acoplamiento directo del código a PostgreSQL (ya definido y aceptado en ADRs anteriores).
  - Las migraciones para calcular los vectores iniciales de 150k+ filas en producción requerirán un downtime controlado o una migración en background por lotes (Celery).
  - Mayor consumo de espacio en disco en la base de datos debido al almacenamiento de los vectores FTS y el índice GIN.
