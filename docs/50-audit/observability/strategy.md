# Estrategia de observabilidad y auditoría

> Informe original. Para el estado actual del sistema y la evaluación contra el Sprint 1 ver [current-state.md](current-state.md).

## 1. Restricciones que mandan la decisión

- **Despliegue on‑premise / VPS del cliente** → sin control de la red de salida; mandar telemetría a un SaaS central implica que el proveedor (nosotros) pague por todos los clientes, o que cada cliente contrate su propia cuenta (inviable comercialmente).
- **Presupuesto <US$50/mes total** → quedan fuera Datadog, New Relic, Dynatrace, Splunk, ELK Cloud, Honeycomb. Incluso Sentry self‑hosted bien dimensionado consume más recursos que el propio ERP.
- **Sin obligación regulatoria** → no necesitamos WORM storage, retención de 6 años, ni certificaciones. Liberador: podemos rotar logs agresivamente.
- **Equipo mínimo** → cualquier componente sumado debe ser "fire and forget": arranca con `docker compose up` y no requiere tuning trimestral.

**Conclusión temprana:** la respuesta no es "tercerizar vs. local". Es **embebido en el mismo stack Docker del cliente, con lo mínimo por cada capa**. Tercerizar solo tiene sentido en un punto puntual.

## 2. Las 4 capas, evaluadas por separado

Mezclar las cuatro en una sola herramienta es un error común y caro. Cada una tiene una vida útil, un consumidor y un volumen distintos.

### 2.1 Audit log de negocio (¿quién tocó qué?)

| Opción | Veredicto |
|---|---|
| **`django-simple-history` o `django-auditlog`** ⭐ | **Recomendado.** Una tabla histórica por modelo crítico, sin infra adicional, consultable desde el Admin o desde una vista del propio ERP. Mantenibilidad cero. |
| Triggers de PostgreSQL | Más robusto (no se puede saltar desde el ORM) pero más opaco. Solo si en el futuro hay desconfianza interna. |
| Enviar a Loki/Elastic | Sobre-ingeniería. Esto se consulta desde la UI del ERP ("ver historial de esta factura"), no desde un dashboard de logs. |

**Razón estratégica:** el audit log de negocio es *parte del producto*, no de la observabilidad. El cliente debe poder ver "Juan modificó el precio ayer 14:32" sin que el proveedor intervenga.

### 2.2 Seguridad / SIEM

Sin compliance y con un solo VPS por cliente, **no se necesita un SIEM**. Bastan tres cosas baratas:

1. **Logs de auth en tabla propia**: intentos de login (éxito/fallo), cambios de password, cambios de rol. Misma tabla que el audit log o equivalente.
2. **Fail2ban en el VPS** (gratis) para bloquear fuerza bruta a SSH y al endpoint de login.
3. **Alertas básicas por email** desde Django cuando ocurra algo anómalo (ej. 10 logins fallidos del mismo usuario en 5 min).

Wazuh / Graylog / Security Onion son excelentes pero requieren 4–8 GB de RAM y un sysadmin dedicado. **No para este perfil.**

### 2.3 Observabilidad técnica (APM, errores, performance)

Aquí sí tiene sentido tercerizar parcialmente.

| Opción | Costo | Veredicto |
|---|---|---|
| **Sentry SaaS (Developer free, 5k errores/mes)** ⭐ | US$0 hasta crecer | **Recomendado para errores.** DSN único, opt-out por cliente. Migrar a Team (US$26/mes) cuando duela. |
| **GlitchTip self-hosted** | Solo RAM | Alternativa 100% local, API‑compatible con Sentry SDK. Si un cliente no permite telemetría saliente. |
| **Prometheus + Grafana + Loki ("stack PLG")** self-hosted | Solo RAM (~1.5 GB) | Para *nosotros*, no para el cliente. Útil cuando centralicemos métricas de deploys gestionados. Hoy es prematuro. |
| **Healthchecks.io** (free tier) | US$0 | Para confirmar que cada VPS sigue vivo (cron envía ping cada 5 min). Imprescindible y gratis. |

