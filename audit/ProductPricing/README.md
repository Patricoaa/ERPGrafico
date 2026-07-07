---
doc: product-pricing-audit
status: planned
owner: fullstack-team
last_review: 2026-05-20
---

# Auditoría: Configuración de Precios de Productos

Auditoría técnica y funcional de la gestión de precios en el maestro de productos, incluyendo precios por UoM, herencia en variantes, visibilidad en POS y listas de precios.

> **Plan de implementación ejecutable**: ver [implementation-plan.md](./implementation-plan.md).

---

## Motivación

El sistema actual gestiona precios con un único campo `sale_price` referenciado a la UoM base de stock. Esta arquitectura es correcta para productos simples, pero introduce tres brechas funcionales que afectan la operación diaria de una Pyme:

1. Productos con múltiples UoMs de venta usan conversión proporcional pura, ignorando tarifas comerciales reales por escala.
2. Las variantes de producto no tienen mecanismo de herencia de precios desde el template, requiriendo actualización manual en cada variante.
3. El precio base está en la tab "General" y las reglas en la tab "Reglas", dividiendo en dos lugares lo que conceptualmente es una sola área de gestión.

---

## Estado actual del modelo de precios

### Campos en `Product` (backend)

| Campo | Tipo | Rol |
|-------|------|-----|
| `sale_price` | Decimal(12,0) | Precio neto base (referenciado a `uom`) |
| `sale_price_gross` | Decimal(12,0) | Precio bruto base (19% IVA incluido) |
| `cost_price` | Decimal(12,0) | Costo ponderado (calculado, solo lectura) |
| `is_dynamic_pricing` | Boolean | Permite fijar precio manual en el momento de la venta |
| `uom` | FK(UoM) | UoM de stock (base para precios) |
| `allowed_sale_uoms` | M2M(UoM) | UoMs de venta permitidas |

### Modelo `PricingRule`

| Campo | Descripción |
|-------|-------------|
| `product` / `category` | Alcance: producto específico o categoría entera |
| `uom` | UoM a la que aplica la regla (nullable) |
| `operator` / `min_quantity` / `max_quantity` | Condición de cantidad (GT, LT, EQ, GE, LE, BT) |
| `rule_type` | FIXED, PACKAGE_FIXED, DISCOUNT_PERCENTAGE |
| `fixed_price` / `fixed_price_gross` | Precio fijo neto/bruto |
| `discount_percentage` | Descuento porcentual sobre precio base |
| `start_date` / `end_date` | Vigencia comercial |
| `priority` | Orden de aplicación cuando múltiples reglas coinciden |
| `active` | Desactivación manual |

### Distribución actual en UI

```
Tab General
├── ProductBasicInfo   — identidad, tipo, categoría, imagen
└── ProductPricingSection  ← precio neto/bruto + is_dynamic_pricing + sale_uom

Tab Reglas  (oculta si !canBeSold)
└── ProductPricingTab  ← lista de PricingRule CRUD

Tab Variantes  (oculta si !hasVariants)
└── ProductVariantsTab  ← tabla de variantes con precio individual por variante
```

---

## Gap 1 — Precios independientes por UoM de venta

### Diagnóstico

Cuando el operador cambia la UoM en el POS, el frontend aplica:

```typescript
// frontend/features/pos/utils/pricing.ts
calculateUoMPrice(basePrice, baseRatio, targetRatio)
// → precio_uom = basePrice * (targetRatio / baseRatio)
```

Esto es correcto para unidades de medida del mismo tipo continuo (kg/g, litro/ml), pero no modela tarifas comerciales reales donde el precio por escala tiene lógica propia:

| Producto | UoM Base | Precio base | UoM alternativa | Conversión proporcional | Precio comercial real |
|---------|----------|-------------|-----------------|------------------------|-----------------------|
| Vino tinto | Botella | $5.000 | Caja 12u | $60.000 | $52.000 |
| Papel resma | Unidad | $3.000 | Caja 10u | $30.000 | $25.000 |
| Tela | Metro | $1.200 | Rollo 50m | $60.000 | $45.000 |

### Arquitectura recomendada

Nuevo modelo `ProductUoMPrice` que asocia un precio específico a cada UoM de venta permitida del producto. Si la UoM no tiene precio propio, el sistema hace fallback a conversión proporcional (comportamiento actual preservado).

```python
class ProductUoMPrice(models.Model):
    product    = ForeignKey(Product, related_name='uom_prices')
    uom        = ForeignKey(UoM)
    price_net  = DecimalField(12, 0)
    price_gross = DecimalField(12, 0)

    class Meta:
        unique_together = ('product', 'uom')
```

El endpoint `effective_sale_price` ya recibe `uom_id` — solo necesita consultar esta tabla antes de hacer la conversión proporcional.

---

## Gap 2 — Reorganización de la tab de precios

### Diagnóstico

`ProductPricingSection` está embebido en la tab "General" (línea 717 de `ProductForm.tsx`). El operador que quiere gestionar precios debe ir primero a "General" para el precio base y luego a "Reglas" para las listas. Son dos tabs para una misma área de responsabilidad.

### Estructura propuesta para una tab "Precios" consolidada

