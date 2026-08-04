---
layer: 10-architecture
doc: adr-0053
status: accepted
date: 2026-07-13
---

# ADR 0053: TimeStampedModel como base obligatoria y resolución de auditoría

## Contexto

El proyecto ERPGrafico ha estado operando con dos patrones de diseño en aparente conflicto respecto a la eliminación de entidades y auditoría:

1. El módulo `core.models.abstracts` provee `SoftDeleteModel` y `TimeStampedModel`, ofreciendo `deleted_at`, `created_at` y `updated_at`.
2. La política `docs/20-contracts/deletion-policy.md` establece explícitamente: "NO existe ni se va a introducir `django-safedelete` ni un mixin global de soft-delete", dictando cuatro patrones de negocio (Cancelación, Anulación, Archivo, Hard delete).

Como resultado de esta tensión y de una migración incompleta (retrofitted), solo el ~37% de los modelos heredan de `TimeStampedModel`. Modelos críticos como `Product`, `Contact`, `Employee`, `WorkOrder` y `Payroll` heredan directamente de `models.Model`.

Si bien el patrón "Archivo" (usando `is_active`) cubre la necesidad funcional de ocultar registros sin romper referencias, la falta de una base común para auditoría significa que:
- Eliminaciones accidentales (`.delete()`) en la base de datos o en endpoints no protegidos resultan en la pérdida irrecuperable de registros (hard delete).
- Faltan metadatos básicos (`created_at`, `updated_at`) en entidades cruciales.
- El campo `created_by` se ha implementado de forma ad-hoc (solo en ~12% de los modelos), lo que dificulta la trazabilidad unificada.

## Decisión

1. **`TimeStampedModel` es la base técnica obligatoria** para todo modelo de negocio del sistema. Su uso asegura metadatos de creación/actualización y un mecanismo de "red de seguridad" (soft delete a nivel de base de datos), independiente del ciclo de vida funcional de la entidad.
2. **Separación de responsabilidades**: 
   - `TimeStampedModel` (con su `deleted_at`) actúa como una capa de persistencia defensiva y de auditoría.
   - `deletion-policy.md` rige el comportamiento de la aplicación y la interfaz de usuario.
   - Es perfectamente válido y esperado que una entidad use el patrón "Archivo" (campo `is_active=False` para la UI) y, al mismo tiempo, herede de `TimeStampedModel` para obtener timestamps y soft delete de infraestructura.
3. **Regla de autoría (`created_by`)**: Se requiere el campo `created_by` como llave foránea a `core.User` para:
   - Todo modelo que herede de `TransactionalDocument`.
   - Todo modelo "maestro" de negocio (catálogos, entidades principales con `is_active`).
   - *Se excluyen las líneas de detalle (que heredan la autoría de su padre) y entidades técnicas de sistema.*
4. **Historial y `updated_by`**: No se añadirá un campo `updated_by` a los modelos base. La trazabilidad de modificaciones continuará gestionándose mediante `django-simple-history` y el middleware existente, garantizando una granularidad superior.

## Consecuencias

- **Positivas**:
  - Homogeneidad en los metadatos de auditoría en toda la base de datos.
  - Prevención de pérdida accidental de datos en modelos críticos.
  - Trazabilidad estandarizada de autores (`created_by`) en transacciones y maestros.
- **Negativas**:
  - Sobrecarga (pequeña) por los campos adicionales en tablas grandes.
  - Coste inicial de refactorización y migración masiva.
  - Necesidad de añadir excepciones explícitas (mediante ADR) para librerías de terceros o tablas puramente técnicas que no deban usar esta base.

## Implementación

La adopción se enforcing automáticamente mediante el nuevo test arquitectónico `test_model_base_invariants.py`, el cual bloquea integraciones que no cumplan la regla a menos que se listen explícitamente como excepciones justificadas.
