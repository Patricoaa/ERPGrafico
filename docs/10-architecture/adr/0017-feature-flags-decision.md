# ADR 0017: Omitir Feature Flags en el Refactor Arquitectónico (Big-Bang)

## Contexto
El documento de estrategia de migración (`40-migration-and-rollback.md`) prescribía originalmente el uso de 7 feature flags (ej: `arch_core`, `arch_billing`, `arch_inventory`) para mitigar el riesgo de la refactorización profunda usando un enfoque de Canary Release. 
Sin embargo, durante la ejecución del refactor (T-11 a T-58) se optó por un despliegue "big-bang" en la rama principal sin la implementación de una librería de toggles (como `django-waffle`). 

Las razones fueron:
1. **Sobrecarga de Productividad:** Mantener dos flujos lógicos vivos y bifurcados simultáneamente en la misma base de código introducía una fricción excesiva y entorpecía el trabajo de estandarización cruzada de los modelos (ej: la adopción masiva de `TransactionalDocument` y `TotalsCalculationMixin` en todos los módulos de manera uniforme).
2. **Infraestructura No Preparada:** El sistema carecía de un gestor de Feature Flags preinstalado. Introducir uno a mitad de un proceso de pago de deuda técnica incrementaba artificialmente la complejidad y el mantenimiento en la base de datos y la caché.
3. **Cobertura End-to-End Fuerte:** La introducción de la suite Golden de regresión `test_financial_baseline` (basada en snapshots deterministas) probó ser un escudo confiable, proporcionando validación absoluta sobre la contabilidad sin necesidad de aislar el código fallido en vivo.

## Decisión
- **Se decide OMITIR DEFINITIVAMENTE la implementación de feature flags** para el refactor general de la Arquitectura Django. Se acepta el riesgo del despliegue consolidado (big-bang).
- **Plan B de Rollback (Mitigación Post-Merge):** Ante cualquier degradación severa en producción post-merge, dado que no existirá apagado granular por toggle, el protocolo de mitigación oficial es:
  1. Ejecución de `git revert` del merge commit a `main`.
  2. Restauración/Reversión en DB (vía `python manage.py migrate <app> <previous_migration>` o volcado pre-deploy en caso de colapso de esquema).
  3. Redespliegue inmediato (Redeploy) de los contenedores mediante CI/CD.
  - *Tiempo estimado de mitigación total:* < 15 minutos.

## Consecuencias
### Positivas
- Código base más conciso y sin ramificaciones temporales complejas (`if is_active('arch_x'):`).
- Reducción drástica en la carga cognitiva para realizar refactorizaciones estructurales transversales.

### Negativas
- El riesgo de fallo post-despliegue es general en lugar de acotado; una regresión en el modelo `Invoice` obliga a revertir todas las mejoras conjuntas que acompañaban al commit.

## Firmas y Aprobación
- Creado por: Auditoría AI
- Stakeholder: Pato / Dirección Técnica
- Fecha: 2026-05-08
- Estado: **Aceptado Retroactivamente**