```
Tab: Precios  (visible si canBeSold && productType !== 'SUBSCRIPTION')
├── Sección: Precio Base
│   ├── Precio Neto ↔ Precio Bruto (sync bidireccional actual, sin cambios)
│   ├── Toggle: Precio dinámico (is_dynamic_pricing)
│   └── [Condicional si allowed_sale_uoms.length > 1]
│       Tabla: Precios por unidad de venta
│       └── UoM | Precio Neto | Precio Bruto | Badge "Hereda" si vacío
│
├── Sección: Listas de Precios
│   └── Tabla PricingRule actual (sin cambios funcionales)
│       └── Columna "Estado" diferencia: Activa / Vencida (end_date pasado) / Inactiva
│
└── [Condicional si hasVariants]
    Sección: Precios de Variantes
    └── Ver Gap 3
```

Lo que se elimina de "General": el componente `ProductPricingSection` sale de ese tab. "General" queda solo con identidad del producto.

---

## Gap 3 — Herencia de precios en variantes

### Diagnóstico

Las variantes son registros `Product` independientes con `parent_template` FK. Hoy cada variante tiene `sale_price` propio y no hay sincronización automática con el template.

Impacto operacional: un producto con 15 variantes (3 tallas × 5 colores) requiere 15 actualizaciones manuales de precio por cada cambio de tarifa.

### Arquitectura recomendada

Nuevo campo `price_inheritance_mode` en `Product`:

```python
PRICE_INHERITANCE_CHOICES = [
    ('INHERIT',   'Heredar del template'),
    ('OVERRIDE',  'Precio propio'),
    ('SURCHARGE', 'Precio template + sobrecargo'),
]

price_inheritance_mode = CharField(
    max_length=10,
    choices=PRICE_INHERITANCE_CHOICES,
    default='INHERIT',      # Al generar variantes, heredan por defecto
)
price_surcharge = DecimalField(12, 0, null=True, blank=True)
```

Resolución de precio efectivo en `PricingService`:

```python
def resolve_variant_price(variant: Product) -> Decimal:
    if variant.price_inheritance_mode == 'INHERIT':
        return variant.parent_template.sale_price
    elif variant.price_inheritance_mode == 'SURCHARGE':
        return variant.parent_template.sale_price + (variant.price_surcharge or 0)
    else:  # OVERRIDE
        return variant.sale_price
```

Las `PricingRule` del template con `active=True` también aplican a las variantes por defecto (heredan). Si una variante necesita reglas propias, se le asignan directamente.

### UI en tab Variantes

La tabla de variantes en `ProductVariantsTab` agrega tres columnas operacionales:

| Variante | Modo | Precio efectivo | Sobrecargo |
|---------|------|----------------|-----------|
| Rojo / S | Hereda | $12.000 | — |
| Rojo / XL | Sobrecargo | $13.500 | +$1.500 |
| Azul / S | Propio | $11.000 | — |

Acción masiva: **"Aplicar precio template a todas"** — establece `INHERIT` en todas las variantes seleccionadas.

---

## Gap 4 — UoMs en POS: selector vs. `allowed_sale_uoms`

### Diagnóstico

El `Cart` recibe la lista completa de `uoms` del contexto POS, no filtrada por `allowed_sale_uoms` del producto. Si el selector de UoM muestra todas las unidades de la misma categoría, el operador puede seleccionar una UoM no habilitada para ese producto.

### Corrección

El endpoint `effective_sale_price` debe filtrar las UoMs disponibles a las presentes en `allowed_sale_uoms`. En el frontend, `CartItem` al abrir el selector de UoM debe pasar `allowedUoms = product.allowed_sale_uom_ids` como filtro.

---

## Gap 5 — Estado visual de reglas vencidas

### Diagnóstico

Las `PricingRule` con `end_date` en el pasado siguen mostrándose igual que las activas en la tabla de `ProductPricingTab`. No hay distinción visual entre "activa vigente", "activa vencida" y "desactivada manualmente".

### Corrección

Tres variantes de `StatusBadge` para el campo estado de una `PricingRule`:

| Estado | Condición | Color |
|--------|-----------|-------|
| Activa | `active=True` y sin `end_date` o `end_date >= hoy` | `success` |
| Vencida | `active=True` pero `end_date < hoy` | `muted` (no error, es histórica) |
| Inactiva | `active=False` | `secondary` |

---

## Decisión: listas de precios y períodos contables cerrados

**Las listas de precios NO deben validarse contra períodos contables cerrados.**

Son instrumentos de dos dimensiones ortogonales:

- **Lista de precios**: vigencia comercial (`start_date` / `end_date`) — define qué precio ofrecer en un rango de fechas.
- **Período contable**: vigencia para reconocimiento de ingresos/egresos — define si se pueden registrar transacciones en esa fecha.

La validación contable ocurre en el momento de emitir el documento (factura, boleta, OT), no al configurar la lista. Una regla con fechas en un período cerrado es válida como referencia histórica.

```
✅ Consultar precio vigente en período cerrado → permitido
✅ Crear lista con fechas pasadas → permitido (queda como histórica)
❌ Emitir factura con fecha en período cerrado → bloqueado (en documento, no en lista)
```

---

## Resumen de brechas y prioridad

| # | Gap | Impacto | Esfuerzo | Prioridad |
|---|-----|---------|----------|-----------|
| 1 | Tab Precios consolidada (sacar precio de General) | UX / Operacional | Bajo | Alta |
| 2 | Herencia de precios en variantes | Gestión diaria Pyme | Medio | Alta |
| 3 | Precios independientes por UoM de venta | Precisión comercial | Medio-Alto | Media |
| 4 | Filtrar UoMs en POS por `allowed_sale_uoms` | Integridad operacional | Bajo | Media |
| 5 | Chip "Vencida" en reglas históricas | UX informacional | Muy bajo | Baja |
