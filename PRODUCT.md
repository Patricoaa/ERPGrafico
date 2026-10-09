# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primario:** el **operador de imprenta** — trabaja en la app toda la jornada procesando pedidos, planchas, rutas, costos y cambios de estado en alta frecuencia. Le sigue el **supervisor / gerente-contador**, que aprueba transiciones, revisa reportes y controla el cierre fiscal. **Administración/contabilidad** opera asientos, folios e impuestos.

Roles técnicos existentes (`backend/core/permissions.py`): ADMIN (Administrador), MANAGER (Gerente/Contador), OPERATOR (Operador), READ_ONLY (Lectura).

## Product Purpose

ERP full-stack para la industria gráfica/imprenta que cubre todo el ciclo de una pyme del rubro en un solo sistema: ventas y cotizaciones, compras, producción (órdenes de trabajo, rutas, operaciones, máquinas), inventario, contabilidad, facturación fiscal, tesorería, RRHH e impuestos. Existe para que la organización deje de operar sistemas fragmentados y ejecute el flujo pedido → producción → facturación → cobro con datos coherentes. Éxito = el operador corre toda su jornada en el sistema, más rápido y sin reconciliaciones manuales entre módulos, con corrección fiscal.

## Positioning

El mecanismo diferenciador es ser **todo-en-uno sectorial**: un único ERP integrado que reemplaza el stack de varias herramientas sueltas (contabilidad + producción + inventario + RRHH + tesorería) sobre un modelo de datos compartido, con el dominio de imprenta —planchas, rutas, operaciones, máquinas, folios fiscales— modelado como ciudadano de primera clase en lugar de un add-on de reportes.

## Operating Context

- Despliegue **single-org** (una sola organización por instalación); no es SaaS multi-tenant (non-goal documentado en `docs/00-context/project-overview.md`).
- Pre-producción se valida con ramas locales + tests + smoke; no hay entorno de staging dedicado.
- Entornos: local (docker compose, datos sembrados con `setup_demo_data`) y producción (servidor propio Ubuntu + docker compose).
- Idioma de interfaz: sólo **español** (contexto fiscal Chile: F29, folios). Sin i18n multi-idioma por ahora.
- Flujos con máquinas de estado y aprobaciones por rol (app `workflow`).
- Documentos y formatos: exportación PDF/Excel/CSV, import masivo CSV/XLSX con preview + commit.

## Capabilities and Constraints

13 apps Django = 13 bounded contexts: accounting, billing, contacts, core, finances, hr, inventory, production, purchasing, sales, tax, treasury, workflow.

Capacidades confirmadas: órdenes de venta/compra/trabajo; ledger y asientos; folios fiscales y períodos; conciliación bancaria; RBAC por rol; idempotencia en escrituras; realtime (WebSocket/SSE vía Django Channels); exportaciones e importaciones; tareas asíncronas con Celery.

Restricciones: single-org; no offline-first/PWA; no apps mobile-native; no HA/multi-región; sin stack enterprise de observabilidad. Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, Shadcn UI, TanStack Query, Zod, react-hook-form; Django 5 + DRF, Celery, Redis; PostgreSQL; almacenamiento S3-compatible (Cloudflare R2).

## Brand Commitments

No hay activos de marca vinculantes (nombre, logo, press kit): `frontend/public/` está vacío. El usuario confirmó que **la identidad vive en el sistema de diseño existente**, documentado en [DESIGN.md](DESIGN.md) y sus contratos de `docs/20-contracts/` — no en activos externos. No introducir una identidad visual paralela por fuera de DESIGN.md. Idioma de UI: sólo español.

## Evidence on Hand

- Datos de demostración sembrados vía `python manage.py setup_demo_data` — es la única evidencia de contenido disponible; **no** usar datos reales de producción para decisiones de diseño.
- Documentación interna extensa en `docs/` (00-context, 10-architecture, 20-contracts, 30-playbooks, 40-quality, 90-governance) y ADRs.
- No hay testimonios, casos de estudio, clientes, benchmarks, precios ni material de marketing; futuros trabajos no deben inventarlos.

## Product Principles

1. **Un solo sistema, un solo dato.** Cada hecho de negocio vive una vez; los módulos leen el mismo modelo, sin reconciliación manual entre herramientas.
2. **El dominio de imprenta es de primera clase.** Planchas, rutas, operaciones, máquinas y folios no son afterthoughts de reportes.
3. **Velocidad del operador como métrica de éxito.** El sistema existe para que la jornada en la app sea más rápida, no para exhibir features.
4. **Corrección fiscal no negociable.** Folios, períodos y documentos fiscales correctos mandan sobre conveniencias de flujo.
5. **Coherencia integrada.** Un cambio en un bounded context no rompe la verdad compartida de los demás.