**Recomendación:** Sentry SaaS para errores + Healthchecks.io para uptime. Total: **US$0/mes** hasta crecer.

### 2.4 Analítica de producto

| Opción | Veredicto |
|---|---|
| **PostHog self-hosted (Docker)** | Potente pero pesado (~2 GB RAM + ClickHouse). Solo si analítica es driver del producto. |
| **PostHog Cloud (free tier 1M eventos/mes)** ⭐ | **Recomendado si queremos saber qué usan los clientes.** Un solo proyecto centralizado, eventos pseudonimizados. |
| **Plausible / Umami self-hosted** | Liviano pero solo page views — insuficiente para entender uso de features. |
| **No medir nada** | Opción válida hoy. Postergable hasta tener >5 clientes pagando. |

## 3. Stack recomendado consolidado (US$0/mes)

```
┌─ Dentro del docker-compose de cada cliente ──────────────────┐
│                                                              │
│  Django + django-simple-history → audit log de negocio       │
│       ↓ tabla en PostgreSQL                                  │
│                                                              │
│  Sentry SDK (sentry-sdk[django])→ errores → Sentry SaaS      │
│  PostHog JS (frontend)          → eventos → PostHog Cloud    │
│  cron + curl                    → ping  → Healthchecks.io    │
│  fail2ban (sistema)             → bloqueo SSH/login          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Por qué funciona:**
- Cero infra nueva que mantener por cliente.
- Cero costo fijo hasta crecer.
- Cada cliente puede pedir "no enviar a Sentry/PostHog" y se desactiva con una env var — respeta privacidad sin reescribir código.
- Si un cliente exige *todo local*, se reemplaza Sentry → GlitchTip y PostHog → PostHog self‑hosted **sin tocar código de aplicación** (mismos SDKs).

## 4. Lo que explícitamente NO se recomienda

| Tentación común | Por qué no |
|---|---|
| Montar ELK/OpenSearch | 4+ GB RAM mínimos, indices que se corrompen, sin equipo no se opera. |
| Datadog/New Relic | Modelo per‑host funde el presupuesto con 3 clientes. |
| Construir un dashboard propio con Kafka + ClickHouse | Es construir un producto paralelo al ERP. |
| Loguear *todo* a un archivo gigante "por si acaso" | Sin búsqueda indexada es ruido; con búsqueda indexada es un SIEM que no queríamos. |
| Reinventar Sentry con `try/except` que guarda en DB | Mal manejo de concurrencia y se pierden los errores que más importan. |

## 5. Plan de adopción incremental

1. **Sprint 1 (1–2 días):** integrar `django-simple-history` (o `django-auditlog`) sobre los 5–7 modelos críticos (Factura, Cotización, Pago, Usuario, Permisos, Cliente). Exponer una vista "Historial" en la UI.
2. **Sprint 2 (medio día):** Sentry SDK en backend y frontend + Healthchecks.io en un cron. Variable `OBSERVABILITY_ENABLED` para opt‑out.
3. **Sprint 3 (medio día):** logging de eventos de auth (login OK, login fail, lockout, cambio de rol) en la misma tabla de audit y endpoint admin para revisarlos.
4. **Diferido hasta tracción:** PostHog Cloud para producto, fail2ban en plantilla de despliegue.

## 6. Cuándo revisar esta decisión

- Más de 10 clientes activos → Sentry free se queda corto, justifica Team.
- Un cliente firma contrato con cláusula de retención o auditoría externa → logs inmutables.
- Lanzamiento de "ERPGrafico Cloud" gestionado → ahí sí Grafana/Loki central.
- Equipo crece a 3+ devs → se puede sostener PostHog self-hosted y se gana control de datos.

## 7. TL;DR

No tercerizar ni hacer observabilidad "seria". Embeber lo mínimo dentro del propio stack del cliente, usar tiers gratuitos de Sentry y Healthchecks para lo que no conviene construir, y tratar el audit log de negocio como una *feature del producto* — no como infraestructura.
