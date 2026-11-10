---
id: "0120"
title: "Gobernanza de filtros: etiquetas desde la entidad y valores de dominio semánticos"
status: accepted
date: 2026-11-09
deciders: [PatoC]
---

# ADR-0120 — Gobernanza de filtros: etiquetas desde la entidad y valores de dominio semánticos

## Contexto

Los filtros (`unifiedSearchDef`) y las columnas (`defineEntity`) se declaran por separado. Esto produce dos problemas concretos (issue #228):

1. **Etiquetas desincronizadas**: el título del chip en la barra de búsqueda difiere del encabezado de la columna que filtra (p. ej. `account_type` → "Tipo" en el filtro vs. "Tipología" en la entidad).

2. **Valores de URL con tokens de UI**: `origin_status`/`billing_status`/`payment_status`/`treasury_status` usaban `neutral`/`success`/`destructive`/`active` como valores en la query string. Estos tokens pertenecen a la capa visual y no deben filtrarse al protocolo HTTP.

## Decisión

### Regla inmediata (en vigor desde esta ADR)

**Regla G-1 — Etiqueta:** el `label` de un filtro en `unifiedSearchDef` DEBE ser idéntico al `label` del campo correspondiente en `defineEntity`. La columna es la fuente de verdad del nombre de un concepto.

**Regla G-2 — Valores de dominio:** los `value` de las opciones de un filtro DEBEN ser valores del dominio (enumeraciones del modelo o constantes de la capa de servicio), nunca tokens de la capa de presentación (`neutral`, `success`, `destructive`, `active`, nombres de colores o de estilos).

### Hoja de ruta arquitectónica (propuesta, pendiente de ADR propio)

La solución estructural es co-locar el filtro dentro del campo de `defineEntity`:

```ts
accountType: f.text("account_type_display", {
  label: "Tipología",
  filter: { serverParam: "account_type", options: [...] },  // propuesto
})
```

Esto derivaría el título del chip de `label` automáticamente, eliminaría la dualidad y permitiría que el sistema de entity-view genere la configuración de `UnifiedSearchBar`. Este cambio requiere una ADR propia porque modifica el contrato de `defineEntity` (layer 20, invariante 12) y la API pública de `@/components/entity-view`.

## Consecuencias

- Los tests de los filtersets del backend que usaban tokens de UI se actualizan para usar valores semánticos.
- Los filtros del frontend que usaban tokens de UI se actualizan en la misma entrega.
- Los filtersets del backend mantienen compatibilidad temporal con los tokens viejos solo mientras no se pueda hacer el cambio atómico frontend+backend.
- Nuevos filtros no pueden declarar valores con nombres de tokens de UI.

## Correcciones aplicadas en esta ADR

| Entidad | Filtro | Antes | Después |
|---------|--------|-------|---------|
| Cuenta de tesorería | `account_type` label | "Tipo" | "Tipología" |
| Método de pago | `method_type` label | "Categoría" | "Categoría Operativa" |
| Orden de compra (fecha) | `receipt_date` label | "Fecha Entrega" | "Entrega esperada" |
| OV `origin_status` values | — | `neutral`/`success`/`destructive` | `DRAFT`/`ACTIVE`/`CANCELLED` |
| OV `billing_status` values | — | `success`/`pending` | `INVOICED`/`PENDING` |
| OV `payment_status` values | — | `neutral`/`active`/`success` | `UNPAID`/`PARTIAL`/`PAID` |
| OC `origin_status` values | — | `neutral`/`success`/`destructive` | `DRAFT`/`ACTIVE`/`CANCELLED` |
| OC `billing_status` values | — | `success`/`neutral` | `INVOICED`/`PENDING` |
| OC `treasury_status` values | — | `neutral`/`active`/`success` | `UNPAID`/`PARTIAL`/`PAID` |
