## Observabilidad y auditoría — ERPGrafico

Estrategia de monitoreo, auditoría y observabilidad para un ERP desplegado on‑premise / VPS por cliente, con equipo mínimo y presupuesto cercano a cero.

### Documentos

| Doc | Para qué sirve |
|---|---|
| [strategy.md](strategy.md) | Informe técnico-estratégico: alternativas SaaS vs self‑hosted, las 4 capas (audit log, SIEM, APM, analítica), stack recomendado, plan incremental. |
| [current-state.md](current-state.md) | Estado actual del sistema (qué hay implementado hoy), evaluación contra el Sprint 1 de la estrategia y gaps pendientes. |
| [sprint-2-setup.md](sprint-2-setup.md) | Setup de Sentry + Healthchecks.io: cambios aplicados, variables de entorno, cómo verificar y opt-out por cliente. |

### Restricciones que enmarcan toda la decisión

- **Despliegue**: on‑premise / VPS del cliente (no es SaaS centralizado).
- **Compliance**: sin obligaciones regulatorias formales.
- **Presupuesto**: <US$50/mes para toda la capa.
- **Equipo de mantenimiento**: mínimo.

### Conclusión en una línea

No tercerizar la observabilidad como bloque. **Embeber lo mínimo dentro del propio stack Docker del cliente**, y usar tiers gratuitos de Sentry y Healthchecks.io solo para lo que no conviene construir.
